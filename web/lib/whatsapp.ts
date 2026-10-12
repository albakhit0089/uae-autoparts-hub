import { makeLabel, modelLabel } from "./data/vehicles";
import { partTypeLabel } from "./data/taxonomy";
import type { Part } from "./types";

/**
 * Click-to-chat links (https://wa.me) need no API credentials and are safe to
 * build in the browser. Automated notifications use the WhatsApp Business
 * Platform from the backend only (api/app/services/whatsapp.py).
 */
export function buildInquiryMessage(part: Part, lang: "en" | "ar" = "en"): string {
  const years = part.yearFrom === part.yearTo ? `${part.yearFrom}` : `${part.yearFrom}–${part.yearTo}`;
  const ref = `Ref ${part.id}${part.oem ? `, OEM ${part.oem}` : ""}`;
  if (lang === "ar") {
    return (
      `مرحباً، وجدت إعلانكم على منصة UAE AutoParts Hub. هل ما زالت قطعة ${partTypeLabel(part.partTypeId, "ar")} ` +
      `لسيارة ${makeLabel(part.make, "ar")} ${modelLabel(part.make, part.model, "ar")} ${years} متوفرة بسعر ${part.price} درهم؟ ` +
      `يرجى تأكيد السعر والحالة والتوافق والضمان. (${ref})`
    );
  }
  return (
    `Hello, I found your listing on UAE AutoParts Hub. Is the ${makeLabel(part.make)} ${modelLabel(part.make, part.model)} ${years} ` +
    `${partTypeLabel(part.partTypeId).toLowerCase()} (AED ${part.price.toLocaleString("en-US")}) still available? ` +
    `Please confirm the price, condition, compatibility, and warranty. (${ref})`
  );
}

export function whatsappLink(number: string | undefined, text: string): string {
  const digits = (number ?? "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
}
