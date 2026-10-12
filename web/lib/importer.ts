/**
 * Bulk inventory import (Method A — supplier CSV / Excel uploads).
 *
 * Validates each row, standardizes vehicle names and part categories against
 * the platform taxonomy, detects duplicates (inside the file and against the
 * supplier's existing stock) and produces an import report. Rows with a `sku`
 * that already exists for the supplier update that listing instead.
 *
 * The backend mirrors this in api/app/services/importer.py.
 */
import { ALL_PART_TYPES } from "./data/taxonomy";
import { MAKES } from "./data/vehicles";
import { duplicateKey, normalize, normalizeOem, tokenMatches } from "./search";
import type { Condition, ListingStatus, Part } from "./types";

export const TEMPLATE_COLUMNS = [
  "sku", "part_name", "part_type", "oem_number", "make", "model", "generation", "year_from", "year_to",
  "engine_code", "transmission", "market_spec", "condition", "price_aed", "quantity", "warranty_days",
  "description", "donor_vehicle", "status",
] as const;

export const TEMPLATE_EXAMPLE: Record<(typeof TEMPLATE_COLUMNS)[number], string> = {
  sku: "SAJ-0001",
  part_name: "Automatic gearbox 7G-Tronic",
  part_type: "gearbox",
  oem_number: "",
  make: "Mercedes-Benz",
  model: "C-Class",
  generation: "W205",
  year_from: "2015",
  year_to: "2018",
  engine_code: "M274",
  transmission: "7G-Tronic Plus",
  market_spec: "GCC",
  condition: "tested",
  price_aed: "2750",
  quantity: "1",
  warranty_days: "30",
  description: "Removed from running vehicle, 92,000 km",
  donor_vehicle: "2015 C200 GCC",
  status: "available",
};

export function templateCsv(): string {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [TEMPLATE_COLUMNS.join(","), TEMPLATE_COLUMNS.map((c) => esc(TEMPLATE_EXAMPLE[c])).join(",")].join("\n") + "\n";
}

export type RawRow = Record<string, string | number | undefined | null>;

export interface ImportPlan {
  create: Omit<Part, "id">[];
  update: { id: string; patch: Partial<Part> }[];
  duplicates: number;
  errors: { row: number; message: string }[];
  total: number;
}

function resolveMake(v: string): string | undefined {
  const n = normalize(v);
  if (!n) return undefined;
  for (const m of MAKES) {
    const names = [m.id, m.name, m.nameAr, ...m.aliases].map(normalize);
    if (names.includes(n) || names.some((x) => tokenMatches(n, x))) return m.id;
  }
  return undefined;
}

function resolveModel(makeId: string, v: string): string | undefined {
  const n = normalize(v);
  const make = MAKES.find((m) => m.id === makeId);
  if (!make || !n) return undefined;
  for (const md of make.models) {
    const names = [md.id, md.name, md.nameAr, md.id.replace(/-/g, " "), ...md.aliases].map(normalize);
    if (names.includes(n) || names.some((x) => tokenMatches(n, x))) return md.id;
    const variants = md.generations.flatMap((g) => g.variants.map((x) => normalize(x.name)));
    if (variants.includes(n)) return md.id;
  }
  return undefined;
}

export function resolvePartType(v: string): (typeof ALL_PART_TYPES)[number] | undefined {
  const n = normalize(v);
  if (!n) return undefined;
  return (
    ALL_PART_TYPES.find((t) => t.id === n || normalize(t.en) === n || normalize(t.ar) === n) ??
    ALL_PART_TYPES.find((t) => t.synonyms.some((s) => normalize(s) === n)) ??
    ALL_PART_TYPES.find((t) => t.synonyms.some((s) => tokenMatches(n, normalize(s))))
  );
}

const CONDITIONS: Record<string, Condition> = {
  used: "used", "مستعمل": "used", tested: "tested", "مفحوص": "tested", refurbished: "refurbished", rebuilt: "refurbished", "مجدد": "refurbished",
};

const str = (v: unknown) => (v == null ? "" : String(v).trim());

export function planImport(rows: RawRow[], ctx: { supplierId: string; emirate: Part["emirate"]; area: string; existing: Part[]; now?: string }): ImportPlan {
  const now = ctx.now ?? new Date().toISOString();
  const plan: ImportPlan = { create: [], update: [], duplicates: 0, errors: [], total: rows.length };
  const mine = ctx.existing.filter((p) => p.supplierId === ctx.supplierId);
  const bySku = new Map(mine.filter((p) => p.sku).map((p) => [p.sku!, p]));
  const seenKeys = new Set(mine.filter((p) => p.status !== "sold").map(duplicateKey));
  const seenSkus = new Set<string>();

  rows.forEach((raw, idx) => {
    const rowNo = idx + 2; // header is row 1
    const row: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) row[k.trim().toLowerCase().replace(/\s+/g, "_")] = str(v);
    if (Object.values(row).every((v) => !v)) {
      plan.total--;
      return;
    }
    const errs: string[] = [];

    const make = resolveMake(row.make);
    if (!make) errs.push(`Unknown make "${row.make}"`);
    const model = make ? resolveModel(make, row.model) : undefined;
    if (make && !model) errs.push(`Unknown model "${row.model}" for ${make}`);
    const pt = resolvePartType(row.part_type || row.part_name);
    if (!pt) errs.push(`Could not map part type "${row.part_type || row.part_name}" to the taxonomy`);
    const yearFrom = parseInt(row.year_from, 10);
    const yearTo = parseInt(row.year_to || row.year_from, 10);
    if (!(yearFrom >= 1980 && yearFrom <= 2030)) errs.push("year_from must be between 1980 and 2030");
    if (!(yearTo >= yearFrom && yearTo <= 2030)) errs.push("year_to must be ≥ year_from");
    const price = parseFloat(row.price_aed?.replace(/,/g, ""));
    if (!(price > 0 && price < 1_000_000)) errs.push("price_aed must be a positive number");
    const quantity = row.quantity ? parseInt(row.quantity, 10) : 1;
    if (!(quantity >= 0 && quantity < 10000)) errs.push("quantity must be a whole number");
    const condition = CONDITIONS[normalize(row.condition || "used")];
    if (!condition) errs.push(`condition must be used, tested or refurbished`);
    const warrantyDays = row.warranty_days ? parseInt(row.warranty_days, 10) : 0;
    if (!(warrantyDays >= 0 && warrantyDays <= 730)) errs.push("warranty_days must be 0–730");
    const status = (["available", "reserved", "sold"].includes(row.status) ? row.status : "available") as ListingStatus;
    if (pt?.safetyCritical && !row.oem_number) errs.push(`${pt.en} is safety-critical: oem_number is required`);
    if (row.sku && seenSkus.has(row.sku)) errs.push(`Duplicate sku "${row.sku}" inside the file`);

    if (errs.length) {
      plan.errors.push({ row: rowNo, message: errs.join("; ") });
      return;
    }
    if (row.sku) seenSkus.add(row.sku);

    const record: Omit<Part, "id"> = {
      supplierId: ctx.supplierId,
      sku: row.sku || undefined,
      name: row.part_name || pt!.en,
      categoryId: pt!.categoryId,
      partTypeId: pt!.id,
      oem: row.oem_number ? normalizeOem(row.oem_number) : undefined,
      make: make!,
      model: model!,
      generation: row.generation || undefined,
      yearFrom,
      yearTo,
      engine: row.engine_code || undefined,
      transmission: row.transmission || undefined,
      marketSpec: row.market_spec?.toUpperCase() === "GCC" ? "GCC" : row.market_spec ? "Imported" : "Unknown",
      condition: condition!,
      price: Math.round(price),
      quantity,
      warrantyDays,
      emirate: ctx.emirate,
      area: ctx.area,
      images: [`sample:${pt!.categoryId}`],
      description: row.description || "",
      donorVehicle: row.donor_vehicle || undefined,
      status: quantity === 0 ? "sold" : status,
      lastVerified: now,
      createdAt: now,
      views: 0,
      featured: false,
      fitment: row.oem_number ? "verified" : "likely",
      moderation: pt!.safetyCritical ? "pending" : "approved",
      source: "csv",
      isSample: false,
    };

    const existing = row.sku ? bySku.get(row.sku) : undefined;
    if (existing) {
      // Keep the listing's history (creation date, views, featured flag) on update.
      const patch: Partial<Part> = { ...record };
      delete patch.createdAt;
      delete patch.views;
      delete patch.featured;
      plan.update.push({ id: existing.id, patch });
      return;
    }
    const key = duplicateKey(record);
    if (seenKeys.has(key)) {
      plan.duplicates++;
      plan.errors.push({ row: rowNo, message: "Duplicate of an existing listing (same part type and OEM / fitment) — skipped" });
      return;
    }
    seenKeys.add(key);
    plan.create.push(record);
  });
  return plan;
}
