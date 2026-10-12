from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..catalog import emirate_ids, find_area
from ..db import get_db
from ..models import Supplier, SupplierDocument, User
from ..schemas import LoginIn, RegisterIn, SupplierRegisterIn
from ..security import create_token, current_user, hash_password, rate_limit, verify_password
from ..serializers import supplier_out, user_out
from .common import audit

router = APIRouter(prefix="/auth", tags=["auth"])


def _supplier_id(db: Session, u: User) -> str | None:
    if u.role != "supplier":
        return None
    s = db.query(Supplier.id).filter(Supplier.owner_id == u.id).first()
    return s[0] if s else None


@router.post("/login", dependencies=[Depends(rate_limit("login", 10))])
def login(body: LoginIn, db: Session = Depends(get_db)):
    u = db.query(User).filter(func.lower(User.email) == body.email.lower(), User.deleted_at.is_(None)).first()
    if not u or not verify_password(body.password, u.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    if u.role == "supplier":
        s = db.query(Supplier).filter(Supplier.owner_id == u.id).first()
        if s and s.status == "suspended":
            raise HTTPException(403, "This supplier account is suspended. Contact support.")
    return {"token": create_token(u), "user": user_out(u, _supplier_id(db, u))}


@router.post("/register", dependencies=[Depends(rate_limit("register", 5))])
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if db.query(User).filter(func.lower(User.email) == body.email.lower()).first():
        raise HTTPException(409, "An account with this email already exists")
    u = User(email=body.email.lower(), name=body.name, phone=body.phone, role="customer", password_hash=hash_password(body.password),
             marketing_consent=body.marketing_consent, whatsapp_consent=body.whatsapp_consent)
    db.add(u)
    db.commit()
    return {"token": create_token(u), "user": user_out(u)}


@router.post("/register-supplier", dependencies=[Depends(rate_limit("register", 5))])
def register_supplier(body: SupplierRegisterIn, db: Session = Depends(get_db)):
    if db.query(User).filter(func.lower(User.email) == body.email.lower()).first():
        raise HTTPException(409, "An account with this email already exists")
    area = find_area(body.emirate, body.area)
    if not area:
        raise HTTPException(422, "Unknown industrial area for this emirate")
    u = User(email=body.email.lower(), name=body.contact_name, phone=body.phone, role="supplier",
             password_hash=hash_password(body.password), whatsapp_consent=True)
    db.add(u)
    db.flush()
    s = Supplier(owner_id=u.id, name=body.business_name, name_ar=body.business_name_ar, trade_licence=body.trade_licence,
                 contact_name=body.contact_name, phone=body.phone, whatsapp=body.whatsapp, email=body.email.lower(),
                 emirate=body.emirate, area=body.area, address=body.address, lat=area["lat"], lng=area["lng"],
                 emirates_served=[e for e in (body.emirates_served or [body.emirate]) if e in emirate_ids()],
                 makes=body.makes, categories=body.categories, delivery=body.delivery, status="pending")
    db.add(s)
    db.flush()
    for d in body.docs:
        db.add(SupplierDocument(supplier_id=s.id, name=d.name, kind=d.kind, size_kb=d.size_kb))
    audit(db, u.id, "supplier.register", s.id)
    db.commit()
    return {"token": create_token(u), "supplier": supplier_out(s, private=True)}


@router.get("/me")
def me(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return user_out(user, _supplier_id(db, user))
