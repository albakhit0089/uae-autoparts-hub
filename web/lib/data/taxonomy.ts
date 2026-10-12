/**
 * Standardized part taxonomy. Supplier descriptions ("gear box", "قير",
 * "automatic transmission") are mapped to a single partTypeId so that listings
 * from different suppliers can be searched and compared consistently.
 */
export interface PartType {
  id: string;
  en: string;
  ar: string;
  synonyms: string[];
  /** Safety-critical components require an OEM number and admin review before publishing. */
  safetyCritical?: boolean;
}

export interface Category {
  id: string;
  en: string;
  ar: string;
  icon: string;
  types: PartType[];
}

export const CATEGORIES: Category[] = [
  {
    id: "engine", en: "Engine", ar: "المحرك", icon: "engine",
    types: [
      { id: "complete-engine", en: "Complete engine", ar: "مكينة كاملة", synonyms: ["engine", "motor", "engine assembly", "long block", "مكينة", "ماكينة", "محرك", "مكينه"] },
      { id: "cylinder-head", en: "Cylinder head", ar: "رأس السلندر", synonyms: ["cylinder head", "head", "راس مكينة", "سلندر هيد"] },
      { id: "turbocharger", en: "Turbocharger", ar: "تيربو", synonyms: ["turbo", "turbocharger", "تيربو", "تربو"] },
      { id: "intake-manifold", en: "Intake manifold", ar: "مشعب السحب", synonyms: ["intake manifold", "intake", "manifold", "منفولد"] },
    ],
  },
  {
    id: "transmission", en: "Transmission", ar: "ناقل الحركة", icon: "gear",
    types: [
      { id: "gearbox", en: "Gearbox / transmission", ar: "قير", synonyms: ["gearbox", "gear box", "transmission", "automatic transmission", "tranny", "gear", "قير", "جير", "ناقل الحركة", "جربوكس"] },
      { id: "torque-converter", en: "Torque converter", ar: "تورك كونفرتر", synonyms: ["torque converter", "converter", "تورك"] },
      { id: "transfer-case", en: "Transfer case", ar: "صندوق التحويل", synonyms: ["transfer case", "transfer box", "ترانسفير", "تحويلة"] },
      { id: "valve-body", en: "Valve body / mechatronic", ar: "بلف بودي", synonyms: ["valve body", "mechatronic", "conductor plate", "بلف بودي"] },
    ],
  },
  {
    id: "electrical", en: "Electrical & lighting", ar: "الكهرباء والإضاءة", icon: "bolt",
    types: [
      { id: "alternator", en: "Alternator", ar: "دينمو", synonyms: ["alternator", "dynamo", "دينمو", "دينامو"] },
      { id: "starter-motor", en: "Starter motor", ar: "سلف", synonyms: ["starter motor", "starter", "سلف", "مارش"] },
      { id: "ecu", en: "Engine control unit (ECU)", ar: "كمبيوتر المكينة", synonyms: ["ecu", "ecm", "engine computer", "كمبيوتر", "كنترول"] },
      { id: "headlight", en: "Headlight", ar: "شمعة أمامية", synonyms: ["headlight", "headlamp", "head light", "شمعة", "اضاءة امامية", "لايت"] },
      { id: "tail-light", en: "Tail light", ar: "شمعة خلفية", synonyms: ["tail light", "taillight", "rear lamp", "شمعة خلفية"] },
    ],
  },
  {
    id: "brakes", en: "Brakes", ar: "الفرامل", icon: "disc",
    types: [
      { id: "brake-caliper", en: "Brake caliper", ar: "كاليبر فرامل", synonyms: ["brake caliper", "caliper", "كاليبر"], safetyCritical: true },
      { id: "abs-module", en: "ABS pump / module", ar: "وحدة ABS", synonyms: ["abs pump", "abs module", "abs", "اي بي اس"], safetyCritical: true },
      { id: "brake-disc", en: "Brake disc", ar: "هوب فرامل", synonyms: ["brake disc", "rotor", "disc", "هوب", "ديسك"], safetyCritical: true },
    ],
  },
  {
    id: "suspension", en: "Suspension & steering", ar: "التعليق والتوجيه", icon: "spring",
    types: [
      { id: "shock-absorber", en: "Shock absorber / strut", ar: "مساعد", synonyms: ["shock absorber", "shock", "strut", "damper", "مساعد", "مساعدات", "ممتص صدمات"], safetyCritical: true },
      { id: "air-suspension", en: "Air suspension strut", ar: "مساعد هوائي", synonyms: ["air suspension", "airmatic", "air strut", "مساعد هوا"], safetyCritical: true },
      { id: "control-arm", en: "Control arm", ar: "مقص", synonyms: ["control arm", "wishbone", "مقص", "مقصات"], safetyCritical: true },
      { id: "steering-rack", en: "Steering rack", ar: "علبة دركسون", synonyms: ["steering rack", "rack and pinion", "steering box", "دركسون", "علبة دركسون"], safetyCritical: true },
    ],
  },
  {
    id: "body", en: "Body parts", ar: "قطع الهيكل", icon: "car",
    types: [
      { id: "front-bumper", en: "Front bumper", ar: "صدام أمامي", synonyms: ["front bumper", "bumper", "صدام", "دعامية"] },
      { id: "door", en: "Door", ar: "باب", synonyms: ["door", "باب", "ابواب"] },
      { id: "bonnet", en: "Bonnet / hood", ar: "كبوت", synonyms: ["bonnet", "hood", "كبوت", "غطاء المحرك"] },
      { id: "side-mirror", en: "Side mirror", ar: "مراية جانبية", synonyms: ["side mirror", "wing mirror", "mirror", "مراية", "مرايه"] },
    ],
  },
  {
    id: "cooling", en: "Cooling & A/C", ar: "التبريد والمكيف", icon: "fan",
    types: [
      { id: "radiator", en: "Radiator", ar: "رديتر", synonyms: ["radiator", "رديتر", "راديتر"] },
      { id: "ac-compressor", en: "A/C compressor", ar: "كمبروسر مكيف", synonyms: ["ac compressor", "a/c compressor", "compressor", "كمبروسر", "ضاغط المكيف"] },
      { id: "condenser", en: "A/C condenser", ar: "مكثف المكيف", synonyms: ["condenser", "كوندنسر", "مكثف"] },
    ],
  },
  {
    id: "wheels", en: "Wheels", ar: "الجنوط", icon: "wheel",
    types: [{ id: "alloy-wheel", en: "Alloy wheel", ar: "جنط", synonyms: ["alloy wheel", "rims", "rim", "alloy", "wheel", "جنط", "جنوط"] }],
  },
  {
    id: "interior", en: "Interior", ar: "الداخلية", icon: "seat",
    types: [
      { id: "seat", en: "Seat", ar: "كرسي", synonyms: ["seat", "seats", "كرسي", "كراسي", "مقعد"] },
      { id: "dashboard", en: "Instrument cluster", ar: "طبلون / عداد", synonyms: ["instrument cluster", "dashboard", "cluster", "speedometer", "طبلون", "عداد"] },
      { id: "airbag", en: "Airbag module", ar: "وسادة هوائية", synonyms: ["airbag", "air bag", "ايرباق", "وسادة هوائية"], safetyCritical: true },
    ],
  },
];

export const ALL_PART_TYPES = CATEGORIES.flatMap((c) => c.types.map((t) => ({ ...t, categoryId: c.id })));

export const findCategory = (id?: string) => CATEGORIES.find((c) => c.id === id);
export const findPartType = (id?: string) => ALL_PART_TYPES.find((t) => t.id === id);

export function partTypeLabel(id: string, lang: "en" | "ar" = "en") {
  const t = findPartType(id);
  return t ? (lang === "ar" ? t.ar : t.en) : id;
}

export function categoryLabel(id: string, lang: "en" | "ar" = "en") {
  const c = findCategory(id);
  return c ? (lang === "ar" ? c.ar : c.en) : id;
}
