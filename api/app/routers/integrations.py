"""Method B — authenticated supplier inventory API (X-API-Key)."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import InventoryEvent, Part, Plan, Supplier
from ..schemas import InventorySyncIn
from ..security import rate_limit, supplier_from_api_key
from ..serializers import import_out
from .supplier import _apply_import

router = APIRouter(tags=["integrations"])


@router.put("/integrations/inventory", dependencies=[Depends(rate_limit("integration", 30))])
def sync_inventory(body: InventorySyncIn, s: Supplier = Depends(supplier_from_api_key), db: Session = Depends(get_db)):
    """Upsert items by `sku`. With mode=replace, SKUs not present in the payload are marked sold."""
    if any(not str(i.get("sku", "")).strip() for i in body.items):
        raise HTTPException(422, "Every item needs a sku")
    job = _apply_import(db, s, f"api-sync-{datetime.now(timezone.utc):%Y%m%dT%H%M%S}", body.items, source="api")
    if body.mode == "replace":
        skus = {str(i["sku"]).strip() for i in body.items}
        for p in db.query(Part).filter(Part.supplier_id == s.id, Part.sku.isnot(None), Part.status != "sold"):
            if p.sku not in skus:
                p.status, p.quantity = "sold", 0
                db.add(InventoryEvent(part_id=p.id, kind="deleted", source="api"))
        db.commit()
    return import_out(job)


@router.delete("/integrations/inventory/{sku}", dependencies=[Depends(rate_limit("integration", 120))])
def delete_item(sku: str, s: Supplier = Depends(supplier_from_api_key), db: Session = Depends(get_db)):
    p = db.query(Part).filter(Part.supplier_id == s.id, Part.sku == sku).first()
    if not p:
        raise HTTPException(404, "SKU not found")
    p.status, p.quantity = "sold", 0
    db.add(InventoryEvent(part_id=p.id, kind="deleted", source="api"))
    db.commit()
    return {"ok": True}


@router.get("/plans", tags=["catalogue"])
def plans(db: Session = Depends(get_db)):
    return [{"id": p.id, "name": p.name, "priceAed": p.price_aed, "listingLimit": p.listing_limit, "featuredSlots": p.featured_slots,
             "active": p.active} for p in db.query(Plan).order_by(Plan.price_aed)]
