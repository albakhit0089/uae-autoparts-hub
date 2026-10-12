import type { Emirate } from "../types";

export interface Area {
  id: string;
  en: string;
  ar: string;
  lat: number;
  lng: number;
}

export interface EmirateInfo {
  id: Emirate;
  en: string;
  ar: string;
  aliases: string[];
  areas: Area[];
}

export const EMIRATES: EmirateInfo[] = [
  {
    id: "sharjah", en: "Sharjah", ar: "الشارقة", aliases: ["shj", "sharja", "sharjah", "الشارقة", "شارقة"],
    areas: [
      { id: "al-sajaa", en: "Al Sajaa Industrial Area", ar: "منطقة الصجعة الصناعية", lat: 25.3285, lng: 55.6385 },
      { id: "industrial-area-shj", en: "Sharjah Industrial Area", ar: "المنطقة الصناعية بالشارقة", lat: 25.3101, lng: 55.4152 },
    ],
  },
  {
    id: "dubai", en: "Dubai", ar: "دبي", aliases: ["dxb", "dubai", "dubay", "دبي"],
    areas: [
      { id: "al-quoz", en: "Al Quoz Industrial", ar: "القوز الصناعية", lat: 25.1355, lng: 55.2329 },
      { id: "ras-al-khor", en: "Ras Al Khor Industrial", ar: "رأس الخور الصناعية", lat: 25.1817, lng: 55.3653 },
    ],
  },
  {
    id: "abu-dhabi", en: "Abu Dhabi", ar: "أبوظبي", aliases: ["auh", "abu dhabi", "abudhabi", "ابوظبي", "ابو ظبي"],
    areas: [{ id: "mussafah", en: "Mussafah Industrial", ar: "مصفح الصناعية", lat: 24.3545, lng: 54.5051 }],
  },
  {
    id: "ajman", en: "Ajman", ar: "عجمان", aliases: ["ajman", "عجمان"],
    areas: [{ id: "ajman-industrial", en: "Ajman Industrial Area", ar: "عجمان الصناعية", lat: 25.3965, lng: 55.4795 }],
  },
  {
    id: "umm-al-quwain", en: "Umm Al Quwain", ar: "أم القيوين", aliases: ["uaq", "umm al quwain", "ام القيوين"],
    areas: [{ id: "uaq-industrial", en: "UAQ Industrial Area", ar: "أم القيوين الصناعية", lat: 25.5279, lng: 55.6213 }],
  },
  {
    id: "ras-al-khaimah", en: "Ras Al Khaimah", ar: "رأس الخيمة", aliases: ["rak", "ras al khaimah", "راس الخيمة"],
    areas: [{ id: "rak-industrial", en: "Al Jazeera Al Hamra Industrial", ar: "الجزيرة الحمراء الصناعية", lat: 25.6975, lng: 55.7891 }],
  },
  {
    id: "fujairah", en: "Fujairah", ar: "الفجيرة", aliases: ["fuj", "fujairah", "الفجيرة", "فجيرة"],
    areas: [{ id: "fujairah-industrial", en: "Fujairah Industrial Area", ar: "الفجيرة الصناعية", lat: 25.1408, lng: 56.3324 }],
  },
];

export const findEmirate = (id?: string) => EMIRATES.find((e) => e.id === id);

export const emirateLabel = (id: string, lang: "en" | "ar" = "en") => {
  const e = findEmirate(id as Emirate);
  return e ? (lang === "ar" ? e.ar : e.en) : id;
};

export const findArea = (emirate: string, area: string) => findEmirate(emirate as Emirate)?.areas.find((x) => x.id === area);

export const areaLabel = (emirate: string, area: string, lang: "en" | "ar" = "en") => {
  const a = findArea(emirate, area);
  return a ? (lang === "ar" ? a.ar : a.en) : area;
};
