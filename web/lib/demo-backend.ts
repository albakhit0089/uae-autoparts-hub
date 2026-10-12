/**
 * DEMO MODE backend.
 *
 * Runs entirely in the visitor's browser (localStorage) so the public preview
 * works on static hosting without a server. It implements the same contract as
 * the FastAPI backend (lib/http-backend.ts). It is NOT secure — passwords are
 * hashed client-side only and anyone can reset the data. Production deployments
 * set NEXT_PUBLIC_API_URL to use the real API.
 */
import { DEMO_PASSWORD, seedActivity, seedParts, seedSuppliers, seedUsers } from "./data/seed";
import { findPartType } from "./data/taxonomy";
import { planImport, type RawRow } from "./importer";
import { comparableParts, findDuplicateGroups, searchParts as runSearch } from "./search";
import type {
  AuditEntry, Emirate, ImportJob, Inquiry, Part, PartRequest, Plan, Quotation, Report, SavedVehicle, SearchFilters, Supplier, User,
} from "./types";
import { buildInquiryMessage, whatsappLink } from "./whatsapp";

const KEY = "uaeph-demo-db-v1";
const SESSION = "uaeph-session-v1";

interface DB {
  users: User[];
  suppliers: Supplier[];
  parts: Part[];
  inquiries: Inquiry[];
  requests: PartRequest[];
  quotations: Quotation[];
  imports: ImportJob[];
  audit: AuditEntry[];
  reports: Report[];
  savedVehicles: SavedVehicle[];
  favourites: Record<string, string[]>;
  searches: { day: string; count: number }[];
  plans: Plan[];
}

let db: DB | null = null;
let seeding: Promise<DB> | null = null;

export async function hashPassword(pw: string): Promise<string> {
  const data = new TextEncoder().encode(`uaeph-demo:${pw}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function freshDb(): Promise<DB> {
  const suppliers = seedSuppliers();
  const parts = seedParts(suppliers);
  const users = seedUsers(await hashPassword(DEMO_PASSWORD));
  const a = seedActivity(parts);
  return {
    users, suppliers, parts,
    inquiries: a.inquiries, requests: a.requests, quotations: a.quotations, imports: [], audit: a.audit,
    reports: a.reports, savedVehicles: a.savedVehicles, favourites: { "u-customer": [parts[0].id, parts[12].id] },
    searches: a.searches, plans: a.plans,
  };
}

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

async function load(): Promise<DB> {
  if (db) return db;
  if (!seeding) {
    seeding = (async () => {
      const raw = storage()?.getItem(KEY);
      if (raw) {
        try {
          db = JSON.parse(raw) as DB;
          return db;
        } catch {
          /* fall through to reseed */
        }
      }
      db = await freshDb();
      save();
      return db;
    })();
  }
  return seeding;
}

function save() {
  try {
    storage()?.setItem(KEY, JSON.stringify(db));
  } catch {
    /* storage full / blocked: keep in memory */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event("uaeph:changed"));
}

const uid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const now = () => new Date().toISOString();

class ApiError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}
export { ApiError };

function sessionUserId(): string | null {
  try {
    return storage()?.getItem(SESSION) ?? null;
  } catch {
    return null;
  }
}

async function me(): Promise<User | null> {
  const d = await load();
  const id = sessionUserId();
  return d.users.find((u) => u.id === id) ?? null;
}

async function requireRole(...roles: User["role"][]): Promise<User> {
  const u = await me();
  if (!u) throw new ApiError("Please log in first", 401);
  if (!roles.includes(u.role)) throw new ApiError("You do not have permission for this action", 403);
  return u;
}

async function requireSupplier(): Promise<{ user: User; supplier: Supplier }> {
  const user = await requireRole("supplier");
  const supplier = db!.suppliers.find((s) => s.id === user.supplierId);
  if (!supplier) throw new ApiError("Supplier profile not found", 404);
  return { user, supplier };
}

function audit(actorId: string, action: string, target: string) {
  db!.audit.unshift({ id: uid("a"), actorId, action, target, at: now() });
}

/** Strip contact details customers have not agreed to share. */
function redactRequest(r: PartRequest, reveal: boolean): PartRequest {
  return reveal ? r : { ...r, contactPhone: "hidden until you are selected", contactEmail: undefined };
}

const publicSupplier = (s: Supplier): Supplier => ({ ...s, apiKey: undefined, docs: [] });

export const demoBackend = {
  mode: "demo" as const,

  async reset() {
    db = await freshDb();
    seeding = Promise.resolve(db);
    storage()?.removeItem(SESSION);
    save();
  },

  // ------------------------------------------------------------------ auth
  async currentUser() {
    const u = await me();
    return u ? { ...u, passwordHash: "" } : null;
  },

  async login(email: string, password: string) {
    const d = await load();
    const u = d.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u || u.passwordHash !== (await hashPassword(password))) throw new ApiError("Incorrect email or password", 401);
    if (u.role === "supplier") {
      const s = d.suppliers.find((x) => x.id === u.supplierId);
      if (s?.status === "suspended") throw new ApiError("This supplier account is suspended. Contact support.", 403);
    }
    storage()?.setItem(SESSION, u.id);
    save();
    return { ...u, passwordHash: "" };
  },

  async logout() {
    storage()?.removeItem(SESSION);
    save();
  },

  async registerCustomer(input: { name: string; email: string; phone?: string; password: string; marketingConsent: boolean; whatsappConsent: boolean }) {
    const d = await load();
    if (d.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) throw new ApiError("An account with this email already exists");
    if (input.password.length < 8) throw new ApiError("Password must be at least 8 characters");
    const user: User = {
      id: uid("u"), email: input.email.trim(), name: input.name.trim(), phone: input.phone, role: "customer",
      passwordHash: await hashPassword(input.password), createdAt: now(),
      marketingConsent: input.marketingConsent, whatsappConsent: input.whatsappConsent,
    };
    d.users.push(user);
    storage()?.setItem(SESSION, user.id);
    save();
    return { ...user, passwordHash: "" };
  },

  async registerSupplier(input: {
    businessName: string; businessNameAr?: string; tradeLicence: string; contactName: string; phone: string; whatsapp: string;
    email: string; password: string; emirate: Emirate; area: string; address: string; emiratesServed: Emirate[];
    makes: string[]; categories: string[]; delivery: boolean; docs: { name: string; sizeKb: number }[];
  }) {
    const d = await load();
    if (d.users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) throw new ApiError("An account with this email already exists");
    if (input.password.length < 8) throw new ApiError("Password must be at least 8 characters");
    if (!input.docs.length) throw new ApiError("Please attach your trade licence");
    const { findArea } = await import("./data/emirates");
    const area = findArea(input.emirate, input.area);
    const supplier: Supplier = {
      id: uid("s"), name: input.businessName, nameAr: input.businessNameAr, tradeLicence: input.tradeLicence,
      contactName: input.contactName, phone: input.phone, whatsapp: input.whatsapp, email: input.email,
      emirate: input.emirate, area: input.area, address: input.address, lat: area?.lat ?? 25.33, lng: area?.lng ?? 55.6,
      emiratesServed: input.emiratesServed.length ? input.emiratesServed : [input.emirate], makes: input.makes,
      categories: input.categories, status: "pending",
      docs: input.docs.map((x) => ({ name: x.name, sizeKb: x.sizeKb, kind: "trade-licence" as const, uploadedAt: now() })),
      delivery: input.delivery, featured: false, plan: "free", createdAt: now(), isSample: false,
    };
    const user: User = {
      id: uid("u"), email: input.email, name: input.contactName, phone: input.phone, role: "supplier", supplierId: supplier.id,
      passwordHash: await hashPassword(input.password), createdAt: now(), marketingConsent: false, whatsappConsent: true,
    };
    d.suppliers.push(supplier);
    d.users.push(user);
    audit(user.id, "supplier.register", supplier.id);
    storage()?.setItem(SESSION, user.id);
    save();
    return supplier;
  },

  // ------------------------------------------------------------- catalogue
  async search(filters: SearchFilters) {
    const d = await load();
    const visible = new Set(d.suppliers.filter((s) => s.status === "approved").map((s) => s.id));
    const out = runSearch(d.parts.filter((p) => visible.has(p.supplierId)), filters);
    if (filters.q) {
      const day = now().slice(0, 10);
      const row = d.searches.find((s) => s.day === day);
      if (row) row.count++;
      else d.searches.push({ day, count: 1 });
      try {
        storage()?.setItem(KEY, JSON.stringify(d));
      } catch {
        /* ignore */
      }
    }
    return { ...out, suppliers: Object.fromEntries(d.suppliers.map((s) => [s.id, publicSupplier(s)])) };
  },

  async featured(limit = 8) {
    const d = await load();
    const ok = new Set(d.suppliers.filter((s) => s.status === "approved").map((s) => s.id));
    const list = d.parts.filter((p) => p.featured && p.moderation === "approved" && p.status !== "sold" && ok.has(p.supplierId));
    return { parts: list.slice(0, limit), suppliers: Object.fromEntries(d.suppliers.map((s) => [s.id, publicSupplier(s)])) };
  },

  async recent(limit = 8) {
    const d = await load();
    const ok = new Set(d.suppliers.filter((s) => s.status === "approved").map((s) => s.id));
    const list = d.parts
      .filter((p) => p.moderation === "approved" && p.status !== "sold" && ok.has(p.supplierId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return { parts: list.slice(0, limit), suppliers: Object.fromEntries(d.suppliers.map((s) => [s.id, publicSupplier(s)])) };
  },

  async getPart(id: string) {
    const d = await load();
    const part = d.parts.find((p) => p.id === id);
    if (!part) throw new ApiError("Listing not found", 404);
    const supplier = d.suppliers.find((s) => s.id === part.supplierId)!;
    const viewer = await me();
    const isOwner = viewer?.supplierId === part.supplierId || viewer?.role === "admin";
    if ((part.moderation !== "approved" || supplier.status !== "approved") && !isOwner) throw new ApiError("Listing not found", 404);
    part.views++;
    save();
    return { part, supplier: publicSupplier(supplier) };
  },

  async compare(id: string) {
    const d = await load();
    const base = d.parts.find((p) => p.id === id);
    if (!base) throw new ApiError("Listing not found", 404);
    const ok = new Set(d.suppliers.filter((s) => s.status === "approved").map((s) => s.id));
    const rows = comparableParts(base, d.parts.filter((p) => ok.has(p.supplierId)));
    return { base, rows, suppliers: Object.fromEntries(d.suppliers.map((s) => [s.id, publicSupplier(s)])) };
  },

  async listSuppliers() {
    const d = await load();
    const counts: Record<string, number> = {};
    d.parts.forEach((p) => {
      if (p.status !== "sold" && p.moderation === "approved") counts[p.supplierId] = (counts[p.supplierId] ?? 0) + 1;
    });
    return d.suppliers.filter((s) => s.status === "approved").map((s) => ({ ...publicSupplier(s), listings: counts[s.id] ?? 0 }));
  },

  async getSupplier(id: string) {
    const d = await load();
    const s = d.suppliers.find((x) => x.id === id && x.status === "approved");
    if (!s) throw new ApiError("Supplier not found", 404);
    const parts = d.parts.filter((p) => p.supplierId === id && p.moderation === "approved" && p.status !== "sold");
    return { supplier: publicSupplier(s), parts };
  },

  // ------------------------------------------------------------- inquiries
  /** Logs the inquiry server-side (here: locally) and returns the WhatsApp deep link. */
  async logInquiry(partId: string, lang: "en" | "ar", guestName?: string) {
    const d = await load();
    const part = d.parts.find((p) => p.id === partId);
    if (!part) throw new ApiError("Listing not found", 404);
    const supplier = d.suppliers.find((s) => s.id === part.supplierId)!;
    const u = await me();
    const recent = d.inquiries.filter((i) => i.partId === partId && (u ? i.customerId === u.id : !i.customerId) && Date.now() - new Date(i.createdAt).getTime() < 60_000);
    const message = buildInquiryMessage(part, lang);
    if (recent.length < 3) {
      d.inquiries.unshift({
        id: uid("i"), partId, supplierId: part.supplierId, customerId: u?.id, guestName: u ? undefined : guestName || "Guest",
        message, channel: "whatsapp", createdAt: now(),
      });
      save();
    }
    return { url: whatsappLink(supplier.whatsapp, message), isSample: supplier.isSample || !supplier.whatsapp };
  },

  async reportListing(partId: string, reason: string) {
    const d = await load();
    const u = await me();
    if (reason.trim().length < 5) throw new ApiError("Please describe the problem");
    d.reports.unshift({ id: uid("rep"), partId, reporterId: u?.id, reason: reason.trim().slice(0, 500), status: "open", createdAt: now() });
    save();
  },

  // -------------------------------------------------------------- requests
  async createRequest(input: Omit<PartRequest, "id" | "status" | "matchedSupplierIds" | "createdAt" | "customerId">) {
    const d = await load();
    const u = await me();
    if (!input.contactPhone.trim() && !input.contactEmail?.trim()) throw new ApiError("Please provide a phone number or email");
    const since = Date.now() - 3_600_000;
    const recentFromContact = d.requests.filter((r) => r.contactPhone === input.contactPhone && new Date(r.createdAt).getTime() > since);
    if (recentFromContact.length >= 3) throw new ApiError("Too many requests from this contact. Please try again later.", 429);
    const pt = findPartType(input.partTypeId);
    // Matching: approved suppliers that deal in this make AND this part category.
    const matched = d.suppliers
      .filter((s) => s.status === "approved" && s.makes.includes(input.make) && (!pt || s.categories.includes((pt as { categoryId: string }).categoryId)))
      .sort((a, b) => Number(b.emirate === input.emirate) - Number(a.emirate === input.emirate))
      .map((s) => s.id);
    const req: PartRequest = { ...input, id: uid("r"), customerId: u?.id, status: "open", matchedSupplierIds: matched, createdAt: now() };
    d.requests.unshift(req);
    save();
    return { request: req, matchedCount: matched.length };
  },

  async myRequests() {
    const u = await requireRole("customer", "admin");
    const d = db!;
    return d.requests
      .filter((r) => r.customerId === u.id)
      .map((r) => ({
        request: r,
        quotations: d.quotations.filter((q) => q.requestId === r.id).sort((a, b) => a.price - b.price),
      }));
  },

  async acceptQuotation(quotationId: string) {
    const u = await requireRole("customer");
    const d = db!;
    const q = d.quotations.find((x) => x.id === quotationId);
    const r = q && d.requests.find((x) => x.id === q.requestId);
    if (!q || !r || r.customerId !== u.id) throw new ApiError("Quotation not found", 404);
    d.quotations.filter((x) => x.requestId === r.id).forEach((x) => (x.status = x.id === q.id ? "accepted" : "declined"));
    r.status = "closed";
    save();
    const s = d.suppliers.find((x) => x.id === q.supplierId)!;
    return { supplier: publicSupplier(s), url: whatsappLink(s.whatsapp, `Hello, I accepted your quotation (AED ${q.price}) on UAE AutoParts Hub for request ${r.id}.`) };
  },

  async closeRequest(requestId: string) {
    const u = await requireRole("customer");
    const r = db!.requests.find((x) => x.id === requestId && x.customerId === u.id);
    if (!r) throw new ApiError("Request not found", 404);
    r.status = "closed";
    save();
  },

  // -------------------------------------------------------------- customer
  async favourites() {
    const u = await requireRole("customer", "supplier", "admin");
    const d = db!;
    const ids = d.favourites[u.id] ?? [];
    return { parts: d.parts.filter((p) => ids.includes(p.id)), suppliers: Object.fromEntries(d.suppliers.map((s) => [s.id, publicSupplier(s)])) };
  },

  async isFavourite(partId: string) {
    const u = await me();
    return !!u && (db!.favourites[u.id] ?? []).includes(partId);
  },

  async toggleFavourite(partId: string) {
    const u = await requireRole("customer", "supplier", "admin");
    const list = db!.favourites[u.id] ?? [];
    db!.favourites[u.id] = list.includes(partId) ? list.filter((x) => x !== partId) : [...list, partId];
    save();
    return db!.favourites[u.id].includes(partId);
  },

  async savedVehicles() {
    const u = await requireRole("customer", "supplier", "admin");
    return db!.savedVehicles.filter((v) => v.userId === u.id);
  },

  async addVehicle(v: Omit<SavedVehicle, "id" | "userId">) {
    const u = await requireRole("customer", "supplier", "admin");
    if (v.vin && !/^[A-HJ-NPR-Z0-9]{17}$/i.test(v.vin)) throw new ApiError("VIN must be 17 characters (letters I, O and Q are not used)");
    db!.savedVehicles.push({ ...v, id: uid("v"), userId: u.id });
    save();
  },

  async removeVehicle(id: string) {
    const u = await requireRole("customer", "supplier", "admin");
    db!.savedVehicles = db!.savedVehicles.filter((v) => !(v.id === id && v.userId === u.id));
    save();
  },

  async myInquiries() {
    const u = await requireRole("customer", "supplier", "admin");
    const d = db!;
    return d.inquiries.filter((i) => i.customerId === u.id).map((i) => ({ inquiry: i, part: d.parts.find((p) => p.id === i.partId) }));
  },

  async updatePreferences(p: { marketingConsent: boolean; whatsappConsent: boolean; name?: string; phone?: string }) {
    const u = await requireRole("customer", "supplier", "admin");
    Object.assign(u, p);
    save();
  },

  async deleteAccount() {
    const u = await requireRole("customer");
    const d = db!;
    d.users = d.users.filter((x) => x.id !== u.id);
    d.savedVehicles = d.savedVehicles.filter((v) => v.userId !== u.id);
    delete d.favourites[u.id];
    d.inquiries.forEach((i) => i.customerId === u.id && (i.customerId = undefined));
    d.requests.forEach((r) => {
      if (r.customerId === u.id) {
        r.customerId = undefined;
        r.contactPhone = "deleted";
        r.contactEmail = undefined;
        r.status = "closed";
      }
    });
    storage()?.removeItem(SESSION);
    save();
  },

  // -------------------------------------------------------------- supplier
  async mySupplier() {
    const { supplier } = await requireSupplier();
    return supplier;
  },

  async updateSupplier(patch: Partial<Pick<Supplier, "name" | "nameAr" | "phone" | "whatsapp" | "address" | "emiratesServed" | "makes" | "categories" | "delivery" | "contactName">>) {
    const { user, supplier } = await requireSupplier();
    if (patch.whatsapp && !/^\+?\d[\d\s]{7,15}$/.test(patch.whatsapp)) throw new ApiError("WhatsApp number must be in international format, e.g. +971501234567");
    Object.assign(supplier, patch);
    audit(user.id, "supplier.update_profile", supplier.id);
    save();
    return supplier;
  },

  async uploadSupplierDoc(doc: { name: string; sizeKb: number; kind: "trade-licence" | "emirates-id" | "other" }) {
    const { supplier } = await requireSupplier();
    supplier.docs.push({ ...doc, uploadedAt: now() });
    save();
  },

  async myParts() {
    const { supplier } = await requireSupplier();
    return db!.parts.filter((p) => p.supplierId === supplier.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async savePart(input: Partial<Part> & { id?: string }) {
    const { user, supplier } = await requireSupplier();
    const d = db!;
    const pt = findPartType(input.partTypeId);
    if (!pt) throw new ApiError("Choose a part type");
    if (!input.make || !input.model) throw new ApiError("Choose the vehicle make and model");
    if (!input.yearFrom || !input.yearTo || input.yearTo < input.yearFrom) throw new ApiError("Check the year range");
    if (!input.price || input.price <= 0) throw new ApiError("Enter a price in AED");
    if (pt.safetyCritical && !input.oem) throw new ApiError(`${pt.en} is a safety-critical part — an OEM part number is required`);
    const base = {
      ...input,
      categoryId: (pt as { categoryId: string }).categoryId,
      oem: input.oem ? input.oem.toUpperCase().replace(/\s/g, "") : undefined,
      fitment: input.oem ? ("verified" as const) : ("likely" as const),
      lastVerified: now(),
    };
    if (input.id) {
      const p = d.parts.find((x) => x.id === input.id && x.supplierId === supplier.id);
      if (!p) throw new ApiError("Listing not found", 404);
      Object.assign(p, base, { supplierId: supplier.id, moderation: pt.safetyCritical ? "pending" : p.moderation });
      audit(user.id, "listing.update", p.id);
      save();
      return p;
    }
    const part: Part = {
      id: uid("p"), supplierId: supplier.id, name: input.name || pt.en, categoryId: base.categoryId, partTypeId: pt.id,
      oem: base.oem, make: input.make, model: input.model, generation: input.generation, yearFrom: input.yearFrom, yearTo: input.yearTo,
      engine: input.engine, transmission: input.transmission, marketSpec: input.marketSpec ?? "Unknown",
      condition: input.condition ?? "used", price: Math.round(input.price), quantity: input.quantity ?? 1, warrantyDays: input.warrantyDays ?? 0,
      emirate: supplier.emirate, area: supplier.area, images: input.images?.length ? input.images : [`sample:${base.categoryId}`],
      description: input.description ?? "", donorVehicle: input.donorVehicle, status: "available", lastVerified: now(), createdAt: now(),
      views: 0, featured: false, fitment: base.fitment, moderation: pt.safetyCritical || supplier.status !== "approved" ? "pending" : "approved",
      source: "dashboard", isSample: false,
    };
    d.parts.unshift(part);
    audit(user.id, "listing.create", part.id);
    save();
    return part;
  },

  async setPartStatus(id: string, status: Part["status"]) {
    const { user, supplier } = await requireSupplier();
    const p = db!.parts.find((x) => x.id === id && x.supplierId === supplier.id);
    if (!p) throw new ApiError("Listing not found", 404);
    p.status = status;
    if (status === "sold") p.quantity = 0;
    p.lastVerified = now();
    audit(user.id, `listing.${status}`, id);
    save();
  },

  async verifyStock(ids: string[]) {
    const { supplier } = await requireSupplier();
    db!.parts.forEach((p) => {
      if (ids.includes(p.id) && p.supplierId === supplier.id) p.lastVerified = now();
    });
    save();
  },

  async deletePart(id: string) {
    const { user, supplier } = await requireSupplier();
    const before = db!.parts.length;
    db!.parts = db!.parts.filter((p) => !(p.id === id && p.supplierId === supplier.id));
    if (db!.parts.length === before) throw new ApiError("Listing not found", 404);
    audit(user.id, "listing.delete", id);
    save();
  },

  async importRows(filename: string, rows: RawRow[]) {
    const { user, supplier } = await requireSupplier();
    const d = db!;
    if (rows.length > 5000) throw new ApiError("Maximum 5,000 rows per file");
    const plan = planImport(rows, { supplierId: supplier.id, emirate: supplier.emirate, area: supplier.area, existing: d.parts });
    plan.create.forEach((rec) => d.parts.unshift({ ...rec, id: uid("p"), moderation: supplier.status === "approved" ? rec.moderation : "pending" }));
    plan.update.forEach(({ id, patch }) => Object.assign(d.parts.find((p) => p.id === id)!, patch));
    const job: ImportJob = {
      id: uid("job"), supplierId: supplier.id, filename, createdAt: now(), total: plan.total,
      created: plan.create.length, updated: plan.update.length, duplicates: plan.duplicates, errors: plan.errors,
    };
    d.imports.unshift(job);
    audit(user.id, "inventory.import", job.id);
    save();
    return job;
  },

  async myImports() {
    const { supplier } = await requireSupplier();
    return db!.imports.filter((j) => j.supplierId === supplier.id);
  },

  async supplierInquiries() {
    const { supplier } = await requireSupplier();
    const d = db!;
    return d.inquiries.filter((i) => i.supplierId === supplier.id).map((i) => ({ inquiry: i, part: d.parts.find((p) => p.id === i.partId) }));
  },

  async matchedRequests() {
    const { supplier } = await requireSupplier();
    const d = db!;
    return d.requests
      .filter((r) => r.matchedSupplierIds.includes(supplier.id))
      .map((r) => {
        const mine = d.quotations.find((q) => q.requestId === r.id && q.supplierId === supplier.id);
        return { request: redactRequest(r, mine?.status === "accepted"), myQuotation: mine };
      });
  },

  async submitQuotation(input: Omit<Quotation, "id" | "supplierId" | "status" | "createdAt">) {
    const { user, supplier } = await requireSupplier();
    if (supplier.status !== "approved") throw new ApiError("Your account must be approved before you can send quotations", 403);
    const d = db!;
    const r = d.requests.find((x) => x.id === input.requestId);
    if (!r || !r.matchedSupplierIds.includes(supplier.id)) throw new ApiError("Request not found", 404);
    if (r.status !== "open") throw new ApiError("This request is closed");
    if (!(input.price > 0)) throw new ApiError("Enter a price in AED");
    const existing = d.quotations.find((q) => q.requestId === r.id && q.supplierId === supplier.id);
    if (existing) Object.assign(existing, input, { createdAt: now() });
    else d.quotations.push({ ...input, id: uid("q"), supplierId: supplier.id, status: "submitted", createdAt: now() });
    audit(user.id, "quotation.submit", r.id);
    save();
  },

  async supplierStats() {
    const { supplier } = await requireSupplier();
    const d = db!;
    const parts = d.parts.filter((p) => p.supplierId === supplier.id);
    const stale = Date.now() - 30 * 86_400_000;
    return {
      total: parts.length,
      available: parts.filter((p) => p.status === "available").reduce((n, p) => n + p.quantity, 0),
      inquiries: d.inquiries.filter((i) => i.supplierId === supplier.id).length,
      quotations: d.quotations.filter((q) => q.supplierId === supplier.id).length,
      needsVerification: parts.filter((p) => p.status !== "sold" && new Date(p.lastVerified).getTime() < stale).length,
      pendingModeration: parts.filter((p) => p.moderation === "pending").length,
      mostViewed: [...parts].sort((a, b) => b.views - a.views).slice(0, 5),
    };
  },

  async regenerateApiKey() {
    const { user, supplier } = await requireSupplier();
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    supplier.apiKey = "uaeph_demo_" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
    audit(user.id, "supplier.api_key_rotate", supplier.id);
    save();
    return supplier.apiKey;
  },

  // ----------------------------------------------------------------- admin
  async adminOverview() {
    await requireRole("admin");
    const d = db!;
    const weeks = Array.from({ length: 8 }, (_, i) => 7 - i);
    const weekly = (dates: string[]) =>
      weeks.map((w) => dates.filter((x) => {
        const age = (Date.now() - new Date(x).getTime()) / 86_400_000;
        return age >= w * 7 && age < (w + 1) * 7;
      }).length);
    const cumulative = (dates: string[]) => weeks.map((w) => dates.filter((x) => Date.now() - new Date(x).getTime() >= w * 7 * 86_400_000).length);
    const responded = d.requests.filter((r) => d.quotations.some((q) => q.requestId === r.id)).length;
    return {
      suppliers: { approved: d.suppliers.filter((s) => s.status === "approved").length, pending: d.suppliers.filter((s) => s.status === "pending").length },
      listings: d.parts.filter((p) => p.status !== "sold").length,
      pendingListings: d.parts.filter((p) => p.moderation === "pending").length,
      openReports: d.reports.filter((r) => r.status === "open").length,
      inquiries30d: d.inquiries.filter((i) => Date.now() - new Date(i.createdAt).getTime() < 30 * 86_400_000).length,
      responseRate: d.requests.length ? Math.round((responded / d.requests.length) * 100) : 0,
      charts: {
        supplierGrowth: cumulative(d.suppliers.map((s) => s.createdAt)),
        inventory: cumulative(d.parts.map((p) => p.createdAt)),
        inquiries: weekly(d.inquiries.map((i) => i.createdAt)),
        searches: d.searches.slice(-30),
      },
    };
  },

  async adminSuppliers() {
    await requireRole("admin");
    const d = db!;
    return d.suppliers.map((s) => ({ ...s, listings: d.parts.filter((p) => p.supplierId === s.id).length }));
  },

  async setSupplierStatus(id: string, status: Supplier["status"]) {
    const u = await requireRole("admin");
    const s = db!.suppliers.find((x) => x.id === id);
    if (!s) throw new ApiError("Supplier not found", 404);
    s.status = status;
    if (status === "approved") {
      // Listings created while pending become visible, except safety-critical ones that still need review.
      db!.parts.forEach((p) => {
        if (p.supplierId === id && p.moderation === "pending" && !findPartType(p.partTypeId)?.safetyCritical) p.moderation = "approved";
      });
    }
    audit(u.id, `supplier.${status}`, id);
    save();
  },

  async toggleSupplierFeatured(id: string) {
    const u = await requireRole("admin");
    const s = db!.suppliers.find((x) => x.id === id)!;
    s.featured = !s.featured;
    audit(u.id, "supplier.feature", id);
    save();
  },

  async adminListings(filter: "pending" | "all" | "stale" | "featured") {
    await requireRole("admin");
    const d = db!;
    const stale = Date.now() - 30 * 86_400_000;
    const list = d.parts.filter((p) =>
      filter === "pending" ? p.moderation === "pending"
        : filter === "stale" ? p.status !== "sold" && new Date(p.lastVerified).getTime() < stale
        : filter === "featured" ? p.featured
        : true,
    );
    return { parts: list, suppliers: Object.fromEntries(d.suppliers.map((s) => [s.id, s])) };
  },

  async moderatePart(id: string, decision: "approved" | "rejected") {
    const u = await requireRole("admin");
    const p = db!.parts.find((x) => x.id === id);
    if (!p) throw new ApiError("Listing not found", 404);
    p.moderation = decision;
    audit(u.id, `listing.${decision}`, id);
    save();
  },

  async toggleFeatured(id: string) {
    const u = await requireRole("admin");
    const p = db!.parts.find((x) => x.id === id)!;
    p.featured = !p.featured;
    audit(u.id, "listing.feature", id);
    save();
  },

  async adminDuplicates() {
    await requireRole("admin");
    return findDuplicateGroups(db!.parts);
  },

  async adminRemovePart(id: string) {
    const u = await requireRole("admin");
    db!.parts = db!.parts.filter((p) => p.id !== id);
    audit(u.id, "listing.remove", id);
    save();
  },

  async adminImports() {
    await requireRole("admin");
    return db!.imports;
  },

  async adminInquiries() {
    await requireRole("admin");
    const d = db!;
    return {
      inquiries: d.inquiries.slice(0, 100).map((i) => ({ inquiry: i, part: d.parts.find((p) => p.id === i.partId) })),
      requests: d.requests.map((r) => ({ request: r, quotes: d.quotations.filter((q) => q.requestId === r.id).length })),
    };
  },

  async adminReports() {
    await requireRole("admin");
    const d = db!;
    return d.reports.map((r) => ({ report: r, part: d.parts.find((p) => p.id === r.partId) }));
  },

  async resolveReport(id: string, action: "dismiss" | "remove-listing") {
    const u = await requireRole("admin");
    const r = db!.reports.find((x) => x.id === id);
    if (!r) throw new ApiError("Report not found", 404);
    r.status = "resolved";
    if (action === "remove-listing") {
      const p = db!.parts.find((x) => x.id === r.partId);
      if (p) p.moderation = "rejected";
    }
    audit(u.id, `report.${action}`, id);
    save();
  },

  async plans() {
    return (await load()).plans;
  },

  async updatePlan(id: string, patch: Partial<Plan>) {
    const u = await requireRole("admin");
    const p = db!.plans.find((x) => x.id === id);
    if (!p) throw new ApiError("Plan not found", 404);
    Object.assign(p, patch);
    audit(u.id, "plan.update", id);
    save();
  },

  async auditLog() {
    await requireRole("admin");
    const d = db!;
    return d.audit.slice(0, 200).map((a) => ({ ...a, actor: d.users.find((u) => u.id === a.actorId)?.email ?? a.actorId }));
  },
};

export type Backend = typeof demoBackend;
