/**
 * FICTIONAL SAMPLE DATA — every supplier, listing, price and OEM-style number
 * below is invented for demonstration. Sample OEM numbers use the "SMP-" prefix
 * so they can never be mistaken for real manufacturer part numbers.
 * Replace with authorized supplier data before launch (docs/REAL_DATA.md).
 */
import type {
  AuditEntry, Condition, Emirate, Inquiry, Part, PartRequest, Plan, Quotation, Report, SavedVehicle, Supplier, User,
} from "../types";
import { findPartType } from "./taxonomy";
import { findArea } from "./emirates";

// Deterministic PRNG so the demo looks identical for every visitor.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const DAY = 86_400_000;
const NOW = Date.now();
const daysAgo = (d: number) => new Date(NOW - d * DAY).toISOString();

type SupplierSeed = [id: string, name: string, nameAr: string, emirate: Emirate, area: string, makes: string[], cats: string[], delivery: boolean, status?: Supplier["status"]];

const SUPPLIER_SEEDS: SupplierSeed[] = [
  ["s1", "Al Sajaa Euro Parts (Sample)", "الصجعة يورو بارتس (عينة)", "sharjah", "al-sajaa", ["mercedes-benz", "bmw"], ["transmission", "engine", "suspension", "electrical"], true],
  ["s2", "Desert Falcon Auto Dismantlers (Sample)", "صقر الصحراء لتفكيك السيارات (عينة)", "sharjah", "al-sajaa", ["toyota", "lexus", "nissan"], ["engine", "transmission", "body", "cooling"], true],
  ["s3", "Gulf Gear Recyclers (Sample)", "جلف جير لإعادة التدوير (عينة)", "sharjah", "industrial-area-shj", ["nissan", "hyundai", "kia", "mitsubishi"], ["transmission", "electrical", "cooling", "body"], false],
  ["s4", "Blue Coast Japanese Spares (Sample)", "الساحل الأزرق لقطع الغيار اليابانية (عينة)", "sharjah", "al-sajaa", ["toyota", "honda", "nissan"], ["body", "electrical", "suspension", "wheels"], true],
  ["s5", "Quoz Premium German Parts (Sample)", "القوز لقطع الغيار الألمانية (عينة)", "dubai", "al-quoz", ["mercedes-benz", "bmw"], ["engine", "transmission", "electrical", "interior"], true],
  ["s6", "Ras Al Khor Truck & 4x4 (Sample)", "رأس الخور للدفع الرباعي (عينة)", "dubai", "ras-al-khor", ["toyota", "nissan", "ford", "chevrolet", "gmc"], ["engine", "transmission", "suspension", "wheels"], true],
  ["s7", "Mussafah Auto Salvage (Sample)", "مصفح لقطع السيارات المستعملة (عينة)", "abu-dhabi", "mussafah", ["toyota", "lexus", "nissan", "ford"], ["engine", "body", "cooling", "brakes"], true],
  ["s8", "Ajman Korean Auto Parts (Sample)", "عجمان لقطع السيارات الكورية (عينة)", "ajman", "ajman-industrial", ["hyundai", "kia"], ["engine", "electrical", "body", "cooling"], false],
  ["s9", "RAK Northern Spares (Sample)", "رأس الخيمة الشمالية لقطع الغيار (عينة)", "ras-al-khaimah", "rak-industrial", ["toyota", "mitsubishi", "honda"], ["engine", "suspension", "body"], false],
  ["s10", "Fujairah East Coast Parts (Sample)", "الفجيرة الساحل الشرقي (عينة)", "fujairah", "fujairah-industrial", ["nissan", "toyota"], ["transmission", "wheels", "interior"], false],
  ["s11", "UAQ Auto Breakers (Sample)", "أم القيوين لتفكيك السيارات (عينة)", "umm-al-quwain", "uaq-industrial", ["ford", "chevrolet", "gmc"], ["engine", "transmission"], false],
  ["s12", "New Horizon Parts Trading (Sample)", "الأفق الجديد لتجارة القطع (عينة)", "sharjah", "al-sajaa", ["lexus", "toyota"], ["electrical", "body"], false, "pending"],
];

export function seedSuppliers(): Supplier[] {
  return SUPPLIER_SEEDS.map(([id, name, nameAr, emirate, area, makes, cats, delivery, status], i) => {
    const a = findArea(emirate, area)!;
    const r = rng(i + 7);
    return {
      id,
      name,
      nameAr,
      tradeLicence: `SAMPLE-TL-${100200 + i * 17}`,
      contactName: "Sample contact",
      phone: "",
      whatsapp: "",
      email: `${id}@sample.invalid`,
      emirate,
      area,
      address: `Sample shop ${10 + i}, ${a.en}`,
      lat: a.lat + (r() - 0.5) * 0.012,
      lng: a.lng + (r() - 0.5) * 0.012,
      emiratesServed: delivery ? ["sharjah", "dubai", "ajman", "abu-dhabi"] : [emirate],
      makes,
      categories: cats,
      status: status ?? "approved",
      docs: [{ name: "trade-licence-sample.pdf", kind: "trade-licence", uploadedAt: daysAgo(90 - i), sizeKb: 240 }],
      delivery,
      featured: i === 0 || i === 4,
      plan: "free",
      createdAt: daysAgo(120 - i * 8),
      isSample: true,
    };
  });
}

// make, model, generation, yearFrom, yearTo, engine, transmission, partType, sampleOem, basePrice, donor
type T = [string, string, string, number, number, string | null, string | null, string, string | null, number, string?];

const TEMPLATES: T[] = [
  ["mercedes-benz", "c-class", "W205", 2015, 2018, "M274", "7G-Tronic Plus (722.9)", "gearbox", "SMP-7229-0205", 2750, "2015 C200 GCC, 92,000 km"],
  ["mercedes-benz", "c-class", "W205", 2015, 2018, "M274", null, "complete-engine", "SMP-2740-1015", 6900, "2016 C200 GCC"],
  ["mercedes-benz", "c-class", "W205", 2015, 2021, null, null, "headlight", "SMP-2059-0601", 1450],
  ["mercedes-benz", "c-class", "W205", 2015, 2021, null, null, "front-bumper", null, 900],
  ["mercedes-benz", "c-class", "W204", 2008, 2014, "M271", "7G-Tronic (722.9)", "gearbox", "SMP-7229-0204", 2200],
  ["mercedes-benz", "e-class", "W212", 2010, 2016, "M276", null, "ecu", "SMP-2769-0012", 1100],
  ["mercedes-benz", "s-class", "W222", 2014, 2020, null, null, "air-suspension", "SMP-2223-2049", 2400],
  ["mercedes-benz", "g-class", "W463", 2012, 2018, "M157", null, "turbocharger", "SMP-1570-9080", 3800],
  ["bmw", "3-series", "F30", 2012, 2018, "N20B20", "ZF 8HP45", "gearbox", "SMP-8HP45-001", 3100],
  ["bmw", "5-series", "F10", 2010, 2016, "N55B30", null, "complete-engine", "SMP-N55-30-07", 7800],
  ["bmw", "x5", "F15", 2014, 2018, null, null, "side-mirror", null, 650],
  ["toyota", "land-cruiser", "J200", 2016, 2021, "1UR-FE", "6-speed automatic", "gearbox", "SMP-35000-60B", 5200, "2017 GXR GCC"],
  ["toyota", "land-cruiser", "J200", 2008, 2021, "3UR-FE", null, "complete-engine", "SMP-19000-3UR", 11500],
  ["toyota", "land-cruiser", "J200", 2016, 2021, null, null, "headlight", "SMP-81145-60K", 1300],
  ["toyota", "camry", "XV70", 2018, 2024, "A25A-FKS", null, "alternator", "SMP-27060-F01", 480],
  ["toyota", "camry", "XV50", 2012, 2017, "2AR-FE", "6-speed automatic", "gearbox", "SMP-30510-06", 1900],
  ["toyota", "corolla", "E170", 2014, 2019, null, null, "front-bumper", null, 420],
  ["toyota", "prado", "J150", 2010, 2023, "1GR-FE", null, "ac-compressor", "SMP-88320-1GR", 750],
  ["toyota", "hilux", "AN120", 2016, 2025, "2TR-FE", null, "starter-motor", "SMP-28100-0L", 350],
  ["lexus", "lx", "J200", 2008, 2021, "3UR-FE", null, "air-suspension", "SMP-48510-LX", 1650],
  ["lexus", "es", "XV60", 2013, 2018, "2GR-FE", null, "radiator", "SMP-16400-ES", 380],
  ["lexus", "rx", "AL20", 2016, 2022, null, null, "tail-light", "SMP-81551-RX", 700],
  ["nissan", "patrol", "Y62", 2010, 2025, "VK56VD", "7-speed automatic", "gearbox", "SMP-31020-Y62", 4600, "2014 Patrol LE"],
  ["nissan", "patrol", "Y62", 2010, 2025, "VK56VD", null, "complete-engine", "SMP-10102-VK56", 9800],
  ["nissan", "altima", "L33", 2013, 2018, "QR25DE", "CVT", "gearbox", "SMP-31020-L33", 1700],
  ["nissan", "sunny", "N17", 2012, 2019, null, null, "door", null, 300],
  ["nissan", "x-trail", "T32", 2014, 2021, null, null, "bonnet", null, 550],
  ["hyundai", "elantra", "AD", 2016, 2020, "G4NA", null, "complete-engine", "SMP-G4NA-2016", 3200],
  ["hyundai", "sonata", "LF", 2015, 2019, null, null, "headlight", "SMP-92101-LF", 520],
  ["hyundai", "tucson", "TL", 2016, 2021, "G4NA", "6-speed automatic", "gearbox", "SMP-45000-TL", 1850],
  ["kia", "sportage", "QL", 2016, 2021, null, null, "condenser", "SMP-97606-QL", 260],
  ["kia", "optima", "JF", 2016, 2020, "G4KJ", null, "alternator", "SMP-37300-JF", 340],
  ["ford", "f-150", "P552", 2015, 2020, "3.5 EcoBoost", null, "turbocharger", "SMP-FL3E-6K682", 1600],
  ["ford", "explorer", "U502", 2011, 2019, null, null, "alloy-wheel", null, 450],
  ["ford", "mustang", "S550", 2015, 2023, "Coyote", null, "intake-manifold", "SMP-FR3E-9424", 900],
  ["honda", "accord", "CR", 2013, 2017, "K24W", "CVT", "gearbox", "SMP-20031-CR", 1600],
  ["honda", "civic", "FC", 2016, 2021, null, null, "seat", null, 400],
  ["honda", "cr-v", "RW", 2017, 2022, null, null, "control-arm", "SMP-51350-RW", 280],
  ["mitsubishi", "pajero", "V80", 2007, 2021, "6G75", null, "cylinder-head", "SMP-1005-6G75", 1500],
  ["mitsubishi", "lancer", "CY", 2008, 2017, null, null, "dashboard", "SMP-8100-CY", 300],
  ["chevrolet", "tahoe", "K2XX", 2015, 2020, "L83", "6L80", "gearbox", "SMP-6L80-K2", 3900],
  ["gmc", "yukon", "K2XX", 2015, 2020, "L86", null, "transfer-case", "SMP-TC-K2XX", 2100],
  ["toyota", "land-cruiser", "J200", 2008, 2021, null, null, "brake-caliper", "SMP-47730-60", 420],
  ["nissan", "patrol", "Y62", 2010, 2025, null, null, "abs-module", "SMP-47660-Y62", 1250],
  ["mercedes-benz", "c-class", "W205", 2015, 2021, null, null, "airbag", "SMP-2058-6001", 650],
  ["toyota", "yaris", "XP150", 2014, 2022, null, null, "radiator", "SMP-16400-YR", 210],
];

const MAKE_NAMES: Record<string, string> = {
  "mercedes-benz": "Mercedes-Benz", bmw: "BMW", toyota: "Toyota", lexus: "Lexus", nissan: "Nissan", hyundai: "Hyundai",
  kia: "Kia", ford: "Ford", honda: "Honda", mitsubishi: "Mitsubishi", chevrolet: "Chevrolet", gmc: "GMC",
};

export function seedParts(suppliers: Supplier[]): Part[] {
  const r = rng(42);
  const approved = suppliers.filter((s) => s.status === "approved");
  const parts: Part[] = [];
  let n = 1;
  TEMPLATES.forEach(([make, model, gen, yFrom, yTo, engine, trans, typeId, oem, base, donor], ti) => {
    const pt = findPartType(typeId)!;
    const sellers = approved.filter((s) => s.makes.includes(make));
    const pool = sellers.length ? sellers : approved;
    const copies = Math.min(pool.length, 1 + Math.floor(r() * 3));
    for (let c = 0; c < copies; c++) {
      const s = pool[(ti + c) % pool.length];
      const conds: Condition[] = ["used", "tested", "refurbished"];
      const condition = c === 0 ? "tested" : conds[Math.floor(r() * 3)];
      const factor = condition === "refurbished" ? 1.35 : condition === "tested" ? 1 : 0.85;
      const price = Math.round((base * factor * (0.9 + r() * 0.35)) / 10) * 10;
      const modelName = model.replace(/-/g, " ").replace(/\b\w/g, (x) => x.toUpperCase());
      const verifiedDays = ti === 0 && c === 0 ? 1 : Math.floor(r() * 75);
      parts.push({
        id: `p${n++}`,
        supplierId: s.id,
        name: `${pt.en} — ${MAKE_NAMES[make]} ${modelName} ${gen}`,
        categoryId: (pt as { categoryId: string }).categoryId,
        partTypeId: typeId,
        oem: oem ?? undefined,
        make,
        model,
        generation: gen,
        yearFrom: yFrom,
        yearTo: yTo,
        engine: engine ?? undefined,
        transmission: trans ?? undefined,
        marketSpec: r() > 0.25 ? "GCC" : "Imported",
        condition,
        price: ti === 0 && c === 0 ? 2750 : price,
        quantity: 1 + Math.floor(r() * 3),
        warrantyDays: [0, 7, 14, 30, 90][Math.floor(r() * 5)] || (condition === "refurbished" ? 90 : 0),
        emirate: s.emirate,
        area: s.area,
        images: [`sample:${(pt as { categoryId: string }).categoryId}`],
        description:
          `SAMPLE LISTING. ${condition === "tested" ? "Tested on bench before removal." : condition === "refurbished" ? "Rebuilt with new seals and gaskets." : "Removed from a running vehicle."} ` +
          `Fits ${MAKE_NAMES[make]} ${modelName} ${gen} ${yFrom}–${yTo}${engine ? ` with ${engine} engine` : ""}. Please confirm part number before purchase.`,
        donorVehicle: donor,
        status: r() > 0.9 ? "reserved" : "available",
        lastVerified: daysAgo(verifiedDays),
        createdAt: daysAgo(Math.floor(r() * 50)),
        views: Math.floor(r() * 400),
        featured: (ti % 7 === 0 && c === 0) || (ti === 0 && c === 0),
        fitment: oem ? (r() > 0.35 ? "verified" : "likely") : "likely",
        moderation: "approved",
        source: "sample",
        isSample: true,
      });
    }
  });
  // A couple of records for the moderation queue and a sold item.
  parts.push({ ...parts[2], id: `p${n++}`, moderation: "pending", featured: false, createdAt: daysAgo(0), description: "SAMPLE LISTING awaiting moderation." });
  parts.push({ ...parts[5], id: `p${n++}`, status: "sold", featured: false });
  return parts;
}

export const DEMO_PASSWORD = "Demo@1234";

export function seedUsers(passwordHash: string): User[] {
  return [
    { id: "u-admin", email: "admin@demo.ae", name: "Demo Administrator", role: "admin", passwordHash, createdAt: daysAgo(200), marketingConsent: false, whatsappConsent: false },
    { id: "u-supplier", email: "supplier@demo.ae", name: "Demo Supplier (Al Sajaa Euro Parts)", role: "supplier", supplierId: "s1", passwordHash, createdAt: daysAgo(120), marketingConsent: false, whatsappConsent: true },
    { id: "u-customer", email: "customer@demo.ae", name: "Demo Customer", role: "customer", phone: "", passwordHash, createdAt: daysAgo(30), marketingConsent: false, whatsappConsent: true },
  ];
}

export function seedActivity(parts: Part[]) {
  const r = rng(99);
  const inquiries: Inquiry[] = [];
  for (let i = 0; i < 60; i++) {
    const p = parts[Math.floor(r() * parts.length)];
    inquiries.push({
      id: `i${i + 1}`,
      partId: p.id,
      supplierId: p.supplierId,
      customerId: i % 4 === 0 ? "u-customer" : undefined,
      guestName: i % 4 === 0 ? undefined : "Sample guest",
      message: `Is the ${p.name} still available?`,
      channel: "whatsapp",
      createdAt: daysAgo(Math.floor(r() * 30)),
    });
  }
  const requests: PartRequest[] = [
    {
      id: "r1", customerId: "u-customer", contactName: "Demo Customer", contactPhone: "+971 50 000 0000 (sample)", contactMethod: "whatsapp",
      make: "mercedes-benz", model: "c-class", year: 2016, engine: "M274", partTypeId: "air-suspension", partText: "Rear air suspension strut",
      emirate: "sharjah", budget: 1500, description: "SAMPLE REQUEST. Rear left strut, car sits low overnight.", images: [], status: "open",
      matchedSupplierIds: ["s1", "s5"], createdAt: daysAgo(2),
    },
    {
      id: "r2", contactName: "Sample guest", contactPhone: "+971 55 000 0000 (sample)", contactMethod: "phone",
      make: "toyota", model: "land-cruiser", year: 2019, partTypeId: "transfer-case", partText: "Transfer case",
      emirate: "dubai", budget: 3000, description: "SAMPLE REQUEST. GXR 4.6, GCC spec.", images: [], status: "open",
      matchedSupplierIds: ["s2", "s6", "s7"], createdAt: daysAgo(1),
    },
  ];
  const quotations: Quotation[] = [
    { id: "q1", requestId: "r1", supplierId: "s1", price: 1350, availability: "in-stock", condition: "tested", warrantyDays: 30, deliveryDays: 1, note: "SAMPLE QUOTE. Original part, tested on vehicle.", images: [], status: "submitted", createdAt: daysAgo(1) },
    { id: "q2", requestId: "r1", supplierId: "s5", price: 1190, availability: "1-3-days", condition: "used", warrantyDays: 7, deliveryDays: 3, note: "SAMPLE QUOTE. Removed from 2017 C200.", images: [], status: "submitted", createdAt: daysAgo(1) },
  ];
  const searches = Array.from({ length: 30 }, (_, d) => ({ day: daysAgo(29 - d).slice(0, 10), count: Math.round(40 + d * 2.2 + r() * 25) }));
  const reports: Report[] = [{ id: "rep1", partId: parts[10].id, reason: "Photo does not match description (sample report)", status: "open", createdAt: daysAgo(3) }];
  const audit: AuditEntry[] = [
    { id: "a1", actorId: "u-admin", action: "supplier.approve", target: "s1", at: daysAgo(110) },
    { id: "a2", actorId: "u-admin", action: "listing.feature", target: parts[0].id, at: daysAgo(5) },
  ];
  const savedVehicles: SavedVehicle[] = [{ id: "v1", userId: "u-customer", make: "mercedes-benz", model: "c-class", year: 2016, engine: "M274" }];
  const plans: Plan[] = [
    { id: "free", name: "Free (MVP)", priceAed: 0, listingLimit: 200, featuredSlots: 0, active: true },
    { id: "growth", name: "Growth", priceAed: 299, listingLimit: 2000, featuredSlots: 5, active: false },
    { id: "pro", name: "Pro", priceAed: 799, listingLimit: 20000, featuredSlots: 25, active: false },
  ];
  return { inquiries, requests, quotations, searches, reports, audit, savedVehicles, plans };
}
