/**
 * Search & natural-language query understanding.
 *
 * The parser is deterministic and grounded: it only *extracts* structured
 * filters from the user's text (make, model, year, part type, emirate, budget,
 * OEM number…). Results always come from the inventory records passed in —
 * nothing here invents listings, prices or compatibility.
 *
 * The same algorithm is implemented server-side in api/app/services/query_parser.py.
 */
import { CATEGORIES, ALL_PART_TYPES } from "./data/taxonomy";
import { EMIRATES } from "./data/emirates";
import { MAKES } from "./data/vehicles";
import type { Compatibility, Condition, Emirate, Part, SearchFilters } from "./types";

// ---------------------------------------------------------------- text utils

const AR_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(AR_DIACRITICS, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/mercedes[-\s]?benz/g, "mercedes")
    .replace(/\b([a-z])\s(\d{2,3})\b/g, "$1$2") // "c 200" → "c200"
    .replace(/(\d)[,٬](?=\d{3}\b)/g, "$1") // thousands separators: 3,000 → 3000
    .replace(/[^\p{L}\p{N}\s\-./]/gu, " ")
    .replace(/[.\-/]+(\s|$)/g, " ") // trailing punctuation
    .replace(/\s+/g, " ")
    .trim();
}

export const normalizeOem = (s: string) => s.toUpperCase().replace(/[\s\-./]/g, "");

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const isArabic = (s: string) => /[؀-ۿ]/.test(s);
const stripAl = (s: string) => (isArabic(s) && s.startsWith("ال") && s.length > 4 ? s.slice(2) : s);

/** Token equality with Arabic "ال" prefix handling and typo tolerance. */
export function tokenMatches(token: string, target: string): boolean {
  if (token === target) return true;
  const a = stripAl(token);
  const b = stripAl(target);
  if (a === b) return true;
  if (/\d/.test(a) || /\d/.test(b)) return false; // never fuzzy-match codes / numbers
  const len = Math.min(a.length, b.length);
  if (len < 5) return false;
  const allowed = len >= 7 ? 2 : 1;
  return levenshtein(a, b) <= allowed;
}

interface Span {
  start: number;
  end: number; // exclusive
}

/** Find phrase (sequence of tokens) inside tokens, skipping consumed ones. */
function findPhrase(tokens: string[], used: boolean[], phrase: string): Span | null {
  const p = normalize(phrase).split(" ").filter(Boolean);
  if (!p.length) return null;
  for (let i = 0; i + p.length <= tokens.length; i++) {
    let ok = true;
    for (let k = 0; k < p.length; k++) {
      if (used[i + k] || !tokenMatches(tokens[i + k], p[k])) {
        ok = false;
        break;
      }
    }
    if (ok) return { start: i, end: i + p.length };
  }
  return null;
}

function consume(used: boolean[], s: Span) {
  for (let i = s.start; i < s.end; i++) used[i] = true;
}

// ------------------------------------------------------------- query parser

export interface ParsedQuery {
  make?: string;
  model?: string;
  variant?: string;
  engine?: string;
  year?: number;
  partType?: string;
  category?: string;
  emirate?: Emirate;
  maxPrice?: number;
  minPrice?: number;
  oem?: string;
  condition?: Condition;
  warranty?: boolean;
  /** Tokens that were not understood — used as free-text keywords. */
  keywords: string[];
}

const STOP_WORDS = new Set(
  (
    "i need want looking for a an the for of in at to my car used second hand please with from any is are me find " +
    "price aed dhs dirham cheap good original genuine part parts spare spares " +
    "انا ابي ابغى اريد احتاج ابحث عن في من على الى مع لسياره سياره قطعه قطع غيار مستعمل مستعمله سعر درهم لو سمحت"
  ).split(" "),
);

const PRICE_RE =
  /(under|below|less than|max|maximum|up to|upto|budget|within|<|اقل من|تحت|بحدود|ميزانيه|لا يزيد عن)\s*(?:of\s*)?(?:aed|dhs|درهم)?\s*(\d[\d,.]*)\s*(k|الف)?\s*(?:aed|dhs|درهم)?/;
const MIN_PRICE_RE = /(over|above|more than|from|min|اكثر من|فوق)\s*(?:aed|dhs|درهم)?\s*(\d[\d,.]*)\s*(k|الف)?/;
const YEAR_RE = /\b(19[89]\d|20[0-3]\d)\b/;

function toAmount(num: string, k?: string) {
  const n = parseFloat(num.replace(/,/g, ""));
  return Math.round(k ? n * 1000 : n);
}

export function parseQuery(raw: string): ParsedQuery {
  const out: ParsedQuery = { keywords: [] };
  let text = normalize(raw);

  const price = text.match(PRICE_RE);
  if (price) {
    out.maxPrice = toAmount(price[2], price[3]);
    text = text.replace(price[0], " ");
  }
  const minPrice = text.match(MIN_PRICE_RE);
  if (minPrice) {
    out.minPrice = toAmount(minPrice[2], minPrice[3]);
    text = text.replace(minPrice[0], " ");
  }
  const year = text.match(YEAR_RE);
  if (year) {
    out.year = parseInt(year[1], 10);
    text = text.replace(year[0], " ");
  }

  const tokens = text.split(" ").filter(Boolean);
  const used = tokens.map(() => false);

  // OEM numbers: long alphanumeric tokens containing at least 5 digits.
  tokens.forEach((t, i) => {
    const compact = t.replace(/[\-./]/g, "");
    if (!out.oem && compact.length >= 8 && (compact.match(/\d/g) || []).length >= 5 && /^[a-z0-9]+$/.test(compact)) {
      out.oem = normalizeOem(t);
      used[i] = true;
    }
  });

  // Emirate
  for (const e of EMIRATES) {
    for (const alias of [e.en, e.ar, ...e.aliases]) {
      const s = findPhrase(tokens, used, alias);
      if (s) {
        out.emirate = e.id;
        consume(used, s);
        break;
      }
    }
    if (out.emirate) break;
  }

  // Part type — longest synonyms first so "automatic transmission" beats "transmission".
  const synonyms = ALL_PART_TYPES.flatMap((t) => [t.en, t.ar, ...t.synonyms].map((s) => ({ s, t })))
    .sort((a, b) => normalize(b.s).split(" ").length - normalize(a.s).split(" ").length || b.s.length - a.s.length);
  for (const { s, t } of synonyms) {
    const span = findPhrase(tokens, used, s);
    if (span) {
      out.partType = t.id;
      out.category = t.categoryId;
      consume(used, span);
      break;
    }
  }
  if (!out.partType) {
    for (const c of CATEGORIES) {
      const span = findPhrase(tokens, used, c.en) || findPhrase(tokens, used, c.ar);
      if (span) {
        out.category = c.id;
        consume(used, span);
        break;
      }
    }
  }

  // Make
  for (const m of MAKES) {
    for (const alias of [m.name, m.nameAr, m.id, ...m.aliases]) {
      const s = findPhrase(tokens, used, alias);
      if (s) {
        out.make = m.id;
        consume(used, s);
        break;
      }
    }
    if (out.make) break;
  }

  // Model / variant (may also infer make, e.g. "c200" → Mercedes-Benz C-Class)
  const makes = out.make ? MAKES.filter((m) => m.id === out.make) : MAKES;
  outer: for (const mk of makes) {
    for (const md of mk.models) {
      // Variant names first (most specific): C200, LX570, 320i…
      for (const g of md.generations) {
        for (const v of g.variants) {
          const vName = v.name.split(" ")[0];
          if (!/^[a-z]*\d+[a-z]*$/i.test(vName) || /^\d+$/.test(vName)) continue; // skip "2.5", "GXR 4.6" etc.
          const s = findPhrase(tokens, used, vName);
          if (s) {
            out.make = mk.id;
            out.model = md.id;
            out.variant = v.name;
            consume(used, s);
            break outer;
          }
        }
      }
      for (const alias of [md.name, md.nameAr, md.id.replace(/-/g, " "), ...md.aliases]) {
        const s = findPhrase(tokens, used, alias);
        if (s) {
          out.make = mk.id;
          out.model = md.id;
          consume(used, s);
          break outer;
        }
      }
    }
  }

  // Resolve engine code from variant + year where unambiguous.
  if (out.make && out.model && out.variant) {
    const md = MAKES.find((m) => m.id === out.make)!.models.find((m) => m.id === out.model)!;
    const codes = new Set(
      md.generations
        .filter((g) => !out.year || (out.year >= g.yearFrom && out.year <= g.yearTo))
        .flatMap((g) => g.variants.filter((v) => v.name === out.variant).map((v) => v.engineCode)),
    );
    if (codes.size === 1) out.engine = [...codes][0];
  }

  // Condition / warranty
  tokens.forEach((t, i) => {
    if (used[i]) return;
    if (["refurbished", "rebuilt", "reconditioned", "مجدد"].some((w) => tokenMatches(t, w))) {
      out.condition = "refurbished";
      used[i] = true;
    } else if (["tested", "مفحوص", "مجرب"].some((w) => tokenMatches(t, w))) {
      out.condition = "tested";
      used[i] = true;
    } else if (["warranty", "guarantee", "ضمان", "كفاله"].some((w) => tokenMatches(t, w))) {
      out.warranty = true;
      used[i] = true;
    }
  });

  out.keywords = tokens.filter((t, i) => !used[i] && !STOP_WORDS.has(t) && !STOP_WORDS.has(stripAl(t)) && t.length > 1);
  return out;
}

// -------------------------------------------------------- compatibility

export interface VehicleContext {
  make?: string;
  model?: string;
  year?: number;
  engine?: string;
  oem?: string;
}

/**
 * Compatibility is never guaranteed from make/model/year alone.
 *  - verified: OEM number matches the customer's, or the supplier supplied
 *    OEM-backed fitment AND the engine code matches the customer's vehicle.
 *  - likely: make/model/year (and engine, where known) match.
 *  - confirm: anything else — the customer must confirm with the supplier.
 */
export function assessCompatibility(part: Part, v: VehicleContext): Compatibility {
  if (v.oem && part.oem && normalizeOem(v.oem) === normalizeOem(part.oem)) return "verified";
  const hasVehicle = !!(v.make && v.model && v.year);
  if (!hasVehicle) return part.fitment === "verified" ? "likely" : "confirm";
  if (part.make !== v.make || part.model !== v.model || v.year! < part.yearFrom || v.year! > part.yearTo) return "confirm";
  if (part.engine && v.engine) {
    if (part.engine !== v.engine) return "confirm";
    return part.fitment === "verified" && part.oem ? "verified" : "likely";
  }
  if (part.engine && !v.engine) return "likely"; // engine-specific part, engine unknown
  return part.fitment === "verified" && part.oem ? "likely" : part.fitment === "confirm" ? "confirm" : "likely";
}

// -------------------------------------------------------------- searching

export interface SearchResult {
  part: Part;
  score: number;
  compatibility: Compatibility;
}

export interface SearchOutcome {
  results: SearchResult[];
  parsed?: ParsedQuery;
  applied: SearchFilters;
}

export function mergeFilters(filters: SearchFilters): { applied: SearchFilters; parsed?: ParsedQuery } {
  if (!filters.q?.trim()) return { applied: { ...filters } };
  const parsed = parseQuery(filters.q);
  const applied: SearchFilters = {
    ...filters,
    make: filters.make || parsed.make,
    model: filters.model || parsed.model,
    year: filters.year || parsed.year,
    engine: filters.engine || parsed.engine,
    partType: filters.partType || parsed.partType,
    category: filters.category || parsed.category,
    emirate: filters.emirate || parsed.emirate,
    maxPrice: filters.maxPrice ?? parsed.maxPrice,
    minPrice: filters.minPrice ?? parsed.minPrice,
    oem: filters.oem || parsed.oem,
    condition: filters.condition || parsed.condition,
    warranty: filters.warranty || parsed.warranty,
  };
  return { applied, parsed };
}

export function searchParts(parts: Part[], filters: SearchFilters, opts: { includeSold?: boolean } = {}): SearchOutcome {
  const { applied, parsed } = mergeFilters(filters);
  const keywords = parsed?.keywords ?? [];
  const structured = !!(applied.make || applied.partType || applied.category || applied.oem || applied.model);
  const oem = applied.oem ? normalizeOem(applied.oem) : undefined;

  const results: SearchResult[] = [];
  for (const p of parts) {
    if (p.moderation !== "approved") continue;
    if (!opts.includeSold && p.status === "sold") continue;
    if (oem) {
      if (!p.oem || normalizeOem(p.oem) !== oem) continue;
    }
    if (applied.make && p.make !== applied.make) continue;
    if (applied.model && p.model !== applied.model) continue;
    if (applied.year && (applied.year < p.yearFrom || applied.year > p.yearTo)) continue;
    if (applied.engine && p.engine && p.engine !== applied.engine) continue;
    if (applied.transmission && p.transmission && !p.transmission.toLowerCase().includes(applied.transmission.toLowerCase())) continue;
    if (applied.partType && p.partTypeId !== applied.partType) continue;
    if (applied.category && p.categoryId !== applied.category) continue;
    if (applied.emirate && p.emirate !== applied.emirate) continue;
    if (applied.area && p.area !== applied.area) continue;
    if (applied.maxPrice != null && p.price > applied.maxPrice) continue;
    if (applied.minPrice != null && p.price < applied.minPrice) continue;
    if (applied.condition && p.condition !== applied.condition) continue;
    if (applied.warranty && p.warrantyDays <= 0) continue;

    let score = 1;
    if (keywords.length) {
      const hay = normalize(`${p.name} ${p.description} ${p.oem ?? ""} ${p.engine ?? ""} ${p.donorVehicle ?? ""}`).split(" ");
      const hits = keywords.filter((k) => hay.some((h) => tokenMatches(h, k) || (k.length >= 4 && h.startsWith(k)))).length;
      if (!structured && hits === 0) continue; // pure free-text search must match something
      score += hits * 2;
    }
    if (p.featured) score += 1.5;
    if (p.status === "available") score += 1;
    if (p.fitment === "verified") score += 0.5;
    const ageDays = (Date.now() - new Date(p.lastVerified).getTime()) / 86_400_000;
    score += Math.max(0, 1 - ageDays / 60);

    results.push({
      part: p,
      score,
      compatibility: assessCompatibility(p, { make: applied.make, model: applied.model, year: applied.year, engine: applied.engine, oem: applied.oem }),
    });
  }

  const sort = applied.sort ?? "relevance";
  results.sort((a, b) => {
    if (sort === "price-asc") return a.part.price - b.part.price;
    if (sort === "price-desc") return b.part.price - a.part.price;
    if (sort === "newest") return b.part.createdAt.localeCompare(a.part.createdAt);
    return b.score - a.score || a.part.price - b.part.price;
  });

  return { results, parsed, applied };
}

/** Suggest relaxed searches when nothing matches. */
export function relaxations(applied: SearchFilters): { label: string; filters: SearchFilters }[] {
  const base = { ...applied, q: undefined };
  const out: { label: string; filters: SearchFilters }[] = [];
  if (applied.emirate) out.push({ label: "relaxEmirate", filters: { ...base, emirate: undefined, area: undefined } });
  if (applied.maxPrice != null) out.push({ label: "relaxBudget", filters: { ...base, maxPrice: undefined } });
  if (applied.year) out.push({ label: "relaxYear", filters: { ...base, year: undefined, engine: undefined } });
  if (applied.condition || applied.warranty) out.push({ label: "relaxCondition", filters: { ...base, condition: undefined, warranty: undefined } });
  return out;
}

// --------------------------------------------------------- comparison & dupes

/**
 * Listings considered "the same part" for price comparison: identical OEM
 * number, or (when no OEM is known) same part type + make + model + engine with
 * overlapping year range. Different variants are never merged on description
 * similarity alone.
 */
export function comparableParts(base: Part, parts: Part[]): { part: Part; basis: "oem" | "fitment" }[] {
  const out: { part: Part; basis: "oem" | "fitment" }[] = [];
  for (const p of parts) {
    if (p.moderation !== "approved" || p.status === "sold") continue;
    if (base.oem && p.oem) {
      if (normalizeOem(base.oem) === normalizeOem(p.oem)) out.push({ part: p, basis: "oem" });
      continue;
    }
    const sameFitment =
      p.partTypeId === base.partTypeId &&
      p.make === base.make &&
      p.model === base.model &&
      (p.engine ?? "") === (base.engine ?? "") &&
      p.yearFrom <= base.yearTo &&
      p.yearTo >= base.yearFrom;
    if (sameFitment) out.push({ part: p, basis: "fitment" });
  }
  return out.sort((a, b) => a.part.price - b.part.price);
}

export function duplicateKey(p: Pick<Part, "supplierId" | "partTypeId" | "oem" | "make" | "model" | "yearFrom" | "yearTo" | "engine">) {
  return p.oem
    ? `${p.supplierId}|${p.partTypeId}|${normalizeOem(p.oem)}`
    : `${p.supplierId}|${p.partTypeId}|${p.make}|${p.model}|${p.yearFrom}-${p.yearTo}|${p.engine ?? ""}`;
}

export function findDuplicateGroups(parts: Part[]): Part[][] {
  const map = new Map<string, Part[]>();
  for (const p of parts) {
    if (p.status === "sold") continue;
    const k = duplicateKey(p);
    map.set(k, [...(map.get(k) ?? []), p]);
  }
  return [...map.values()].filter((g) => g.length > 1);
}
