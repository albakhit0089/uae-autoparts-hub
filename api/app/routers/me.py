"""Customer account: requests & offers, favourites, vehicles, inquiry history, privacy."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Favourite, Inquiry, Part, PartRequest, Quotation, RequestMatch, SavedVehicle, Supplier, User
from ..schemas import PreferencesIn, VehicleIn
from ..security import current_user, require_role
from ..serializers import inquiry_out, part_out, parts_out, quotation_out, request_out, supplier_out
from ..services import whatsapp
from .common import suppliers_map

router = APIRouter(tags=["customer"])


def _matched(db: Session, rid: str) -> list[str]:
    return [m.supplier_id for m in db.query(RequestMatch).filter(RequestMatch.request_id == rid)]


@router.get("/me/requests")
def my_requests(user: User = Depends(require_role("customer", "admin")), db: Session = Depends(get_db)):
    out = []
    for r in db.query(PartRequest).filter(PartRequest.customer_id == user.id).order_by(PartRequest.created_at.desc()):
        qs = db.query(Quotation).filter(Quotation.request_id == r.id).order_by(Quotation.price).all()
        out.append({"request": request_out(r, _matched(db, r.id)), "quotations": [quotation_out(q) for q in qs]})
    return out


@router.post("/quotations/{qid}/accept")
def accept_quotation(qid: str, user: User = Depends(require_role("customer")), db: Session = Depends(get_db)):
    q = db.get(Quotation, qid)
    r = q and db.get(PartRequest, q.request_id)
    if not q or not r or r.customer_id != user.id:
        raise HTTPException(404, "Quotation not found")
    for other in db.query(Quotation).filter(Quotation.request_id == r.id):
        other.status = "accepted" if other.id == q.id else "declined"
    r.status = "closed"
    db.commit()
    s = db.get(Supplier, q.supplier_id)
    msg = f"Hello, I accepted your quotation (AED {q.price}) on UAE AutoParts Hub for request {r.id}."
    return {"supplier": supplier_out(s), "url": whatsapp.wa_link(s.whatsapp, msg)}


@router.post("/requests/{rid}/close")
def close_request(rid: str, user: User = Depends(require_role("customer")), db: Session = Depends(get_db)):
    r = db.get(PartRequest, rid)
    if not r or r.customer_id != user.id:
        raise HTTPException(404, "Request not found")
    r.status = "closed"
    db.commit()
    return {"ok": True}


@router.get("/me/favourites")
def favourites(user: User = Depends(current_user), db: Session = Depends(get_db)):
    parts = db.query(Part).join(Favourite, Favourite.part_id == Part.id).filter(Favourite.user_id == user.id).all()
    return {"parts": parts_out(db, parts), "suppliers": suppliers_map(db, {p.supplier_id for p in parts})}


@router.get("/me/favourites/{part_id}")
def is_favourite(part_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return {"favourite": db.get(Favourite, (user.id, part_id)) is not None}


@router.post("/me/favourites/{part_id}")
def toggle_favourite(part_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if not db.get(Part, part_id):
        raise HTTPException(404, "Listing not found")
    f = db.get(Favourite, (user.id, part_id))
    if f:
        db.delete(f)
    else:
        db.add(Favourite(user_id=user.id, part_id=part_id))
    db.commit()
    return {"favourite": f is None}


@router.get("/me/vehicles")
def vehicles(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return [{"id": v.id, "userId": v.user_id, "make": v.make, "model": v.model, "year": v.year, "engine": v.engine, "vin": v.vin}
            for v in db.query(SavedVehicle).filter(SavedVehicle.user_id == user.id)]


@router.post("/me/vehicles")
def add_vehicle(body: VehicleIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if db.query(SavedVehicle).filter(SavedVehicle.user_id == user.id).count() >= 20:
        raise HTTPException(400, "Maximum 20 saved vehicles")
    db.add(SavedVehicle(user_id=user.id, **body.model_dump()))
    db.commit()
    return {"ok": True}


@router.delete("/me/vehicles/{vid}")
def remove_vehicle(vid: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    v = db.get(SavedVehicle, vid)
    if v and v.user_id == user.id:
        db.delete(v)
        db.commit()
    return {"ok": True}


@router.get("/me/inquiries")
def my_inquiries(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.query(Inquiry).filter(Inquiry.customer_id == user.id).order_by(Inquiry.created_at.desc()).limit(200).all()
    parts = {p.id: p for p in db.query(Part).filter(Part.id.in_([i.part_id for i in rows]))}
    return [{"inquiry": inquiry_out(i), "part": part_out(parts[i.part_id]) if i.part_id in parts else None} for i in rows]


@router.patch("/me")
def update_me(body: PreferencesIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if body.name:
        user.name = body.name
    if body.phone is not None:
        user.phone = body.phone
    user.marketing_consent = body.marketing_consent
    user.whatsapp_consent = body.whatsapp_consent
    db.commit()
    return {"ok": True}


@router.delete("/me")
def delete_me(user: User = Depends(require_role("customer")), db: Session = Depends(get_db)):
    """Right to erasure: remove personal data, anonymise marketplace records."""
    db.query(SavedVehicle).filter(SavedVehicle.user_id == user.id).delete()
    db.query(Favourite).filter(Favourite.user_id == user.id).delete()
    db.query(Inquiry).filter(Inquiry.customer_id == user.id).update({"customer_id": None})
    for r in db.query(PartRequest).filter(PartRequest.customer_id == user.id):
        r.customer_id, r.contact_phone, r.contact_email, r.status = None, "deleted", None, "closed"
    user.email = f"deleted-{user.id}@deleted.invalid"
    user.name, user.phone, user.password_hash = "Deleted user", None, "!"
    user.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True}
