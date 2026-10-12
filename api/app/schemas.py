"""Validated request bodies (camelCase JSON, matching the frontend client)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field
from pydantic.alias_generators import to_camel

Emirate = Literal["abu-dhabi", "dubai", "sharjah", "ajman", "umm-al-quwain", "ras-al-khaimah", "fujairah"]
Condition = Literal["used", "tested", "refurbished"]
PHONE = r"^\+?[0-9\s]{8,16}$"


class In(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, str_strip_whitespace=True, extra="ignore")


class LoginIn(In):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class RegisterIn(In):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=20)
    password: str = Field(min_length=8, max_length=200)
    marketing_consent: bool = False
    whatsapp_consent: bool = False


class DocIn(In):
    name: str = Field(max_length=200)
    size_kb: int = Field(ge=0, le=5120)
    kind: Literal["trade-licence", "emirates-id", "other"] = "trade-licence"


class SupplierRegisterIn(In):
    business_name: str = Field(min_length=2, max_length=120)
    business_name_ar: str | None = Field(default=None, max_length=120)
    trade_licence: str = Field(min_length=3, max_length=40)
    contact_name: str = Field(min_length=2, max_length=80)
    phone: str = Field(pattern=PHONE)
    whatsapp: str = Field(pattern=PHONE)
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)
    emirate: Emirate
    area: str = Field(max_length=60)
    address: str = Field(min_length=3, max_length=200)
    emirates_served: list[Emirate] = []
    makes: list[str] = Field(min_length=1, max_length=40)
    categories: list[str] = Field(min_length=1, max_length=20)
    delivery: bool = False
    docs: list[DocIn] = Field(min_length=1, max_length=5)


class PreferencesIn(In):
    name: str | None = Field(default=None, max_length=80)
    phone: str | None = Field(default=None, max_length=20)
    marketing_consent: bool
    whatsapp_consent: bool


class VehicleIn(In):
    make: str
    model: str
    year: int = Field(ge=1980, le=2030)
    engine: str | None = None
    vin: str | None = Field(default=None, pattern=r"^[A-HJ-NPR-Za-hj-npr-z0-9]{17}$")


class InquiryIn(In):
    part_id: str
    lang: Literal["en", "ar"] = "en"
    guest_name: str | None = Field(default=None, max_length=80)


class ReportIn(In):
    reason: str = Field(min_length=5, max_length=500)


class RequestIn(In):
    make: str
    model: str
    year: int = Field(ge=1980, le=2030)
    engine: str | None = None
    part_type_id: str
    part_text: str = Field(default="", max_length=120)
    oem: str | None = Field(default=None, max_length=40)
    emirate: Emirate
    budget: int | None = Field(default=None, ge=0, le=1_000_000)
    description: str = Field(default="", max_length=1000)
    images: list[str] = Field(default=[], max_length=4)
    contact_name: str = Field(min_length=1, max_length=80)
    contact_phone: str = Field(pattern=PHONE)
    contact_email: EmailStr | None = None
    contact_method: Literal["whatsapp", "phone", "email"] = "whatsapp"


class PartIn(In):
    id: str | None = None
    part_type_id: str
    name: str | None = Field(default=None, max_length=120)
    oem: str | None = Field(default=None, max_length=40)
    make: str
    model: str
    engine: str | None = Field(default=None, max_length=40)
    generation: str | None = Field(default=None, max_length=20)
    year_from: int = Field(ge=1980, le=2030)
    year_to: int = Field(ge=1980, le=2030)
    transmission: str | None = Field(default=None, max_length=60)
    market_spec: Literal["GCC", "Imported", "Unknown"] = "Unknown"
    condition: Condition = "used"
    price: int = Field(gt=0, lt=1_000_000)
    quantity: int = Field(default=1, ge=0, lt=10000)
    warranty_days: int = Field(default=0, ge=0, le=730)
    description: str = Field(default="", max_length=2000)
    donor_vehicle: str | None = Field(default=None, max_length=120)
    images: list[str] = Field(default=[], max_length=6)


class StatusIn(In):
    status: Literal["available", "reserved", "sold"]


class IdsIn(In):
    ids: list[str] = Field(max_length=1000)


class ImportIn(In):
    filename: str = Field(max_length=200)
    rows: list[dict] = Field(max_length=5000)


class QuotationIn(In):
    request_id: str
    price: int = Field(gt=0, lt=1_000_000)
    availability: Literal["in-stock", "1-3-days", "on-order"]
    condition: Condition
    warranty_days: int = Field(default=0, ge=0, le=730)
    delivery_days: int = Field(default=0, ge=0, le=60)
    note: str = Field(default="", max_length=500)
    images: list[str] = Field(default=[], max_length=4)


class SupplierPatchIn(In):
    name: str | None = Field(default=None, max_length=120)
    name_ar: str | None = Field(default=None, max_length=120)
    contact_name: str | None = Field(default=None, max_length=80)
    phone: str | None = Field(default=None, max_length=20)
    whatsapp: str | None = Field(default=None, pattern=PHONE)
    address: str | None = Field(default=None, max_length=200)
    emirates_served: list[Emirate] | None = None
    makes: list[str] | None = None
    categories: list[str] | None = None
    delivery: bool | None = None


class SupplierStatusIn(In):
    status: Literal["pending", "approved", "suspended", "rejected"]


class ModerateIn(In):
    decision: Literal["approved", "rejected"]


class ResolveIn(In):
    action: Literal["dismiss", "remove-listing"]


class PlanPatchIn(In):
    price_aed: int | None = Field(default=None, ge=0)
    listing_limit: int | None = Field(default=None, ge=0)
    featured_slots: int | None = Field(default=None, ge=0)
    active: bool | None = None


class InventorySyncIn(In):
    mode: Literal["upsert", "replace"] = "upsert"
    items: list[dict] = Field(max_length=5000)
