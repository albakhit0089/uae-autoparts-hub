"""Reference catalogue loaded from shared/catalog.json (exported from the frontend source)."""
import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from .config import get_settings


@lru_cache
def catalog() -> dict[str, Any]:
    return json.loads(Path(get_settings().catalog_path).read_text(encoding="utf-8"))


def makes() -> list[dict]:
    return catalog()["makes"]


def categories() -> list[dict]:
    return catalog()["categories"]


def emirates() -> list[dict]:
    return catalog()["emirates"]


@lru_cache
def part_types() -> dict[str, dict]:
    return {t["id"]: {**t, "categoryId": c["id"]} for c in categories() for t in c["types"]}


def find_make(make_id: str | None) -> dict | None:
    return next((m for m in makes() if m["id"] == make_id), None)


def find_model(make_id: str | None, model_id: str | None) -> dict | None:
    m = find_make(make_id)
    return next((x for x in m["models"] if x["id"] == model_id), None) if m else None


def find_area(emirate: str, area: str) -> dict | None:
    e = next((x for x in emirates() if x["id"] == emirate), None)
    return next((a for a in e["areas"] if a["id"] == area), None) if e else None


def emirate_ids() -> set[str]:
    return {e["id"] for e in emirates()}
