"""WhatsApp integration.

* Click-to-chat (wa.me) links: no credentials, safe for any client.
* Business notifications: WhatsApp Business Platform (Cloud API) with
  pre-approved templates, sent only server-side and only to opted-in numbers.
  When WHATSAPP_TOKEN is not configured, notifications are logged instead.
"""
from __future__ import annotations

import logging
import re
from urllib.parse import quote

import httpx

from ..catalog import find_make, find_model, part_types
from ..config import get_settings

log = logging.getLogger("whatsapp")


def inquiry_message(part, lang: str = "en") -> str:
    mk = find_make(part.make) or {"name": part.make, "nameAr": part.make}
    md = find_model(part.make, part.model) or {"name": part.model, "nameAr": part.model}
    pt = part_types().get(part.part_type_id, {"en": part.name, "ar": part.name})
    years = f"{part.year_from}" if part.year_from == part.year_to else f"{part.year_from}–{part.year_to}"
    ref = f"Ref {part.id}" + (f", OEM {part.oem}" if part.oem else "")
    if lang == "ar":
        return (
            f"مرحباً، وجدت إعلانكم على منصة UAE AutoParts Hub. هل ما زالت قطعة {pt['ar']} لسيارة {mk['nameAr']} {md['nameAr']} {years} "
            f"متوفرة بسعر {part.price} درهم؟ يرجى تأكيد السعر والحالة والتوافق والضمان. ({ref})"
        )
    return (
        f"Hello, I found your listing on UAE AutoParts Hub. Is the {mk['name']} {md['name']} {years} {pt['en'].lower()} "
        f"(AED {part.price:,}) still available? Please confirm the price, condition, compatibility, and warranty. ({ref})"
    )


def wa_link(number: str | None, text: str) -> str:
    digits = re.sub(r"\D", "", number or "")
    return f"https://wa.me/{digits}?text={quote(text)}" if digits else f"https://wa.me/?text={quote(text)}"


def send_template(to_number: str, template: str, params: list[str], lang: str = "en") -> bool:
    s = get_settings()
    if not (s.whatsapp_token and s.whatsapp_phone_number_id):
        log.info("WhatsApp not configured; would send template %s to %s with %s", template, to_number[-4:], params)
        return False
    digits = re.sub(r"\D", "", to_number)
    try:
        r = httpx.post(
            f"https://graph.facebook.com/v21.0/{s.whatsapp_phone_number_id}/messages",
            headers={"Authorization": f"Bearer {s.whatsapp_token}"},
            json={
                "messaging_product": "whatsapp",
                "to": digits,
                "type": "template",
                "template": {
                    "name": template,
                    "language": {"code": "ar" if lang == "ar" else "en"},
                    "components": [{"type": "body", "parameters": [{"type": "text", "text": p} for p in params]}],
                },
            },
            timeout=10,
        )
        r.raise_for_status()
        return True
    except httpx.HTTPError as e:  # never fail the user request because a notification failed
        log.warning("WhatsApp send failed: %s", e)
        return False
