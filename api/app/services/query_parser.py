"""Natural-language query understanding + compatibility rules.

Python port of web/lib/search.ts — keep the two in sync (tests cover both).
The parser only extracts filters; results always come from the database.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone

from ..catalog import categories, emirates, makes, part_types

AR_DIACRITICS = re.compile("[ؐ-ًؚ-ٰٟۖ-ۭـ]")
AR_DIGITS = "٠١٢٣٤٥٦٧٨٩"


def normalize(s: str) -> str:
    s = s.lower()
    s = AR_DIACRITICS.sub("", s)
    s = re.sub("[أإآ]", "ا", s).replace("ة", "ه").replace("ى", "ي")
    s = "".join(str(AR_DIGITS.index(c)) if c in AR_DIGITS else c for c in s)
    s = re.sub(r"mercedes[-\s]?benz", "mercedes", s)
    s = re.sub(r"\b([a-z])\s(\d{2,3})\b", r"\1\2", s)
    s = re.sub(r"(\d)[,٬](?=\d{3}\b)", r"\1", s)
    s = re.sub(r"[^\w\s\-./]|_", " ", s)
    s = re.sub(r"[.\-/]+(\s|$)", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def normalize_oem(s: str) -> str:
    return re.sub(r"[\s\-./]", "", s.upper())


def levenshtein(a: str, b: str) -> int:
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        cur = [i]
        for j in range(1, len(b) + 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] != b[j - 1])))
        prev = cur
    return prev[-1]


def _is_arabic(s: str) -> bool:
    return bool(re.search("[؀-ۿ]", s))


def _strip_al(s: str) -> str:
    return s[2:] if _is_arabic(s) and s.startswith("ال") and len(s) > 4 else s


def token_matches(token: str, target: str) -> bool:
    if token == target:
        return True
    a, b = _strip_al(token), _strip_al(target)
    if a == b:
        return True
    if re.search(r"\d", a) or re.search(r"\d", b):
        return False
    n = min(len(a), len(b))
    if n < 5:
        return False
    return levenshtein(a, b) <= (2 if n >= 7 else 1)


def _find_phrase(tokens: list[str], used: list[bool], phrase: str) -> tuple[int, int] | None:
    p = [x for x in normalize(phrase).split(" ") if x]
    if not p:
        return None
    for i in range(len(tokens) - len(p) + 1):
        if all(not used[i + k] and token_matches(tokens[i + k], p[k]) for k in range(len(p))):
            return i, i + len(p)
    return None


def _consume(used: list[bool], span: tuple[int, int]) -> None:
    for i in range(*span):
        used[i] = True


STOP_WORDS = set(
    (
        "i need want looking for a an the for of in at to my car used second hand please with from any is are me find "
        "price aed dhs dirham cheap good original genuine part parts spare spares "
        "انا ابي ابغى اريد احتاج ابحث عن في من على الى مع لسياره سياره قطعه قطع غيار مستعمل مستعمله سعر درهم لو سمحت"
    ).split()
)

PRICE_RE = re.compile(
    r"(under|below|less than|max|maximum|up to|upto|budget|within|<|اقل من|تحت|بحدود|ميزانيه|لا يزيد عن)\s*(?:of\s*)?(?:aed|dhs|درهم)?\s*(\d[\d,.]*)\s*(k|الف)?\s*(?:aed|dhs|درهم)?"
)
MIN_PRICE_RE = re.compile(r"(over|above|more than|from|min|اكثر من|فوق)\s*(?:aed|dhs|درهم)?\s*(\d[\d,.]*)\s*(k|الف)?")
YEAR_RE = re.compile(r"\b(19[89]\d|20[0-3]\d)\b")


def _amount(num: str, k: str | None) -> int:
    n = float(num.replace(",", "").rstrip("."))
    return round(n * 1000 if k else n)


@dataclass
class ParsedQuery:
    make: str | None = None
    model: str | None = None
    variant: str | None = None
    engine: str | None = None
    year: int | None = None
    partType: str | None = None
    category: str | None = None
    emirate: str | None = None
    maxPrice: int | None = None
    minPrice: int | None = None
    oem: str | None = None
    condition: str | None = None
    warranty: bool | None = None
    keywords: list[str] = field(default_factory=list)


def parse_query(raw: str) -> ParsedQuery:
    out = ParsedQuery()
    text = normalize(raw)
    if m := PRICE_RE.search(text):
        out.maxPrice = _amount(m.group(2), m.group(3))
        text = text.replace(m.group(0), " ", 1)
    if m := MIN_PRICE_RE.search(text):
        out.minPrice = _amount(m.group(2), m.group(3))
        text = text.replace(m.group(0), " ", 1)
    if m := YEAR_RE.search(text):
        out.year = int(m.group(1))
        text = text.replace(m.group(0), " ", 1)

    tokens = [t for t in text.split(" ") if t]
    used = [False] * len(tokens)

    for i, t in enumerate(tokens):
        compact = re.sub(r"[\-./]", "", t)
        if not out.oem and len(compact) >= 8 and len(re.findall(r"\d", compact)) >= 5 and re.fullmatch(r"[a-z0-9]+", compact):
            out.oem = normalize_oem(t)
            used[i] = True

    for e in emirates():
        for alias in [e["en"], e["ar"], *e["aliases"]]:
            if span := _find_phrase(tokens, used, alias):
                out.emirate = e["id"]
                _consume(used, span)
                break
        if out.emirate:
            break

    syn = [(s, t) for t in part_types().values() for s in [t["en"], t["ar"], *t["synonyms"]]]
    syn.sort(key=lambda x: (-len(normalize(x[0]).split(" ")), -len(x[0])))
    for s, t in syn:
        if span := _find_phrase(tokens, used, s):
            out.partType, out.category = t["id"], t["categoryId"]
            _consume(used, span)
            break
    if not out.partType:
        for c in categories():
            span = _find_phrase(tokens, used, c["en"]) or _find_phrase(tokens, used, c["ar"])
            if span:
                out.category = c["id"]
                _consume(used, span)
                break

    for mk in makes():
        for alias in [mk["name"], mk["nameAr"], mk["id"], *mk["aliases"]]:
            if span := _find_phrase(tokens, used, alias):
                out.make = mk["id"]
                _consume(used, span)
                break
        if out.make:
            break

    candidates = [m for m in makes() if not out.make or m["id"] == out.make]
    done = False
    for mk in candidates:
        for md in mk["models"]:
            for g in md["generations"]:
                for v in g["variants"]:
                    vname = v["name"].split(" ")[0]
                    if not re.fullmatch(r"[a-z]*\d+[a-z]*", vname, re.I) or vname.isdigit():
                        continue
                    if span := _find_phrase(tokens, used, vname):
                        out.make, out.model, out.variant = mk["id"], md["id"], v["name"]
                        _consume(used, span)
                        done = True
                        break
                if done:
                    break
            if done:
                break
            for alias in [md["name"], md["nameAr"], md["id"].replace("-", " "), *md.get("aliases", [])]:
                if span := _find_phrase(tokens, used, alias):
                    out.make, out.model = mk["id"], md["id"]
                    _consume(used, span)
                    done = True
                    break
            if done:
                break
        if done:
            break

    if out.make and out.model and out.variant:
        md = next(x for x in next(m for m in makes() if m["id"] == out.make)["models"] if x["id"] == out.model)
        codes = {
            v["engineCode"]
            for g in md["generations"]
            if not out.year or g["yearFrom"] <= out.year <= g["yearTo"]
            for v in g["variants"]
            if v["name"] == out.variant
        }
        if len(codes) == 1:
            out.engine = codes.pop()

    for i, t in enumerate(tokens):
        if used[i]:
            continue
        if any(token_matches(t, w) for w in ("refurbished", "rebuilt", "reconditioned", "مجدد")):
            out.condition, used[i] = "refurbished", True
        elif any(token_matches(t, w) for w in ("tested", "مفحوص", "مجرب")):
            out.condition, used[i] = "tested", True
        elif any(token_matches(t, w) for w in ("warranty", "guarantee", "ضمان", "كفاله")):
            out.warranty, used[i] = True, True

    out.keywords = [t for i, t in enumerate(tokens) if not used[i] and t not in STOP_WORDS and _strip_al(t) not in STOP_WORDS and len(t) > 1]
    return out


# ------------------------------------------------------------------ compatibility


def assess_compatibility(part, make=None, model=None, year=None, engine=None, oem=None) -> str:
    """verified | likely | confirm — never 'verified' from make/model/year alone."""
    if oem and part.oem and normalize_oem(oem) == normalize_oem(part.oem):
        return "verified"
    if not (make and model and year):
        return "likely" if part.fitment == "verified" else "confirm"
    if part.make != make or part.model != model or not (part.year_from <= year <= part.year_to):
        return "confirm"
    if part.engine and engine:
        if part.engine != engine:
            return "confirm"
        return "verified" if part.fitment == "verified" and part.oem else "likely"
    if part.engine and not engine:
        return "likely"
    if part.fitment == "verified" and part.oem:
        return "likely"
    return "confirm" if part.fitment == "confirm" else "likely"


def merge_filters(f: dict) -> tuple[dict, ParsedQuery | None]:
    q = (f.get("q") or "").strip()
    if not q:
        return dict(f), None
    p = parse_query(q)
    applied = dict(f)
    for k in ("make", "model", "year", "engine", "partType", "category", "emirate", "oem", "condition", "warranty"):
        applied[k] = f.get(k) or getattr(p, k)
    for k in ("maxPrice", "minPrice"):
        applied[k] = f.get(k) if f.get(k) is not None else getattr(p, k)
    return applied, p


def score_part(part, keywords: list[str], structured: bool) -> float | None:
    score = 1.0
    if keywords:
        hay = normalize(f"{part.name} {part.description} {part.oem or ''} {part.engine or ''} {part.donor_vehicle or ''}").split(" ")
        hits = sum(1 for k in keywords if any(token_matches(h, k) or (len(k) >= 4 and h.startswith(k)) for h in hay))
        if not structured and hits == 0:
            return None
        score += hits * 2
    if part.featured:
        score += 1.5
    if part.status == "available":
        score += 1
    if part.fitment == "verified":
        score += 0.5
    lv = part.last_verified if part.last_verified.tzinfo else part.last_verified.replace(tzinfo=timezone.utc)
    age = (datetime.now(timezone.utc) - lv).total_seconds() / 86400
    return score + max(0.0, 1 - age / 60)


def duplicate_key(p) -> str:
    if p.oem:
        return f"{p.supplier_id}|{p.part_type_id}|{normalize_oem(p.oem)}"
    return f"{p.supplier_id}|{p.part_type_id}|{p.make}|{p.model}|{p.year_from}-{p.year_to}|{p.engine or ''}"
