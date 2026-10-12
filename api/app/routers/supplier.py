"""Supplier portal (Method C dashboard + Method A file import)."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..catalog import part_types
from ..db import get_db
from ..models import ImportJob, Inquiry, InventoryEvent, Part, PartImage, PartRequest, Quotation, RequestMatch, Supplier, SupplierDocument
from ..schemas import DocIn, IdsIn, ImportIn, PartIn, QuotationIn, StatusIn, SupplierPatchIn
from ..security import current_supplier, hash_api_key, new_api_key
from ..serializers import import_out, inquiry_out, part_out, parts_out, quotation_out, request_out, supplier_out
from ..services.importer import plan_import, read_upload
from ..services.query_parser import normalize_oem
from .common import audit

router = APIRouter(prefix="/supplier", tags=["supplier"])


def _own_part(db: Session, s: Supplier, pid: str) -> Part:
    p = db.get(Part, pid)
    if not p or p.supplier_id != s.id:
        raise HTTPException(404, "Listing not found")
    return p


def _set_images(db: Session, part_id: str, images: list[str]) -> None:
    # In production, images are uploaded to object storage first and only URLs arrive here.
    db.query(PartImage).filter(PartImage.part_id == part_id).delete()
    for i, url in enumerate(images[:6]):
        if url.startswith(("https://", "sample:")) or (url.startswith("data:image/") and len(url) < 1_500_000):
            db.add(PartImage(part_id=part_id, url=url, position=i))


@router.get("/me")
def me(s: Supplier = Depends(current_supplier), db: Session = Depends(get_db)):
    docs = db.query(SupplierDocument).filter(SupplierDocument.supplier_id == s.id).all()
    return supplier_out(s, private=True, docs=docs)


@router.patch("/me")
def update_me(body: SupplierPatchIn, s: Supplier = Depends(current_supplier), db: Session = Depends(get_db)):
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    audit(db, s.owner_id, "supplier.update_profile", s.id)
    db.commit()
    return supplier_out(s, private=True)


@router.post("/documents")
def add_document(body: DocIn, s: Supplier = Depends(current_supplier), db: Session = Depends(get_db)):
    db.add(SupplierDocument(supplier_id=s.id, name=body.name, kind=body.kind, size_kb=body.size_kb))
    db.commit()
    return {"ok": True}


@router.get("/parts")
def my_parts(s: Supplier = Depends(current_supplier), db: Session = Depends(get_db)):
    return parts_out(db, db.query(Part).filter(Part.supplier_id == s.id).order_by(Part.created_at.desc()).all())


def _validate(body: PartIn) -> dict:
    pt = part_types().get(body.part_type_id)
    if not pt:
        raise HTTPException(422, "Choose a part type")
    if body.year_to < body.year_from:
        raise HTTPException(422, "Check the year range")
    if pt.get("safetyCritical") and not body.oem:
        raise HTTPException(422, f"{pt['en']} is a safety-critical part — an OEM part number is required")
    return pt


@router.post("/parts")
def create_part(body: PartIn, s: Supplier = Depends(current_supplier), db: Session = Depends(get_db)):
    pt = _validate(body)
    data = body.model_dump(exclude={"id", "images"})
    data["oem"] = normalize_oem(body.oem) if body.oem else None
    data["name"] = body.name or pt["en"]
    p = Part(supplier_id=s.id, category_id=pt["categoryId"], emirate=s.emirate, area=s.area, source="dashboard",
             fitment="verified" if body.oem else "likely",
             moderation="pending" if (pt.get("safetyCritical") or s.status != "approved") else "approved", **data)
    db.add(p)
    db.flush()
    _set_images(db, p.id, body.images)
    db.add(InventoryEvent(part_id=p.id, kind="created", new_value=str(p.price), source="dashboard"))
    audit(db, s.owner_id, "listing.create", p.id)
    db.commit()
    return part_out(p, body.images)


@router.put("/parts/{pid}")
def update_part(pid: str, body: PartIn, s: Supplier = Depends(current_supplier), db: Session = Depends(get_db)):
    pt = _validate(body)
    p = _own_part(db, s, pid)
    old_price = p.price
    for k, v in body.model_dump(exclude={"id", "images"}).items():
        setattr(p, k, v)
    p.oem = normalize_oem(body.oem) if body.oem else None
    p.name = body.name or pt["en"]
    p.category_id = pt["categoryId"]
    p.fitment = "verified" if body.oem else "likely"
    p.last_verified = datetime.now(timezone.utc)
    if pt.get("safetyCritical"):
        p.moderation = "pending"
    _set_images(db, p.id, body.images)
    if old_price != p.price:
        db.add(InventoryEvent(part_id=p.id, kind="price", old_value=str(old_price), new_value=str(p.price), source="dashboard"))
    audit(db, s.owner_id, "listing.update", p.id)
    db.commit()
    return part_out(p, body.images)


@router.post("/parts/{pid}/status")
def set_status(pid: str, body: StatusIn, s: Supplier = Depends(current_supplier), db: Session = Depends(get_db)):
    p = _own_part(db, s, pid)
    db.add(InventoryEvent(part_id=p.id, kind="status", old_value=p.status, new_value=body.status, source="dashboard"))
    p.status = body.status
    if body.status == "sold":
        p.quantity = 0
    p.last_verified = datetime.now(timezone.utc)
    audit(db, s.owner_id, f"listing.{body.status}", p.id)
    db.commit()
    return {"ok": True}


@router.post("/parts/verify")
def verify(body: IdsIn, s: Supplier = Depends(current_supplier), db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    n = db.query(Part).filter(Part.supplier_id == s.id, Part.id.in_(body.ids)).update({"last_verified": now}, synchronize_session=False)
    db.commit()
    return {"verified": n}


@router.delete("/parts/{pid}")
def delete_part(pid: str, s: Supplier = Depends(current_supplier), db: Session = Depends(get_db)):
    p = _own_part(db, s, pid)
    db.delete(p)
    audit(db, s.owner_id, "listing.delete", pid)
    db.commit()
    return {"ok": True}


def _apply_import(db: Session, s: Supplier, filename: str, rows: list[dict], source: str = "csv") -> ImportJob:
    existing = db.query(Part).filter(Part.supplier_id == s.id).all()
    plan = plan_import(rows, supplier_id=s.id, emirate=s.emirate, area=s.area, existing=existing, source=source)
    for rec in plan.create:
        if s.status != "approved":
            rec["moderation"] = "pending"
        p = Part(**rec)
        db.add(p)
        db.flush()
        db.add(PartImage(part_id=p.id, url=f"sample:{p.category_id}", position=0, usage_rights="placeholder"))
    by_id = {p.id: p for p in existing}
    for pid, rec in plan.update:
        p = by_id[pid]
        if p.price != rec["price"]:
            db.add(InventoryEvent(part_id=pid, kind="price", old_value=str(p.price), new_value=str(rec["price"]), source=source))
        for k, v in rec.items():
            setattr(p, k, v)
    job = ImportJob(supplier_id=s.id, filename=filename[:200], total=plan.total, created=len(plan.create), updated=len(plan.update),
                    duplicates=plan.duplicates, errors=plan.errors)
    db.add(job)
    db.flush()
    audit(db, s.owner_id, "inventory.import", job.id, source=source)
    db.commit()
    return job


@router.post("/imports")
def import_rows(body: ImportIn, s: Supplier = Depends(current_supplier), db: Session = Depends(get_db)):
    return import_out(_apply_import(db, s, body.filename, body.rows))


@router.post("/imports/file")
async def import_file(file: UploadFile = File(...), s: Supplier = Depends(current_supplier), db: Session = Depends(get_db)):
    data = await file.read(5 * 1024 * 1024 + 1)
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(413, "Maximum file size is 5 MB")
    try:
        rows = read_upload(file.filename or "upload.csv", data)
    except (ValueError, UnicodeDecodeError) as e:
        raise HTTPException(422, f"Could not read file: {e}") from e
    if len(rows) > 5000:
        raise HTTPException(422, "Maximum 5,000 rows per file")
    return import_out(_apply_import(db, s, file.filename or "upload", rows))


@router.get("/imports")
def my_imports(s: Supplier = Depends(current_supplier), db: Session = Depends(get_db)):
    return [import_out(j) for j in db.query(ImportJob).filter(ImportJob.supplier_id == s.id).order_by(ImportJob.created_at.desc())]


@router.get("/inquiries")
def inquiries(s: Supplier = Depends(current_supplier), db: Session = Depends(get_db)):
    rows = db.query(Inquiry).filter(Inquiry.supplier_id == s.id).order_by(Inquiry.created_at.desc()).limit(500).all()
    parts = {p.id: p for p in db.query(Part).filter(Part.id.in_({i.part_id for i in rows}))}
    return [{"inquiry": inquiry_out(i), "part": part_out(parts[i.part_id]) if i.part_id in parts else None} for i in rows]


@router.get("/requests")
def matched_requests(s: Supplier = Depends(current_supplier), db: Session = Depends(get_db)):
    out = []
    q = db.query(PartRequest).join(RequestMatch, RequestMatch.request_id == PartRequest.id).filter(RequestMatch.supplier_id == s.id)
    for r in q.order_by(PartRequest.created_at.desc()):
        mine = db.query(Quotation).filter(Quotation.request_id == r.id, Quotation.supplier_id == s.id).first()
        reveal = bool(mine and mine.status == "accepted")
        out.append({"request": request_out(r, [], reveal=reveal), "myQuotation": quotation_out(mine) if mine else None})
    return out


@router.post("/quotations")
def submit_quotation(body: QuotationIn, s: Supplier = Depends(current_supplier), db: Session = Depends(get_db)):
    if s.status != "approved":
        raise HTTPException(403, "Your account must be approved before you can send quotations")
    r = db.get(PartRequest, body.request_id)
    if not r or not db.get(RequestMatch, (r.id, s.id)):
        raise HTTPException(404, "Request not found")
    if r.status != "open":
        raise HTTPException(400, "This request is closed")
    q = db.query(Quotation).filter(Quotation.request_id == r.id, Quotation.supplier_id == s.id).first()
    data = body.model_dump(exclude={"request_id"})
    if q:
        for k, v in data.items():
            setattr(q, k, v)
        q.created_at = datetime.now(timezone.utc)
    else:
        db.add(Quotation(request_id=r.id, supplier_id=s.id, **data))
    audit(db, s.owner_id, "quotation.submit", r.id)
    db.commit()
    return {"ok": True}


@router.get("/stats")
def stats(s: Supplier = Depends(current_supplier), db: Session = Depends(get_db)):
    parts = db.query(Part).filter(Part.supplier_id == s.id).all()
    stale = datetime.now(timezone.utc) - timedelta(days=30)

    def aware(d):
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)

    return {
        "total": len(parts),
        "available": sum(p.quantity for p in parts if p.status == "available"),
        "inquiries": db.query(Inquiry).filter(Inquiry.supplier_id == s.id).count(),
        "quotations": db.query(Quotation).filter(Quotation.supplier_id == s.id).count(),
        "needsVerification": sum(1 for p in parts if p.status != "sold" and aware(p.last_verified) < stale),
        "pendingModeration": sum(1 for p in parts if p.moderation == "pending"),
        "mostViewed": parts_out(db, sorted(parts, key=lambda p: -p.views)[:5]),
    }


@router.post("/api-key")
def rotate_api_key(s: Supplier = Depends(current_supplier), db: Session = Depends(get_db)):
    if s.status != "approved":
        raise HTTPException(403, "API access is available once your account is approved")
    key = new_api_key()
    s.api_key_hash = hash_api_key(key)  # only the hash is stored
    audit(db, s.owner_id, "supplier.api_key_rotate", s.id)
    db.commit()
    return {"apiKey": key}
