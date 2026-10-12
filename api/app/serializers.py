"""ORM → JSON (camelCase), matching web/lib/types.ts exactly."""
from __future__ import annotations

from collections import defaultdict

from sqlalchemy.orm import Session

from .models import ImportJob, Inquiry, Part, PartImage, PartRequest, Quotation, Supplier, SupplierDocument, User


def iso(dt):
    return dt.isoformat() if dt else None


def user_out(u: User, supplier_id: str | None = None) -> dict:
    return {
        "id": u.id, "email": u.email, "name": u.name, "phone": u.phone, "role": u.role, "supplierId": supplier_id,
        "passwordHash": "", "createdAt": iso(u.created_at), "marketingConsent": u.marketing_consent, "whatsappConsent": u.whatsapp_consent,
    }


def supplier_out(s: Supplier, *, private: bool = False, docs: list[SupplierDocument] | None = None, listings: int | None = None) -> dict:
    out = {
        "id": s.id, "name": s.name, "nameAr": s.name_ar, "tradeLicence": s.trade_licence if private else "", "contactName": s.contact_name,
        "phone": s.phone, "whatsapp": s.whatsapp, "email": s.email if private else "", "emirate": s.emirate, "area": s.area,
        "address": s.address, "lat": s.lat, "lng": s.lng, "emiratesServed": s.emirates_served, "makes": s.makes,
        "categories": s.categories, "status": s.status, "delivery": s.delivery, "featured": s.featured, "plan": s.plan,
        "createdAt": iso(s.created_at), "isSample": s.is_sample, "apiKey": "configured" if (private and s.api_key_hash) else None,
        "docs": [{"name": d.name, "kind": d.kind, "sizeKb": d.size_kb, "uploadedAt": iso(d.uploaded_at)} for d in (docs or [])] if private else [],
    }
    if listings is not None:
        out["listings"] = listings
    return out


def images_for(db: Session, part_ids: list[str]) -> dict[str, list[str]]:
    res: dict[str, list[str]] = defaultdict(list)
    if part_ids:
        for img in db.query(PartImage).filter(PartImage.part_id.in_(part_ids)).order_by(PartImage.position):
            res[img.part_id].append(img.url)
    return res


def part_out(p: Part, images: list[str] | None = None) -> dict:
    return {
        "id": p.id, "supplierId": p.supplier_id, "sku": p.sku, "name": p.name, "categoryId": p.category_id, "partTypeId": p.part_type_id,
        "oem": p.oem, "make": p.make, "model": p.model, "generation": p.generation, "yearFrom": p.year_from, "yearTo": p.year_to,
        "engine": p.engine, "transmission": p.transmission, "marketSpec": p.market_spec, "condition": p.condition, "price": p.price,
        "quantity": p.quantity, "warrantyDays": p.warranty_days, "emirate": p.emirate, "area": p.area,
        "images": images or [f"sample:{p.category_id}"], "description": p.description, "donorVehicle": p.donor_vehicle,
        "status": p.status, "lastVerified": iso(p.last_verified), "createdAt": iso(p.created_at), "views": p.views,
        "featured": p.featured, "fitment": p.fitment, "moderation": p.moderation, "source": p.source, "isSample": p.is_sample,
    }


def parts_out(db: Session, parts: list[Part]) -> list[dict]:
    imgs = images_for(db, [p.id for p in parts])
    return [part_out(p, imgs.get(p.id)) for p in parts]


def request_out(r: PartRequest, matched: list[str], reveal: bool = True) -> dict:
    return {
        "id": r.id, "customerId": r.customer_id, "contactName": r.contact_name,
        "contactPhone": r.contact_phone if reveal else "hidden until you are selected",
        "contactEmail": r.contact_email if reveal else None, "contactMethod": r.contact_method, "make": r.make, "model": r.model,
        "year": r.year, "engine": r.engine, "partTypeId": r.part_type_id, "partText": r.part_text, "oem": r.oem, "emirate": r.emirate,
        "budget": r.budget, "description": r.description, "images": r.images, "status": r.status, "matchedSupplierIds": matched,
        "createdAt": iso(r.created_at),
    }


def quotation_out(q: Quotation) -> dict:
    return {
        "id": q.id, "requestId": q.request_id, "supplierId": q.supplier_id, "price": q.price, "availability": q.availability,
        "condition": q.condition, "warrantyDays": q.warranty_days, "deliveryDays": q.delivery_days, "note": q.note,
        "images": q.images, "status": q.status, "createdAt": iso(q.created_at),
    }


def inquiry_out(i: Inquiry) -> dict:
    return {
        "id": i.id, "partId": i.part_id, "supplierId": i.supplier_id, "customerId": i.customer_id, "guestName": i.guest_name,
        "message": i.message, "channel": i.channel, "createdAt": iso(i.created_at),
    }


def import_out(j: ImportJob) -> dict:
    return {
        "id": j.id, "supplierId": j.supplier_id, "filename": j.filename, "createdAt": iso(j.created_at), "total": j.total,
        "created": j.created, "updated": j.updated, "duplicates": j.duplicates, "errors": j.errors,
    }
