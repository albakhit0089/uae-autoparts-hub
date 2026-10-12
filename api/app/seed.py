"""Reference data + demo data loaders.

* load_reference(db): makes/models/generations/variants/categories/part types from shared/catalog.json (idempotent).
* load_demo(db): FICTIONAL sample suppliers + listings from shared/sample-data.json, plus demo accounts.
  Every record is flagged is_sample=true and every supplier name ends in "(Sample)".
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from .catalog import catalog
from .config import get_settings
from .models import Generation, Make, Model, Part, PartCategory, PartImage, PartType, Plan, Supplier, SupplierDocument, User, Variant
from .security import hash_password

DEMO_PASSWORD = "Demo@1234"


def load_reference(db: Session) -> None:
    c = catalog()
    # Models have no ORM relationships, so flush each level before its children to satisfy foreign keys.
    for m in c["makes"]:
        db.merge(Make(id=m["id"], name=m["name"], name_ar=m["nameAr"], aliases=m["aliases"]))
    db.flush()
    for m in c["makes"]:
        for md in m["models"]:
            db.merge(Model(id=f"{m['id']}/{md['id']}", make_id=m["id"], slug=md["id"], name=md["name"], name_ar=md["nameAr"], aliases=md.get("aliases", [])))
    db.flush()
    for m in c["makes"]:
        for md in m["models"]:
            for g in md["generations"]:
                db.merge(Generation(id=f"{m['id']}/{md['id']}/{g['code']}", model_id=f"{m['id']}/{md['id']}", code=g["code"], year_from=g["yearFrom"], year_to=g["yearTo"]))
    db.flush()
    for m in c["makes"]:
        for md in m["models"]:
            for g in md["generations"]:
                gid = f"{m['id']}/{md['id']}/{g['code']}"
                for v in g["variants"]:
                    db.merge(Variant(id=f"{gid}/{v['id']}", generation_id=gid, name=v["name"], engine_code=v["engineCode"],
                                     capacity_l=v["capacity"], fuel=v["fuel"], transmission=v["transmission"], source="seed"))
    for cat in c["categories"]:
        db.merge(PartCategory(id=cat["id"], name=cat["en"], name_ar=cat["ar"]))
    db.flush()
    for cat in c["categories"]:
        for t in cat["types"]:
            db.merge(PartType(id=t["id"], category_id=cat["id"], name=t["en"], name_ar=t["ar"], synonyms=t["synonyms"],
                              safety_critical=bool(t.get("safetyCritical"))))
    for pid, name, price, limit, slots, active in [("free", "Free (MVP)", 0, 200, 0, True), ("growth", "Growth", 299, 2000, 5, False), ("pro", "Pro", 799, 20000, 25, False)]:
        if not db.get(Plan, pid):
            db.add(Plan(id=pid, name=name, price_aed=price, listing_limit=limit, featured_slots=slots, active=active))
    db.commit()


def _dt(s: str, shift) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00")) + shift


def load_demo(db: Session) -> dict:
    load_reference(db)
    data = json.loads((Path(get_settings().catalog_path).parent / "sample-data.json").read_text(encoding="utf-8"))
    shift = datetime.now(timezone.utc) - datetime.fromisoformat(data["exportedAt"].replace("Z", "+00:00"))
    pw = hash_password(DEMO_PASSWORD)
    users = {
        "u-admin": User(id="u-admin", email="admin@demo.ae", name="Demo Administrator", role="admin", password_hash=pw),
        "u-supplier": User(id="u-supplier", email="supplier@demo.ae", name="Demo Supplier", role="supplier", password_hash=pw, whatsapp_consent=True),
        "u-customer": User(id="u-customer", email="customer@demo.ae", name="Demo Customer", role="customer", password_hash=pw, whatsapp_consent=True),
    }
    for u in users.values():
        if not db.get(User, u.id):
            db.add(u)
    db.flush()
    for s in data["suppliers"]:
        if db.get(Supplier, s["id"]):
            continue
        db.add(Supplier(
            id=s["id"], owner_id="u-supplier" if s["id"] == "s1" else None, name=s["name"], name_ar=s.get("nameAr"),
            trade_licence=s["tradeLicence"], contact_name=s["contactName"], phone=s["phone"], whatsapp=s["whatsapp"], email=s["email"],
            emirate=s["emirate"], area=s["area"], address=s["address"], lat=s["lat"], lng=s["lng"], emirates_served=s["emiratesServed"],
            makes=s["makes"], categories=s["categories"], status=s["status"], delivery=s["delivery"], featured=s["featured"],
            plan=s["plan"], is_sample=True, created_at=_dt(s["createdAt"], shift),
        ))
        db.flush()
        for d in s["docs"]:
            db.add(SupplierDocument(supplier_id=s["id"], name=d["name"], kind=d["kind"], size_kb=d["sizeKb"]))
    db.flush()
    n = 0
    for p in data["parts"]:
        if db.get(Part, p["id"]):
            continue
        db.add(Part(
            id=p["id"], supplier_id=p["supplierId"], name=p["name"], category_id=p["categoryId"], part_type_id=p["partTypeId"],
            oem=(p.get("oem") or "").upper().replace("-", "") or None, make=p["make"], model=p["model"], generation=p.get("generation"),
            year_from=p["yearFrom"], year_to=p["yearTo"], engine=p.get("engine"), transmission=p.get("transmission"),
            market_spec=p["marketSpec"], condition=p["condition"], price=p["price"], quantity=p["quantity"], warranty_days=p["warrantyDays"],
            emirate=p["emirate"], area=p["area"], description=p["description"], donor_vehicle=p.get("donorVehicle"), status=p["status"],
            fitment=p["fitment"], moderation=p["moderation"], featured=p["featured"], views=p["views"], source="sample", is_sample=True,
            last_verified=_dt(p["lastVerified"], shift), created_at=_dt(p["createdAt"], shift),
        ))
        db.flush()
        for i, url in enumerate(p["images"]):
            db.add(PartImage(part_id=p["id"], url=url, position=i, usage_rights="placeholder"))
        n += 1
    db.commit()
    return {"suppliers": len(data["suppliers"]), "parts": n}
