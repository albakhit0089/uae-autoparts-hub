"""NHTSA vPIC import job (vehicle reference data).

vPIC is a free US government API covering vehicles sold in the US market. It
does NOT cover many GCC-specification variants (engine/trim combos sold only
in the Gulf), so imported records are stored with market_spec='Unknown' and
source='nhtsa' and never overwrite seed/supplier/TecDoc records. Gaps are
filled by supplier-provided data or a licensed catalogue (TecDoc).

Run: python -m app.jobs import-nhtsa --make toyota --years 2015-2024
"""
from __future__ import annotations

import logging

import httpx
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import Generation, Make, Model, Variant

log = logging.getLogger("nhtsa")

NHTSA_MAKE_NAMES = {"mercedes-benz": "mercedes-benz", "toyota": "toyota", "nissan": "nissan", "bmw": "bmw", "lexus": "lexus",
                    "hyundai": "hyundai", "kia": "kia", "ford": "ford", "honda": "honda", "mitsubishi": "mitsubishi",
                    "chevrolet": "chevrolet", "gmc": "gmc"}


def fetch_models(make_id: str, year: int, client: httpx.Client | None = None) -> list[str]:
    name = NHTSA_MAKE_NAMES.get(make_id, make_id)
    url = f"{get_settings().nhtsa_base_url}/GetModelsForMakeYear/make/{name}/modelyear/{year}?format=json"
    c = client or httpx.Client(timeout=20)
    r = c.get(url)
    r.raise_for_status()
    return sorted({row["Model_Name"] for row in r.json().get("Results", []) if row.get("Model_Name")})


def import_make(db: Session, make_id: str, years: range, client: httpx.Client | None = None) -> dict:
    """Adds models missing from the catalogue (as generation 'nhtsa-<year>' placeholders). Idempotent."""
    make = db.get(Make, make_id)
    if not make:
        raise ValueError(f"Unknown make {make_id}; add it to the catalogue first")
    added_models = added_gens = 0
    failures: list[str] = []
    for year in years:
        try:
            names = fetch_models(make_id, year, client)
        except httpx.HTTPError as e:
            failures.append(f"{year}: {e}")
            continue
        for name in names:
            slug = name.lower().replace(" ", "-")
            model_id = f"{make_id}/{slug}"
            if not db.get(Model, model_id):
                db.add(Model(id=model_id, make_id=make_id, slug=slug, name=name, name_ar=name, aliases=[]))
                added_models += 1
            gen_id = f"{model_id}/nhtsa-{year}"
            if not db.get(Generation, gen_id):
                db.add(Generation(id=gen_id, model_id=model_id, code=f"US-{year}", year_from=year, year_to=year))
                db.add(Variant(id=f"{gen_id}/unknown", generation_id=gen_id, name="Unknown variant", engine_code="UNKNOWN",
                               market_spec="Unknown", source="nhtsa"))
                added_gens += 1
        db.commit()
    log.info("NHTSA import %s: +%d models, +%d generations, %d failures", make_id, added_models, added_gens, len(failures))
    return {"make": make_id, "addedModels": added_models, "addedGenerations": added_gens, "failures": failures}
