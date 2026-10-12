"""Optional Claude-powered query extraction.

Used only when ANTHROPIC_API_KEY is set. Claude extracts *filters* from the
customer's free text; every value is then validated against the platform's
own catalogue (unknown makes/models/part types/emirates are dropped), and the
results always come from the inventory database. Any failure — missing key,
network error, refusal, invalid output — falls back to the deterministic
rule-based parser.
"""
from __future__ import annotations

import logging
from typing import Optional

from pydantic import BaseModel

from ..catalog import emirate_ids, find_model, makes, part_types
from ..config import get_settings
from .query_parser import ParsedQuery, normalize_oem, parse_query

log = logging.getLogger("llm")


class Extracted(BaseModel):
    make_id: Optional[str] = None
    model_id: Optional[str] = None
    year: Optional[int] = None
    engine_code: Optional[str] = None
    part_type_id: Optional[str] = None
    emirate_id: Optional[str] = None
    max_price_aed: Optional[int] = None
    oem_number: Optional[str] = None
    condition: Optional[str] = None


def _catalog_brief() -> str:
    lines = ["MAKES/MODELS (make_id: model_ids):"]
    for m in makes():
        lines.append(f"- {m['id']}: {', '.join(md['id'] for md in m['models'])}")
    lines.append("PART TYPES: " + ", ".join(part_types()))
    lines.append("EMIRATES: " + ", ".join(sorted(emirate_ids())))
    return "\n".join(lines)


SYSTEM = (
    "You convert a customer's used-car-part search (English or Arabic, often informal Gulf Arabic) into search filters for a UAE "
    "parts marketplace. Use only ids from the catalogue below; leave a field null when the text does not state it — never guess "
    "a year, engine or budget. Map model variants to their model (e.g. C200 -> c-class, LX570 -> lx). Prices are AED; '3k' means 3000. "
    "condition is one of used, tested, refurbished, or null.\n\n"
)


def extract_with_claude(text: str) -> ParsedQuery | None:
    s = get_settings()
    if not s.anthropic_api_key:
        return None
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=s.anthropic_api_key, timeout=20.0, max_retries=1)
        response = client.messages.parse(
            model=s.anthropic_model,
            max_tokens=2000,
            system=SYSTEM + _catalog_brief(),
            output_config={"effort": "low"},
            messages=[{"role": "user", "content": text[:500]}],
            output_format=Extracted,
        )
        if response.stop_reason == "refusal" or response.parsed_output is None:
            return None
        e = response.parsed_output
    except Exception as exc:  # noqa: BLE001 — any failure means "use the rule-based parser"
        log.warning("Claude extraction failed, falling back: %s", exc)
        return None

    # Validate every field against our own reference data.
    out = parse_query(text)  # keeps keyword extraction + anything the rules found
    if e.make_id in {m["id"] for m in makes()}:
        out.make = e.make_id
        if e.model_id and find_model(e.make_id, e.model_id):
            out.model = e.model_id
    if e.year and 1980 <= e.year <= 2030:
        out.year = e.year
    if e.part_type_id in part_types():
        out.partType = e.part_type_id
        out.category = part_types()[e.part_type_id]["categoryId"]
    if e.emirate_id in emirate_ids():
        out.emirate = e.emirate_id
    if e.max_price_aed and 0 < e.max_price_aed < 1_000_000:
        out.maxPrice = e.max_price_aed
    if e.oem_number:
        out.oem = normalize_oem(e.oem_number)
    if e.condition in ("used", "tested", "refurbished"):
        out.condition = e.condition
    if e.engine_code:
        out.engine = e.engine_code.upper()
    return out
