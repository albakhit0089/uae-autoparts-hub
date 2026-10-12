import { describe, expect, it } from "vitest";
import { assessCompatibility, comparableParts, levenshtein, normalize, parseQuery, searchParts } from "../lib/search";
import { seedParts, seedSuppliers } from "../lib/data/seed";
import type { Part } from "../lib/types";

const parts = seedParts(seedSuppliers());

describe("parseQuery", () => {
  it("extracts the canonical English example", () => {
    const q = parseQuery("I need a used gearbox for a 2015 Mercedes C200 in Sharjah under AED 3,000.");
    expect(q).toMatchObject({ make: "mercedes-benz", model: "c-class", variant: "C200", year: 2015, partType: "gearbox", emirate: "sharjah", maxPrice: 3000, engine: "M274" });
  });

  it("understands Arabic queries", () => {
    const q = parseQuery("أبي قير لكزس LX570 2016 في دبي أقل من 5 الف درهم");
    expect(q).toMatchObject({ make: "lexus", model: "lx", year: 2016, partType: "gearbox", emirate: "dubai", maxPrice: 5000 });
  });

  it("handles Arabic definite article and typos", () => {
    expect(parseQuery("القير تويوتا").partType).toBe("gearbox");
    expect(parseQuery("transmision nissan patrol").partType).toBe("gearbox");
    expect(parseQuery("mercedez c class headlight").make).toBe("mercedes-benz");
  });

  it("extracts OEM numbers and budget shorthand", () => {
    const q = parseQuery("SMP-7229-0205 under 3k");
    expect(q.oem).toBe("SMP72290205");
    expect(q.maxPrice).toBe(3000);
  });

  it("does not confuse 'year' with 'gear'", () => {
    expect(parseQuery("year model 2015 bumper").partType).toBe("front-bumper");
  });
});

describe("searchParts", () => {
  it("returns only real inventory matching the structured filters", () => {
    const { results, applied } = searchParts(parts, { q: "gearbox 2015 Mercedes C200 Sharjah under AED 3,000" });
    expect(applied.maxPrice).toBe(3000);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.part.make).toBe("mercedes-benz");
      expect(r.part.partTypeId).toBe("gearbox");
      expect(r.part.emirate).toBe("sharjah");
      expect(r.part.price).toBeLessThanOrEqual(3000);
      expect(r.part.yearFrom).toBeLessThanOrEqual(2015);
      expect(r.part.yearTo).toBeGreaterThanOrEqual(2015);
    }
  });

  it("hides sold and unmoderated listings", () => {
    const { results } = searchParts(parts, {});
    expect(results.every((r) => r.part.status !== "sold" && r.part.moderation === "approved")).toBe(true);
  });

  it("returns nothing for nonsense free text instead of inventing matches", () => {
    expect(searchParts(parts, { q: "zzqx flux capacitor" }).results).toHaveLength(0);
  });
});

describe("compatibility", () => {
  const base: Part = { ...parts[0], make: "mercedes-benz", model: "c-class", yearFrom: 2015, yearTo: 2018, engine: "M274", oem: "SMP-1", fitment: "verified" };

  it("never verifies from make/model/year alone", () => {
    expect(assessCompatibility({ ...base, engine: undefined, oem: undefined, fitment: "likely" }, { make: "mercedes-benz", model: "c-class", year: 2016 })).toBe("likely");
    expect(assessCompatibility(base, { make: "mercedes-benz", model: "c-class", year: 2016 })).toBe("likely");
  });

  it("verifies on OEM match or OEM-backed engine match", () => {
    expect(assessCompatibility(base, { oem: "smp 1" })).toBe("verified");
    expect(assessCompatibility(base, { make: "mercedes-benz", model: "c-class", year: 2016, engine: "M274" })).toBe("verified");
  });

  it("requires confirmation on engine mismatch", () => {
    expect(assessCompatibility(base, { make: "mercedes-benz", model: "c-class", year: 2016, engine: "M276" })).toBe("confirm");
  });
});

describe("comparison", () => {
  it("only groups identical OEM numbers", () => {
    const a = parts.find((p) => p.oem)!;
    const rows = comparableParts(a, parts);
    expect(rows.every((r) => r.part.oem === a.oem && r.basis === "oem")).toBe(true);
  });
});

describe("text utils", () => {
  it("normalizes Arabic letter variants", () => {
    expect(normalize("أبوظبي")).toBe(normalize("ابوظبي"));
    expect(levenshtein("gearbox", "gearbx")).toBe(1);
  });
});
