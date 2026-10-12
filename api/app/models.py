"""SQLAlchemy models mirroring migrations/*.sql (the SQL files are the source of truth in production)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, Float, ForeignKey, Integer, Numeric, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

JsonType = JSON().with_variant(JSONB(), "postgresql")
BigIntId = BigInteger().with_variant(Integer(), "sqlite")


def new_id() -> str:
    return uuid.uuid4().hex


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Base(DeclarativeBase):
    pass


class Make(Base):
    __tablename__ = "makes"
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    name_ar: Mapped[str] = mapped_column(Text)
    aliases: Mapped[list] = mapped_column(JsonType, default=list)


class Model(Base):
    __tablename__ = "models"
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    make_id: Mapped[str] = mapped_column(ForeignKey("makes.id", ondelete="CASCADE"))
    slug: Mapped[str] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
    name_ar: Mapped[str] = mapped_column(Text)
    aliases: Mapped[list] = mapped_column(JsonType, default=list)


class Generation(Base):
    __tablename__ = "generations"
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    model_id: Mapped[str] = mapped_column(ForeignKey("models.id", ondelete="CASCADE"))
    code: Mapped[str] = mapped_column(Text)
    year_from: Mapped[int] = mapped_column(Integer)
    year_to: Mapped[int] = mapped_column(Integer)


class Variant(Base):
    __tablename__ = "variants"
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    generation_id: Mapped[str] = mapped_column(ForeignKey("generations.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(Text)
    engine_code: Mapped[str] = mapped_column(Text)
    capacity_l: Mapped[float | None] = mapped_column(Numeric(4, 1), nullable=True)
    fuel: Mapped[str] = mapped_column(Text, default="petrol")
    transmission: Mapped[str | None] = mapped_column(Text, nullable=True)
    market_spec: Mapped[str] = mapped_column(Text, default="Unknown")
    source: Mapped[str] = mapped_column(Text, default="seed")
    external_ref: Mapped[str | None] = mapped_column(Text, nullable=True)


class PartCategory(Base):
    __tablename__ = "part_categories"
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    name_ar: Mapped[str] = mapped_column(Text)


class PartType(Base):
    __tablename__ = "part_types"
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    category_id: Mapped[str] = mapped_column(ForeignKey("part_categories.id"))
    name: Mapped[str] = mapped_column(Text)
    name_ar: Mapped[str] = mapped_column(Text)
    synonyms: Mapped[list] = mapped_column(JsonType, default=list)
    safety_critical: Mapped[bool] = mapped_column(Boolean, default=False)


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(Text, primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(Text, unique=True)
    name: Mapped[str] = mapped_column(Text)
    phone: Mapped[str | None] = mapped_column(Text, nullable=True)
    role: Mapped[str] = mapped_column(Text)
    password_hash: Mapped[str] = mapped_column(Text)
    marketing_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    whatsapp_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Supplier(Base):
    __tablename__ = "suppliers"
    id: Mapped[str] = mapped_column(Text, primary_key=True, default=new_id)
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(Text)
    name_ar: Mapped[str | None] = mapped_column(Text, nullable=True)
    trade_licence: Mapped[str] = mapped_column(Text)
    contact_name: Mapped[str] = mapped_column(Text)
    phone: Mapped[str] = mapped_column(Text, default="")
    whatsapp: Mapped[str] = mapped_column(Text, default="")
    email: Mapped[str] = mapped_column(Text)
    emirate: Mapped[str] = mapped_column(Text)
    area: Mapped[str] = mapped_column(Text)
    address: Mapped[str] = mapped_column(Text)
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    emirates_served: Mapped[list] = mapped_column(JsonType, default=list)
    makes: Mapped[list] = mapped_column(JsonType, default=list)
    categories: Mapped[list] = mapped_column(JsonType, default=list)
    status: Mapped[str] = mapped_column(Text, default="pending")
    delivery: Mapped[bool] = mapped_column(Boolean, default=False)
    featured: Mapped[bool] = mapped_column(Boolean, default=False)
    plan: Mapped[str] = mapped_column(Text, default="free")
    api_key_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SupplierDocument(Base):
    __tablename__ = "supplier_documents"
    id: Mapped[str] = mapped_column(Text, primary_key=True, default=new_id)
    supplier_id: Mapped[str] = mapped_column(ForeignKey("suppliers.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(Text, default="other")
    size_kb: Mapped[int] = mapped_column(Integer, default=0)
    storage_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Part(Base):
    __tablename__ = "parts"
    id: Mapped[str] = mapped_column(Text, primary_key=True, default=new_id)
    supplier_id: Mapped[str] = mapped_column(ForeignKey("suppliers.id", ondelete="CASCADE"))
    sku: Mapped[str | None] = mapped_column(Text, nullable=True)
    name: Mapped[str] = mapped_column(Text)
    category_id: Mapped[str] = mapped_column(ForeignKey("part_categories.id"))
    part_type_id: Mapped[str] = mapped_column(ForeignKey("part_types.id"))
    oem: Mapped[str | None] = mapped_column(Text, nullable=True)
    make: Mapped[str] = mapped_column(ForeignKey("makes.id"))
    model: Mapped[str] = mapped_column(Text)
    generation: Mapped[str | None] = mapped_column(Text, nullable=True)
    year_from: Mapped[int] = mapped_column(Integer)
    year_to: Mapped[int] = mapped_column(Integer)
    engine: Mapped[str | None] = mapped_column(Text, nullable=True)
    transmission: Mapped[str | None] = mapped_column(Text, nullable=True)
    market_spec: Mapped[str] = mapped_column(Text, default="Unknown")
    condition: Mapped[str] = mapped_column(Text)
    price: Mapped[int] = mapped_column(Integer)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    warranty_days: Mapped[int] = mapped_column(Integer, default=0)
    emirate: Mapped[str] = mapped_column(Text)
    area: Mapped[str] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, default="")
    donor_vehicle: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(Text, default="available")
    fitment: Mapped[str] = mapped_column(Text, default="likely")
    moderation: Mapped[str] = mapped_column(Text, default="approved")
    featured: Mapped[bool] = mapped_column(Boolean, default=False)
    views: Mapped[int] = mapped_column(Integer, default=0)
    source: Mapped[str] = mapped_column(Text, default="dashboard")
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    last_verified: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class PartImage(Base):
    __tablename__ = "part_images"
    id: Mapped[str] = mapped_column(Text, primary_key=True, default=new_id)
    part_id: Mapped[str] = mapped_column(ForeignKey("parts.id", ondelete="CASCADE"))
    url: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=0)
    usage_rights: Mapped[str] = mapped_column(Text, default="supplier-owned")


class PartCompatibility(Base):
    __tablename__ = "part_compatibility"
    id: Mapped[str] = mapped_column(Text, primary_key=True, default=new_id)
    part_id: Mapped[str] = mapped_column(ForeignKey("parts.id", ondelete="CASCADE"))
    variant_id: Mapped[str | None] = mapped_column(ForeignKey("variants.id"), nullable=True)
    make: Mapped[str] = mapped_column(Text)
    model: Mapped[str] = mapped_column(Text)
    year_from: Mapped[int] = mapped_column(Integer)
    year_to: Mapped[int] = mapped_column(Integer)
    engine: Mapped[str | None] = mapped_column(Text, nullable=True)
    evidence: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class InventoryEvent(Base):
    __tablename__ = "inventory_events"
    id: Mapped[int] = mapped_column(BigIntId, primary_key=True, autoincrement=True)
    part_id: Mapped[str] = mapped_column(ForeignKey("parts.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(Text)
    old_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(Text)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ExternalRecord(Base):
    __tablename__ = "external_records"
    id: Mapped[str] = mapped_column(Text, primary_key=True, default=new_id)
    source: Mapped[str] = mapped_column(Text)
    external_id: Mapped[str] = mapped_column(Text)
    part_id: Mapped[str | None] = mapped_column(ForeignKey("parts.id", ondelete="SET NULL"), nullable=True)
    collected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    verification_status: Mapped[str] = mapped_column(Text, default="unverified")
    usage_rights: Mapped[str] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(JsonType, default=dict)


class Inquiry(Base):
    __tablename__ = "inquiries"
    id: Mapped[str] = mapped_column(Text, primary_key=True, default=new_id)
    part_id: Mapped[str] = mapped_column(ForeignKey("parts.id", ondelete="CASCADE"))
    supplier_id: Mapped[str] = mapped_column(ForeignKey("suppliers.id", ondelete="CASCADE"))
    customer_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    guest_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    message: Mapped[str] = mapped_column(Text)
    channel: Mapped[str] = mapped_column(Text, default="whatsapp")
    ip_hash: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class PartRequest(Base):
    __tablename__ = "part_requests"
    id: Mapped[str] = mapped_column(Text, primary_key=True, default=new_id)
    customer_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    contact_name: Mapped[str] = mapped_column(Text)
    contact_phone: Mapped[str] = mapped_column(Text)
    contact_email: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_method: Mapped[str] = mapped_column(Text, default="whatsapp")
    make: Mapped[str] = mapped_column(Text)
    model: Mapped[str] = mapped_column(Text)
    year: Mapped[int] = mapped_column(Integer)
    engine: Mapped[str | None] = mapped_column(Text, nullable=True)
    part_type_id: Mapped[str] = mapped_column(ForeignKey("part_types.id"))
    part_text: Mapped[str] = mapped_column(Text, default="")
    oem: Mapped[str | None] = mapped_column(Text, nullable=True)
    emirate: Mapped[str] = mapped_column(Text)
    budget: Mapped[int | None] = mapped_column(Integer, nullable=True)
    description: Mapped[str] = mapped_column(Text, default="")
    images: Mapped[list] = mapped_column(JsonType, default=list)
    status: Mapped[str] = mapped_column(Text, default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class RequestMatch(Base):
    __tablename__ = "request_matches"
    request_id: Mapped[str] = mapped_column(ForeignKey("part_requests.id", ondelete="CASCADE"), primary_key=True)
    supplier_id: Mapped[str] = mapped_column(ForeignKey("suppliers.id", ondelete="CASCADE"), primary_key=True)
    notified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Quotation(Base):
    __tablename__ = "quotations"
    id: Mapped[str] = mapped_column(Text, primary_key=True, default=new_id)
    request_id: Mapped[str] = mapped_column(ForeignKey("part_requests.id", ondelete="CASCADE"))
    supplier_id: Mapped[str] = mapped_column(ForeignKey("suppliers.id", ondelete="CASCADE"))
    price: Mapped[int] = mapped_column(Integer)
    availability: Mapped[str] = mapped_column(Text)
    condition: Mapped[str] = mapped_column(Text)
    warranty_days: Mapped[int] = mapped_column(Integer, default=0)
    delivery_days: Mapped[int] = mapped_column(Integer, default=0)
    note: Mapped[str] = mapped_column(Text, default="")
    images: Mapped[list] = mapped_column(JsonType, default=list)
    status: Mapped[str] = mapped_column(Text, default="submitted")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SavedVehicle(Base):
    __tablename__ = "saved_vehicles"
    id: Mapped[str] = mapped_column(Text, primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    make: Mapped[str] = mapped_column(Text)
    model: Mapped[str] = mapped_column(Text)
    year: Mapped[int] = mapped_column(Integer)
    engine: Mapped[str | None] = mapped_column(Text, nullable=True)
    vin: Mapped[str | None] = mapped_column(Text, nullable=True)


class Favourite(Base):
    __tablename__ = "favourites"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    part_id: Mapped[str] = mapped_column(ForeignKey("parts.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Report(Base):
    __tablename__ = "reports"
    id: Mapped[str] = mapped_column(Text, primary_key=True, default=new_id)
    part_id: Mapped[str] = mapped_column(ForeignKey("parts.id", ondelete="CASCADE"))
    reporter_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reason: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ImportJob(Base):
    __tablename__ = "import_jobs"
    id: Mapped[str] = mapped_column(Text, primary_key=True, default=new_id)
    supplier_id: Mapped[str] = mapped_column(ForeignKey("suppliers.id", ondelete="CASCADE"))
    filename: Mapped[str] = mapped_column(Text)
    total: Mapped[int] = mapped_column(Integer, default=0)
    created: Mapped[int] = mapped_column(Integer, default=0)
    updated: Mapped[int] = mapped_column(Integer, default=0)
    duplicates: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[list] = mapped_column(JsonType, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Plan(Base):
    __tablename__ = "plans"
    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    price_aed: Mapped[int] = mapped_column(Integer, default=0)
    listing_limit: Mapped[int] = mapped_column(Integer, default=200)
    featured_slots: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=False)


class SearchEvent(Base):
    __tablename__ = "search_events"
    id: Mapped[int] = mapped_column(BigIntId, primary_key=True, autoincrement=True)
    query: Mapped[str] = mapped_column(Text)
    parsed: Mapped[dict] = mapped_column(JsonType, default=dict)
    results: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(BigIntId, primary_key=True, autoincrement=True)
    actor_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    action: Mapped[str] = mapped_column(Text)
    target: Mapped[str] = mapped_column(Text)
    meta: Mapped[dict] = mapped_column(JsonType, default=dict)
    at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

