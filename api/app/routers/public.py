"""Public catalogue: search, listing pages, suppliers, inquiries, part requests."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..catalog import part_types
from ..db import get_db
from ..models import Inquiry, Part, PartRequest, Report, RequestMatch, SearchEvent, Supplier, User
from ..schemas import InquiryIn, ReportIn, RequestIn
from ..security import ip_hash, optional_user, rate_limit
from ..serializers import part_out, parts_out, request_out, supplier_out
from ..services import whatsapp
from ..services.query_parser import assess_compatibility, merge_filters, normalize_oem, score_part
from .common import suppliers_map

router = APIRouter(tags=["catalogue"])


def _live(db: Session):
    return db.query(Part).join(Supplier, Supplier.id == Part.supplier_id).filter(
        Supplier.status == "approved", Part.moderation == "approved", Part.status != "sold"
    )


@router.get("/parts/search", dependencies=[Depends(rate_limit("search", 120))])
def search(
    db: Session = Depends(get_db),
    q: str | None = Query(None, max_length=300), make: str | None = None, model: str | None = None, year: int | None = None,
    engine: str | None = None, transmission: str | None = None, category: str | None = None, partType: str | None = None,
    oem: str | None = None, emirate: str | None = None, area: str | None = None, minPrice: int | None = None,
    maxPrice: int | None = None, condition: str | None = None, warranty: bool | None = None, sort: str = "relevance",
):
    raw = dict(q=q, make=make, model=model, year=year, engine=engine, transmission=transmission, category=category, partType=partType,
               oem=oem, emirate=emirate, area=area, minPrice=minPrice, maxPrice=maxPrice, condition=condition, warranty=warranty, sort=sort)
    applied, parsed = merge_filters(raw)
    qry = _live(db)
    a = applied
    if a.get("oem"):
        qry = qry.filter(Part.oem == normalize_oem(a["oem"]))
    if a.get("make"):
        qry = qry.filter(Part.make == a["make"])
    if a.get("model"):
        qry = qry.filter(Part.model == a["model"])
    if a.get("year"):
        qry = qry.filter(Part.year_from <= a["year"], Part.year_to >= a["year"])
    if a.get("engine"):
        qry = qry.filter((Part.engine.is_(None)) | (Part.engine == a["engine"]))
    if a.get("transmission"):
        qry = qry.filter((Part.transmission.is_(None)) | (func.lower(Part.transmission).contains(a["transmission"].lower())))
    if a.get("partType"):
        qry = qry.filter(Part.part_type_id == a["partType"])
    if a.get("category"):
        qry = qry.filter(Part.category_id == a["category"])
    if a.get("emirate"):
        qry = qry.filter(Part.emirate == a["emirate"])
    if a.get("area"):
        qry = qry.filter(Part.area == a["area"])
    if a.get("maxPrice") is not None:
        qry = qry.filter(Part.price <= a["maxPrice"])
    if a.get("minPrice") is not None:
        qry = qry.filter(Part.price >= a["minPrice"])
    if a.get("condition"):
        qry = qry.filter(Part.condition == a["condition"])
    if a.get("warranty"):
        qry = qry.filter(Part.warranty_days > 0)

    structured = any(a.get(k) for k in ("make", "partType", "category", "oem", "model"))
    keywords = parsed.keywords if parsed else []
    scored = []
    for p in qry.limit(2000):
        s = score_part(p, keywords, structured)
        if s is not None:
            scored.append((s, p))
    if sort == "price-asc":
        scored.sort(key=lambda x: x[1].price)
    elif sort == "price-desc":
        scored.sort(key=lambda x: -x[1].price)
    elif sort == "newest":
        scored.sort(key=lambda x: x[1].created_at, reverse=True)
    else:
        scored.sort(key=lambda x: (-x[0], x[1].price))
    scored = scored[:200]

    if q:
        db.add(SearchEvent(query=q[:300], parsed=parsed.__dict__ if parsed else {}, results=len(scored)))
        db.commit()
    parts = [p for _, p in scored]
    outs = parts_out(db, parts)
    results = [
        {"part": o, "score": s, "compatibility": assess_compatibility(p, a.get("make"), a.get("model"), a.get("year"), a.get("engine"), a.get("oem"))}
        for (s, p), o in zip(scored, outs, strict=True)
    ]
    return {"results": results, "parsed": parsed.__dict__ if parsed else None, "applied": {k: v for k, v in a.items() if v is not None},
            "suppliers": suppliers_map(db, {p.supplier_id for p in parts})}


@router.get("/parts/featured")
def featured(limit: int = Query(8, le=50), db: Session = Depends(get_db)):
    parts = _live(db).filter(Part.featured.is_(True)).order_by(Part.created_at.desc()).limit(limit).all()
    return {"parts": parts_out(db, parts), "suppliers": suppliers_map(db, {p.supplier_id for p in parts})}


@router.get("/parts/recent")
def recent(limit: int = Query(8, le=50), db: Session = Depends(get_db)):
    parts = _live(db).order_by(Part.created_at.desc()).limit(limit).all()
    return {"parts": parts_out(db, parts), "suppliers": suppliers_map(db, {p.supplier_id for p in parts})}


@router.get("/parts/{part_id}")
def get_part(part_id: str, db: Session = Depends(get_db), user: User | None = Depends(optional_user)):
    p = db.get(Part, part_id)
    if not p:
        raise HTTPException(404, "Listing not found")
    s = db.get(Supplier, p.supplier_id)
    owner = user and (user.role == "admin" or s.owner_id == user.id)
    if (p.moderation != "approved" or s.status != "approved") and not owner:
        raise HTTPException(404, "Listing not found")
    p.views += 1
    db.commit()
    return {"part": parts_out(db, [p])[0], "supplier": supplier_out(s)}


@router.get("/parts/{part_id}/compare")
def compare(part_id: str, db: Session = Depends(get_db)):
    base = db.get(Part, part_id)
    if not base:
        raise HTTPException(404, "Listing not found")
    q = _live(db)
    if base.oem:
        q = q.filter(Part.oem == base.oem)
        basis = "oem"
    else:
        q = q.filter(Part.oem.is_(None), Part.part_type_id == base.part_type_id, Part.make == base.make, Part.model == base.model,
                     Part.year_from <= base.year_to, Part.year_to >= base.year_from)
        q = q.filter(Part.engine == base.engine) if base.engine else q.filter(Part.engine.is_(None))
        basis = "fitment"
    rows = q.order_by(Part.price).all()
    outs = parts_out(db, rows)
    return {"base": part_out(base), "rows": [{"part": o, "basis": basis} for o in outs], "suppliers": suppliers_map(db, {p.supplier_id for p in rows})}


@router.post("/parts/{part_id}/report", dependencies=[Depends(rate_limit("report", 10))])
def report(part_id: str, body: ReportIn, db: Session = Depends(get_db), user: User | None = Depends(optional_user)):
    if not db.get(Part, part_id):
        raise HTTPException(404, "Listing not found")
    db.add(Report(part_id=part_id, reporter_id=user.id if user else None, reason=body.reason))
    db.commit()
    return {"ok": True}


@router.get("/suppliers")
def list_suppliers(db: Session = Depends(get_db)):
    counts = dict(_live(db).with_entities(Part.supplier_id, func.count()).group_by(Part.supplier_id).all())
    return [supplier_out(s, listings=counts.get(s.id, 0)) for s in db.query(Supplier).filter(Supplier.status == "approved")]


@router.get("/suppliers/{supplier_id}")
def get_supplier(supplier_id: str, db: Session = Depends(get_db)):
    s = db.get(Supplier, supplier_id)
    if not s or s.status != "approved":
        raise HTTPException(404, "Supplier not found")
    parts = _live(db).filter(Part.supplier_id == supplier_id).order_by(Part.created_at.desc()).all()
    return {"supplier": supplier_out(s), "parts": parts_out(db, parts)}


@router.post("/inquiries", dependencies=[Depends(rate_limit("inquiry", 20))])
def log_inquiry(body: InquiryIn, request: Request, db: Session = Depends(get_db), user: User | None = Depends(optional_user)):
    p = db.get(Part, body.part_id)
    if not p or p.moderation != "approved":
        raise HTTPException(404, "Listing not found")
    s = db.get(Supplier, p.supplier_id)
    msg = whatsapp.inquiry_message(p, body.lang)
    db.add(Inquiry(part_id=p.id, supplier_id=s.id, customer_id=user.id if user else None,
                   guest_name=None if user else (body.guest_name or "Guest"), message=msg, ip_hash=ip_hash(request)))
    db.commit()
    return {"url": whatsapp.wa_link(s.whatsapp, msg), "isSample": s.is_sample or not s.whatsapp}


@router.post("/requests", dependencies=[Depends(rate_limit("request", 5))])
def create_request(body: RequestIn, db: Session = Depends(get_db), user: User | None = Depends(optional_user)):
    pt = part_types().get(body.part_type_id)
    if not pt:
        raise HTTPException(422, "Unknown part type")
    since = datetime.now(timezone.utc) - timedelta(hours=1)
    if db.query(PartRequest).filter(PartRequest.contact_phone == body.contact_phone, PartRequest.created_at > since).count() >= 3:
        raise HTTPException(429, "Too many requests from this contact. Please try again later.")
    r = PartRequest(customer_id=user.id if user else None, **body.model_dump(exclude={"customer_id"}))
    db.add(r)
    db.flush()
    candidates = [s for s in db.query(Supplier).filter(Supplier.status == "approved") if body.make in s.makes and pt["categoryId"] in s.categories]
    candidates.sort(key=lambda s: s.emirate != body.emirate)
    for s in candidates:
        db.add(RequestMatch(request_id=r.id, supplier_id=s.id))
        if s.whatsapp:
            # Template notification (no customer contact details are included).
            whatsapp.send_template(s.whatsapp, "new_part_request", [pt["en"], f"{body.make} {body.model} {body.year}", body.emirate])
    db.commit()
    return {"request": request_out(r, [s.id for s in candidates]), "matchedCount": len(candidates)}

