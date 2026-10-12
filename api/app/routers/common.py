from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import AuditLog, Supplier


def audit(db: Session, actor_id: str | None, action: str, target: str, **meta) -> None:
    db.add(AuditLog(actor_id=actor_id, action=action, target=target, meta=meta))


def not_found(what: str = "Not found"):
    return HTTPException(404, what)


def approved_supplier_ids(db: Session) -> set[str]:
    return {sid for (sid,) in db.query(Supplier.id).filter(Supplier.status == "approved")}


def suppliers_map(db: Session, ids: set[str] | None = None) -> dict:
    from ..serializers import supplier_out

    q = db.query(Supplier)
    if ids is not None:
        q = q.filter(Supplier.id.in_(ids)) if ids else q.filter(False)
    return {s.id: supplier_out(s) for s in q}
