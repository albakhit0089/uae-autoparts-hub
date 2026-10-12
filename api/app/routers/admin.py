"""Administration (role: admin)."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..catalog import part_types
from ..db import get_db
from ..models import AuditLog, ImportJob, Inquiry, Part, PartRequest, Plan, Quotation, Report, RequestMatch, SearchEvent, Supplier, SupplierDocument, User
from ..schemas import ModerateIn, PlanPatchIn, ResolveIn, SupplierStatusIn
from ..security import require_role
from ..serializers import import_out, inquiry_out, part_out, parts_out, request_out, supplier_out
from ..services.query_parser import duplicate_key
from .common import audit

router = APIRouter(prefix="/admin", tags=["admin"])
Admin = Depends(require_role("admin"))


def _aware(d: datetime) -> datetime:
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


@router.get("/overview")
def overview(user: User = Admin, db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    weeks = list(range(7, -1, -1))
    sup_dates = [_aware(d) for (d,) in db.query(Supplier.created_at)]
    part_dates = [_aware(d) for (d,) in db.query(Part.created_at)]
    inq_dates = [_aware(d) for (d,) in db.query(Inquiry.created_at).filter(Inquiry.created_at > now - timedelta(weeks=8))]

    def cumulative(ds):
        return [sum(1 for d in ds if (now - d).days >= w * 7) for w in weeks]

    def weekly(ds):
        return [sum(1 for d in ds if w * 7 <= (now - d).days < (w + 1) * 7) for w in weeks]

    since = now - timedelta(days=30)
    day = func.date(SearchEvent.created_at)
    searches = [{"day": str(d), "count": c} for d, c in db.query(day, func.count()).filter(SearchEvent.created_at > since).group_by(day).order_by(day)]
    total_req = db.query(PartRequest).count()
    responded = db.query(func.count(func.distinct(Quotation.request_id))).scalar() or 0
    return {
        "suppliers": {"approved": db.query(Supplier).filter(Supplier.status == "approved").count(),
                      "pending": db.query(Supplier).filter(Supplier.status == "pending").count()},
        "listings": db.query(Part).filter(Part.status != "sold").count(),
        "pendingListings": db.query(Part).filter(Part.moderation == "pending").count(),
        "openReports": db.query(Report).filter(Report.status == "open").count(),
        "inquiries30d": db.query(Inquiry).filter(Inquiry.created_at > since).count(),
        "responseRate": round(responded / total_req * 100) if total_req else 0,
        "charts": {"supplierGrowth": cumulative(sup_dates), "inventory": cumulative(part_dates), "inquiries": weekly(inq_dates), "searches": searches},
    }


@router.get("/suppliers")
def suppliers(user: User = Admin, db: Session = Depends(get_db)):
    counts = dict(db.query(Part.supplier_id, func.count()).group_by(Part.supplier_id).all())
    docs: dict[str, list] = {}
    for d in db.query(SupplierDocument):
        docs.setdefault(d.supplier_id, []).append(d)
    return [supplier_out(s, private=True, docs=docs.get(s.id, []), listings=counts.get(s.id, 0)) for s in db.query(Supplier).order_by(Supplier.created_at.desc())]


@router.post("/suppliers/{sid}/status")
def set_supplier_status(sid: str, body: SupplierStatusIn, user: User = Admin, db: Session = Depends(get_db)):
    s = db.get(Supplier, sid)
    if not s:
        raise HTTPException(404, "Supplier not found")
    s.status = body.status
    if body.status == "approved":
        for p in db.query(Part).filter(Part.supplier_id == sid, Part.moderation == "pending"):
            if not part_types().get(p.part_type_id, {}).get("safetyCritical"):
                p.moderation = "approved"
    audit(db, user.id, f"supplier.{body.status}", sid)
    db.commit()
    return {"ok": True}


@router.post("/suppliers/{sid}/feature")
def feature_supplier(sid: str, user: User = Admin, db: Session = Depends(get_db)):
    s = db.get(Supplier, sid)
    if not s:
        raise HTTPException(404, "Supplier not found")
    s.featured = not s.featured
    audit(db, user.id, "supplier.feature", sid)
    db.commit()
    return {"ok": True}


@router.get("/listings")
def listings(filter: str = Query("pending", pattern="^(pending|all|stale|featured)$"), user: User = Admin, db: Session = Depends(get_db)):
    q = db.query(Part)
    if filter == "pending":
        q = q.filter(Part.moderation == "pending")
    elif filter == "stale":
        q = q.filter(Part.status != "sold", Part.last_verified < datetime.now(timezone.utc) - timedelta(days=30))
    elif filter == "featured":
        q = q.filter(Part.featured.is_(True))
    parts = q.order_by(Part.created_at.desc()).limit(500).all()
    sids = {p.supplier_id for p in parts}
    return {"parts": parts_out(db, parts), "suppliers": {s.id: supplier_out(s, private=True) for s in db.query(Supplier).filter(Supplier.id.in_(sids))}}


@router.post("/listings/{pid}/moderate")
def moderate(pid: str, body: ModerateIn, user: User = Admin, db: Session = Depends(get_db)):
    p = db.get(Part, pid)
    if not p:
        raise HTTPException(404, "Listing not found")
    p.moderation = body.decision
    audit(db, user.id, f"listing.{body.decision}", pid)
    db.commit()
    return {"ok": True}


@router.post("/listings/{pid}/feature")
def feature(pid: str, user: User = Admin, db: Session = Depends(get_db)):
    p = db.get(Part, pid)
    if not p:
        raise HTTPException(404, "Listing not found")
    p.featured = not p.featured
    audit(db, user.id, "listing.feature", pid)
    db.commit()
    return {"ok": True}


@router.delete("/listings/{pid}")
def remove(pid: str, user: User = Admin, db: Session = Depends(get_db)):
    p = db.get(Part, pid)
    if p:
        db.delete(p)
        audit(db, user.id, "listing.remove", pid)
        db.commit()
    return {"ok": True}


@router.get("/duplicates")
def duplicates(user: User = Admin, db: Session = Depends(get_db)):
    groups: dict[str, list[Part]] = {}
    for p in db.query(Part).filter(Part.status != "sold"):
        groups.setdefault(duplicate_key(p), []).append(p)
    return [[part_out(p) for p in g] for g in groups.values() if len(g) > 1]


@router.get("/imports")
def imports(user: User = Admin, db: Session = Depends(get_db)):
    return [import_out(j) for j in db.query(ImportJob).order_by(ImportJob.created_at.desc()).limit(200)]


@router.get("/inquiries")
def inquiries(user: User = Admin, db: Session = Depends(get_db)):
    rows = db.query(Inquiry).order_by(Inquiry.created_at.desc()).limit(100).all()
    parts = {p.id: p for p in db.query(Part).filter(Part.id.in_({i.part_id for i in rows}))}
    reqs = []
    for r in db.query(PartRequest).order_by(PartRequest.created_at.desc()).limit(200):
        matched = [m.supplier_id for m in db.query(RequestMatch).filter(RequestMatch.request_id == r.id)]
        reqs.append({"request": request_out(r, matched), "quotes": db.query(Quotation).filter(Quotation.request_id == r.id).count()})
    return {"inquiries": [{"inquiry": inquiry_out(i), "part": part_out(parts[i.part_id]) if i.part_id in parts else None} for i in rows], "requests": reqs}


@router.get("/reports")
def reports(user: User = Admin, db: Session = Depends(get_db)):
    out = []
    for r in db.query(Report).order_by(Report.created_at.desc()).limit(200):
        p = db.get(Part, r.part_id)
        out.append({"report": {"id": r.id, "partId": r.part_id, "reporterId": r.reporter_id, "reason": r.reason, "status": r.status,
                               "createdAt": r.created_at.isoformat()}, "part": part_out(p) if p else None})
    return out


@router.post("/reports/{rid}/resolve")
def resolve(rid: str, body: ResolveIn, user: User = Admin, db: Session = Depends(get_db)):
    r = db.get(Report, rid)
    if not r:
        raise HTTPException(404, "Report not found")
    r.status = "resolved"
    if body.action == "remove-listing" and (p := db.get(Part, r.part_id)):
        p.moderation = "rejected"
    audit(db, user.id, f"report.{body.action}", rid)
    db.commit()
    return {"ok": True}


@router.patch("/plans/{plan_id}")
def update_plan(plan_id: str, body: PlanPatchIn, user: User = Admin, db: Session = Depends(get_db)):
    p = db.get(Plan, plan_id)
    if not p:
        raise HTTPException(404, "Plan not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(p, k, v)
    audit(db, user.id, "plan.update", plan_id)
    db.commit()
    return {"ok": True}


@router.get("/audit")
def audit_log(user: User = Admin, db: Session = Depends(get_db)):
    emails = dict(db.query(User.id, User.email).all())
    return [{"id": str(a.id), "actorId": a.actor_id, "actor": emails.get(a.actor_id, a.actor_id), "action": a.action, "target": a.target,
             "at": a.at.isoformat()} for a in db.query(AuditLog).order_by(AuditLog.at.desc()).limit(200)]
