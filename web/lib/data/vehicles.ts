/**
 * Normalized vehicle reference catalogue (Make → Model → Generation → Variant).
 *
 * This seed catalogue was hand-assembled from publicly known model/generation
 * information for vehicles common in the UAE. It is NOT a licensed OEM
 * catalogue. In production, refresh it from NHTSA vPIC (US-market coverage
 * only), TecDoc (licensed) or supplier-provided data — see docs/DATA_SOURCES.md.
 */
export interface Variant {
  id: string;
  name: string;
  engineCode: string;
  capacity: number; // litres
  fuel: "petrol" | "diesel" | "hybrid";
  transmission: string;
}

export interface Generation {
  code: string;
  yearFrom: number;
  yearTo: number;
  variants: Variant[];
}

export interface Model {
  id: string;
  name: string;
  nameAr: string;
  aliases: string[];
  generations: Generation[];
}

export interface Make {
  id: string;
  name: string;
  nameAr: string;
  aliases: string[];
  models: Model[];
}

type V = [name: string, engineCode: string, capacity: number, transmission: string, fuel?: Variant["fuel"]];
type G = [code: string, from: number, to: number, variants: V[]];

function model(id: string, name: string, nameAr: string, gens: G[], aliases: string[] = []): Model {
  return {
    id,
    name,
    nameAr,
    aliases,
    generations: gens.map(([code, yearFrom, yearTo, vs]) => ({
      code,
      yearFrom,
      yearTo,
      variants: vs.map(([vName, engineCode, capacity, transmission, fuel]) => ({
        id: `${id}-${code}-${vName}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name: vName,
        engineCode,
        capacity,
        transmission,
        fuel: fuel ?? "petrol",
      })),
    })),
  };
}

export const MAKES: Make[] = [
  {
    id: "toyota", name: "Toyota", nameAr: "تويوتا", aliases: ["toyta", "تيوتا"],
    models: [
      model("land-cruiser", "Land Cruiser", "لاندكروزر", [
        ["J200", 2008, 2021, [["GXR 4.6", "1UR-FE", 4.6, "6-speed automatic"], ["VXR 5.7", "3UR-FE", 5.7, "6-speed automatic"]]],
        ["J300", 2022, 2025, [["GXR 3.5TT", "V35A-FTS", 3.5, "10-speed automatic"]]],
      ], ["landcruiser", "lc200", "lc300", "لاند كروزر", "لاندكروزر"]),
      model("camry", "Camry", "كامري", [
        ["XV50", 2012, 2017, [["2.5 S", "2AR-FE", 2.5, "6-speed automatic"], ["3.5 V6", "2GR-FE", 3.5, "6-speed automatic"]]],
        ["XV70", 2018, 2024, [["2.5", "A25A-FKS", 2.5, "8-speed automatic"], ["3.5 V6", "2GR-FKS", 3.5, "8-speed automatic"]]],
      ], ["كامري"]),
      model("corolla", "Corolla", "كورولا", [
        ["E170", 2014, 2019, [["1.6", "1ZR-FE", 1.6, "CVT"], ["2.0", "3ZR-FE", 2.0, "CVT"]]],
        ["E210", 2019, 2025, [["1.6", "1ZR-FAE", 1.6, "CVT"], ["1.8 Hybrid", "2ZR-FXE", 1.8, "e-CVT", "hybrid"]]],
      ], ["كورولا"]),
      model("prado", "Land Cruiser Prado", "برادو", [
        ["J150", 2010, 2023, [["2.7", "2TR-FE", 2.7, "6-speed automatic"], ["4.0 V6", "1GR-FE", 4.0, "6-speed automatic"]]],
      ], ["prado", "برادو"]),
      model("hilux", "Hilux", "هايلكس", [
        ["AN120", 2016, 2025, [["2.7", "2TR-FE", 2.7, "6-speed automatic"], ["2.8D", "1GD-FTV", 2.8, "6-speed automatic", "diesel"]]],
      ], ["هايلكس"]),
      model("yaris", "Yaris", "يارس", [["XP150", 2014, 2022, [["1.5", "2NR-FE", 1.5, "CVT"]]]], ["يارس"]),
    ],
  },
  {
    id: "nissan", name: "Nissan", nameAr: "نيسان", aliases: ["nisan"],
    models: [
      model("patrol", "Patrol", "باترول", [
        ["Y62", 2010, 2025, [["LE 5.6", "VK56VD", 5.6, "7-speed automatic"], ["SE 4.0", "VQ40DE", 4.0, "7-speed automatic"]]],
      ], ["باترول", "بترول"]),
      model("altima", "Altima", "التيما", [
        ["L33", 2013, 2018, [["2.5", "QR25DE", 2.5, "CVT"], ["3.5", "VQ35DE", 3.5, "CVT"]]],
        ["L34", 2019, 2025, [["2.5", "PR25DD", 2.5, "CVT"]]],
      ], ["التيما"]),
      model("sunny", "Sunny", "صني", [["N17", 2012, 2019, [["1.5", "HR15DE", 1.5, "CVT"]]]], ["صني"]),
      model("x-trail", "X-Trail", "اكس تريل", [["T32", 2014, 2021, [["2.5", "QR25DE", 2.5, "CVT"]]]], ["xtrail"]),
    ],
  },
  {
    id: "mercedes-benz", name: "Mercedes-Benz", nameAr: "مرسيدس", aliases: ["mercedes", "merc", "benz", "mercedez", "مرسيدس", "مارسيدس"],
    models: [
      model("c-class", "C-Class", "سي كلاس", [
        ["W204", 2008, 2014, [["C200", "M271", 1.8, "7G-Tronic (722.9)"], ["C300", "M272", 3.0, "7G-Tronic (722.9)"]]],
        ["W205", 2015, 2021, [["C200", "M274", 2.0, "7G-Tronic Plus (722.9)"], ["C300", "M274", 2.0, "9G-Tronic (725.0)"], ["C43 AMG", "M276", 3.0, "9G-Tronic (725.0)"]]],
        ["W206", 2022, 2025, [["C200", "M254", 1.5, "9G-Tronic (725.0)"]]],
      ], ["c class", "cclass", "c200", "c300", "c250", "سي كلاس"]),
      model("e-class", "E-Class", "اي كلاس", [
        ["W212", 2010, 2016, [["E300", "M272", 3.5, "7G-Tronic (722.9)"], ["E350", "M276", 3.5, "7G-Tronic (722.9)"]]],
        ["W213", 2017, 2023, [["E200", "M264", 2.0, "9G-Tronic (725.0)"], ["E300", "M264", 2.0, "9G-Tronic (725.0)"]]],
      ], ["e class", "e200", "e300", "e350"]),
      model("s-class", "S-Class", "اس كلاس", [
        ["W222", 2014, 2020, [["S400", "M276", 3.0, "7G-Tronic Plus (722.9)"], ["S500", "M278", 4.7, "7G-Tronic Plus (722.9)"]]],
      ], ["s class", "s500", "s400"]),
      model("g-class", "G-Class", "جي كلاس", [["W463", 2012, 2018, [["G63 AMG", "M157", 5.5, "AMG Speedshift 7G"]]]], ["g63", "g class"]),
    ],
  },
  {
    id: "bmw", name: "BMW", nameAr: "بي ام دبليو", aliases: ["بي ام", "بي إم دبليو", "بيم"],
    models: [
      model("3-series", "3 Series", "الفئة الثالثة", [
        ["F30", 2012, 2018, [["320i", "N20B20", 2.0, "ZF 8HP45"], ["328i", "N20B20", 2.0, "ZF 8HP45"]]],
        ["G20", 2019, 2025, [["330i", "B48B20", 2.0, "ZF 8HP51"]]],
      ], ["320i", "330i", "328i"]),
      model("5-series", "5 Series", "الفئة الخامسة", [
        ["F10", 2010, 2016, [["520i", "N20B20", 2.0, "ZF 8HP45"], ["535i", "N55B30", 3.0, "ZF 8HP70"]]],
        ["G30", 2017, 2023, [["530i", "B46B20", 2.0, "ZF 8HP50"]]],
      ], ["520i", "535i", "530i"]),
      model("x5", "X5", "اكس 5", [
        ["F15", 2014, 2018, [["xDrive35i", "N55B30", 3.0, "ZF 8HP70"], ["xDrive50i", "N63B44", 4.4, "ZF 8HP70"]]],
        ["G05", 2019, 2025, [["xDrive40i", "B58B30", 3.0, "ZF 8HP76"]]],
      ]),
    ],
  },
  {
    id: "lexus", name: "Lexus", nameAr: "لكزس", aliases: ["lexsus", "لكسز"],
    models: [
      model("lx", "LX", "ال اكس", [["J200", 2008, 2021, [["LX570", "3UR-FE", 5.7, "8-speed automatic"]]]], ["lx570"]),
      model("es", "ES", "اي اس", [["XV60", 2013, 2018, [["ES350", "2GR-FE", 3.5, "6-speed automatic"], ["ES250", "2AR-FE", 2.5, "6-speed automatic"]]]], ["es350", "es250"]),
      model("rx", "RX", "ار اكس", [["AL20", 2016, 2022, [["RX350", "2GR-FKS", 3.5, "8-speed automatic"]]]], ["rx350"]),
    ],
  },
  {
    id: "hyundai", name: "Hyundai", nameAr: "هيونداي", aliases: ["hundai", "hyndai", "هونداي"],
    models: [
      model("elantra", "Elantra", "النترا", [["AD", 2016, 2020, [["2.0", "G4NA", 2.0, "6-speed automatic"]]]], ["النترا"]),
      model("sonata", "Sonata", "سوناتا", [["LF", 2015, 2019, [["2.4", "G4KJ", 2.4, "6-speed automatic"]]]], ["سوناتا"]),
      model("tucson", "Tucson", "توسان", [["TL", 2016, 2021, [["2.0", "G4NA", 2.0, "6-speed automatic"]]]], ["توسان"]),
    ],
  },
  {
    id: "kia", name: "Kia", nameAr: "كيا", aliases: [],
    models: [
      model("sportage", "Sportage", "سبورتاج", [["QL", 2016, 2021, [["2.4", "G4KJ", 2.4, "6-speed automatic"]]]], ["سبورتاج"]),
      model("optima", "Optima / K5", "اوبتيما", [["JF", 2016, 2020, [["2.4", "G4KJ", 2.4, "6-speed automatic"]]]], ["optima", "k5"]),
    ],
  },
  {
    id: "ford", name: "Ford", nameAr: "فورد", aliases: [],
    models: [
      model("f-150", "F-150", "اف 150", [["P552", 2015, 2020, [["3.5 EcoBoost", "3.5 EcoBoost", 3.5, "10R80"], ["5.0 V8", "Coyote", 5.0, "6R80"]]]], ["f150"]),
      model("explorer", "Explorer", "اكسبلورر", [["U502", 2011, 2019, [["3.5 V6", "Cyclone", 3.5, "6F55"]]]]),
      model("mustang", "Mustang", "موستنج", [["S550", 2015, 2023, [["GT 5.0", "Coyote", 5.0, "10R80"], ["2.3 EcoBoost", "2.3 EcoBoost", 2.3, "10R80"]]]], ["موستنق"]),
    ],
  },
  {
    id: "honda", name: "Honda", nameAr: "هوندا", aliases: ["hunda"],
    models: [
      model("accord", "Accord", "اكورد", [["CR", 2013, 2017, [["2.4", "K24W", 2.4, "CVT"], ["3.5 V6", "J35Y", 3.5, "6-speed automatic"]]]], ["اكورد"]),
      model("civic", "Civic", "سيفيك", [["FC", 2016, 2021, [["1.6", "R16", 1.6, "CVT"], ["2.0", "K20C2", 2.0, "CVT"]]]], ["سيفيك"]),
      model("cr-v", "CR-V", "سي ار في", [["RW", 2017, 2022, [["2.4", "K24V", 2.4, "CVT"]]]], ["crv"]),
    ],
  },
  {
    id: "mitsubishi", name: "Mitsubishi", nameAr: "ميتسوبيشي", aliases: ["mitsubushi", "متسوبيشي"],
    models: [
      model("pajero", "Pajero", "باجيرو", [["V80", 2007, 2021, [["3.5 V6", "6G74", 3.5, "5-speed automatic"], ["3.8 V6", "6G75", 3.8, "5-speed automatic"]]]], ["باجيرو"]),
      model("lancer", "Lancer", "لانسر", [["CY", 2008, 2017, [["1.6", "4A92", 1.6, "CVT"], ["2.0", "4B11", 2.0, "CVT"]]]], ["لانسر"]),
    ],
  },
  {
    id: "chevrolet", name: "Chevrolet", nameAr: "شيفروليه", aliases: ["chevy", "شفر", "شفروليه"],
    models: [model("tahoe", "Tahoe", "تاهو", [["K2XX", 2015, 2020, [["5.3 V8", "L83", 5.3, "6L80"]]]], ["تاهو"])],
  },
  {
    id: "gmc", name: "GMC", nameAr: "جي ام سي", aliases: ["جمس"],
    models: [
      model("yukon", "Yukon", "يوكن", [["K2XX", 2015, 2020, [["5.3 V8", "L83", 5.3, "6L80"], ["6.2 V8 Denali", "L86", 6.2, "8L90"]]]], ["يوكن"]),
    ],
  },
];

export const findMake = (id?: string) => MAKES.find((m) => m.id === id);
export const findModel = (makeId?: string, modelId?: string) => findMake(makeId)?.models.find((m) => m.id === modelId);

export function yearsFor(makeId?: string, modelId?: string): number[] {
  const m = findModel(makeId, modelId);
  if (!m) return [];
  const years = new Set<number>();
  m.generations.forEach((g) => {
    for (let y = g.yearFrom; y <= g.yearTo; y++) years.add(y);
  });
  return [...years].sort((a, b) => b - a);
}

export function generationsFor(makeId?: string, modelId?: string, year?: number): Generation[] {
  const m = findModel(makeId, modelId);
  if (!m) return [];
  return m.generations.filter((g) => !year || (year >= g.yearFrom && year <= g.yearTo));
}

export function variantsFor(makeId?: string, modelId?: string, year?: number): Variant[] {
  return generationsFor(makeId, modelId, year).flatMap((g) => g.variants);
}

export function makeLabel(id: string, lang: "en" | "ar" = "en") {
  const m = findMake(id);
  return m ? (lang === "ar" ? m.nameAr : m.name) : id;
}

export function modelLabel(makeId: string, modelId: string, lang: "en" | "ar" = "en") {
  const m = findModel(makeId, modelId);
  return m ? (lang === "ar" ? m.nameAr : m.name) : modelId;
}
