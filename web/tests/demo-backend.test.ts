/**
 * Critical customer / supplier / admin workflows against the in-browser demo
 * backend (what the public preview runs). A Map-backed localStorage shim
 * stands in for the browser.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

const store = new Map<string, string>();
const localStorageShim = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
};
Object.assign(globalThis, { window: { localStorage: localStorageShim, dispatchEvent: () => true } });

let api: typeof import("../lib/demo-backend").demoBackend;
const PW = "Demo@1234";

beforeAll(async () => {
  api = (await import("../lib/demo-backend")).demoBackend;
});

beforeEach(async () => {
  await api.reset();
});

describe("demo backend", () => {
  it("authenticates demo accounts and rejects bad passwords", async () => {
    await expect(api.login("customer@demo.ae", "nope")).rejects.toThrow(/Incorrect/);
    const u = await api.login("admin@demo.ae", PW);
    expect(u.role).toBe("admin");
    expect((await api.currentUser())?.email).toBe("admin@demo.ae");
    await api.logout();
    expect(await api.currentUser()).toBeNull();
  });

  it("enforces roles", async () => {
    await api.login("customer@demo.ae", PW);
    await expect(api.adminOverview()).rejects.toThrow(/permission/);
    await expect(api.myParts()).rejects.toThrow(/permission/);
  });

  it("supplier lists a part that becomes searchable, then marks it sold", async () => {
    await api.login("supplier@demo.ae", PW);
    const p = await api.savePart({ partTypeId: "alternator", make: "toyota", model: "camry", yearFrom: 2018, yearTo: 2020, price: 450, condition: "tested" });
    expect(p.moderation).toBe("approved");
    let res = await api.search({ make: "toyota", model: "camry", partType: "alternator" });
    expect(res.results.some((r) => r.part.id === p.id)).toBe(true);
    await api.setPartStatus(p.id, "sold");
    res = await api.search({ make: "toyota", model: "camry", partType: "alternator" });
    expect(res.results.some((r) => r.part.id === p.id)).toBe(false);
    await expect(api.savePart({ partTypeId: "brake-caliper", make: "toyota", model: "camry", yearFrom: 2018, yearTo: 2020, price: 300 })).rejects.toThrow(/safety-critical/);
  });

  it("imports CSV rows with a report", async () => {
    await api.login("supplier@demo.ae", PW);
    const job = await api.importRows("stock.csv", [
      { sku: "X1", part_type: "gearbox", make: "Mercedes Benz", model: "C200", year_from: "2015", year_to: "2018", price_aed: "2600" },
      { make: "???", model: "?", part_type: "?", year_from: "2015", price_aed: "1" },
    ]);
    expect(job.created).toBe(1);
    expect(job.errors).toHaveLength(1);
  });

  it("request → quotation → acceptance reveals contact only after acceptance", async () => {
    await api.login("customer@demo.ae", PW);
    const { request, matchedCount } = await api.createRequest({
      make: "mercedes-benz", model: "c-class", year: 2016, partTypeId: "gearbox", partText: "gearbox", emirate: "sharjah",
      description: "", images: [], contactName: "Demo Customer", contactPhone: "+971500000001", contactMethod: "whatsapp",
    });
    expect(matchedCount).toBeGreaterThan(0);

    await api.login("supplier@demo.ae", PW);
    let seen = (await api.matchedRequests()).find((r) => r.request.id === request.id)!;
    expect(seen.request.contactPhone).toMatch(/hidden/);
    await api.submitQuotation({ requestId: request.id, price: 2500, availability: "in-stock", condition: "tested", warrantyDays: 30, deliveryDays: 1, note: "", images: [] });

    await api.login("customer@demo.ae", PW);
    const mine = (await api.myRequests()).find((r) => r.request.id === request.id)!;
    expect(mine.quotations).toHaveLength(1);
    const acc = await api.acceptQuotation(mine.quotations[0].id);
    expect(acc.url).toMatch(/^https:\/\/wa\.me\//);

    await api.login("supplier@demo.ae", PW);
    seen = (await api.matchedRequests()).find((r) => r.request.id === request.id)!;
    expect(seen.request.contactPhone).toBe("+971500000001");
  });

  it("new suppliers stay hidden until an admin approves them", async () => {
    const s = await api.registerSupplier({
      businessName: "Test Yard", tradeLicence: "TL1", contactName: "Owner", phone: "+971501112233", whatsapp: "+971501112233",
      email: "yard@test.ae", password: "longpassword", emirate: "sharjah", area: "al-sajaa", address: "Shop 9", emiratesServed: ["sharjah"],
      makes: ["toyota"], categories: ["engine"], delivery: false, docs: [{ name: "licence.pdf", sizeKb: 90 }],
    });
    expect(s.status).toBe("pending");
    expect((await api.listSuppliers()).some((x) => x.id === s.id)).toBe(false);
    await api.login("admin@demo.ae", PW);
    await api.setSupplierStatus(s.id, "approved");
    expect((await api.listSuppliers()).some((x) => x.id === s.id)).toBe(true);
    expect((await api.auditLog()).some((a) => a.action === "supplier.approved")).toBe(true);
  });

  it("logs WhatsApp inquiries and never targets a number for sample suppliers", async () => {
    const pid = (await api.featured()).parts[0].id;
    const r = await api.logInquiry(pid, "en");
    expect(r.url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(r.isSample).toBe(true);
    await api.login("admin@demo.ae", PW);
    expect((await api.adminInquiries()).inquiries[0].inquiry.partId).toBe(pid);
  });
});
