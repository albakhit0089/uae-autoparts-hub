import { describe, expect, it } from "vitest";
import { planImport, templateCsv, TEMPLATE_COLUMNS } from "../lib/importer";
import type { Part } from "../lib/types";
import { whatsappLink, buildInquiryMessage } from "../lib/whatsapp";
import { seedParts, seedSuppliers } from "../lib/data/seed";

const ctx = { supplierId: "sX", emirate: "sharjah" as const, area: "al-sajaa", existing: [] as Part[], now: "2026-01-01T00:00:00.000Z" };

describe("planImport", () => {
  it("normalizes vehicle names, part types and conditions", () => {
    const plan = planImport(
      [{ sku: "A1", part_type: "Gear Box", make: "mercedes benz", model: "C200", year_from: "2015", year_to: "2018", price_aed: "2,750", condition: "Tested" }],
      ctx,
    );
    expect(plan.errors).toEqual([]);
    expect(plan.create[0]).toMatchObject({ make: "mercedes-benz", model: "c-class", partTypeId: "gearbox", categoryId: "transmission", price: 2750, condition: "tested", source: "csv" });
  });

  it("reports invalid rows with row numbers", () => {
    const plan = planImport([{ make: "Tesla?", model: "X", part_type: "flux", year_from: "1900", price_aed: "-5" }], ctx);
    expect(plan.create).toHaveLength(0);
    expect(plan.errors[0].row).toBe(2);
    expect(plan.errors[0].message).toMatch(/Unknown make/);
  });

  it("detects duplicates inside the file and updates by sku", () => {
    const row = { part_type: "alternator", make: "Toyota", model: "Camry", year_from: "2018", year_to: "2020", price_aed: "450" };
    const plan = planImport([row, row], ctx);
    expect(plan.create).toHaveLength(1);
    expect(plan.duplicates).toBe(1);

    const existing = [{ ...plan.create[0], id: "p1", sku: "SKU-9" } as Part];
    const plan2 = planImport([{ ...row, sku: "SKU-9", price_aed: "500" }], { ...ctx, existing });
    expect(plan2.update).toEqual([expect.objectContaining({ id: "p1", patch: expect.objectContaining({ price: 500 }) })]);
  });

  it("requires OEM numbers for safety-critical parts and holds them for review", () => {
    const base = { part_type: "brake caliper", make: "Toyota", model: "Land Cruiser", year_from: "2016", price_aed: "400" };
    expect(planImport([base], ctx).errors[0].message).toMatch(/safety-critical/);
    const ok = planImport([{ ...base, oem_number: "47730-60" }], ctx);
    expect(ok.create[0].moderation).toBe("pending");
  });

  it("produces a template containing every column", () => {
    const header = templateCsv().split("\n")[0].split(",");
    expect(header).toEqual([...TEMPLATE_COLUMNS]);
  });
});

describe("whatsapp", () => {
  it("builds a prefilled click-to-chat link", () => {
    const p = seedParts(seedSuppliers())[0];
    const msg = buildInquiryMessage(p, "en");
    expect(msg).toContain("UAE AutoParts Hub");
    expect(msg).toContain("Please confirm the price, condition, compatibility, and warranty");
    expect(whatsappLink("+971 50 123 4567", "hi")).toBe("https://wa.me/971501234567?text=hi");
    expect(whatsappLink("", "hi")).toBe("https://wa.me/?text=hi");
  });
});
