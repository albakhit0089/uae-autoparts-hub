"""UAE AutoParts Hub — FastAPI backend. OpenAPI docs at /docs."""
import logging

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session

from .config import get_settings
from .db import get_db
from .models import Part, Supplier
from .routers import admin, ai, auth, integrations, me, public, supplier
from .security import limiter

logging.basicConfig(level=logging.INFO)
settings = get_settings()

app = FastAPI(
    title="UAE AutoParts Hub API",
    version="0.1.0",
    description="Marketplace API for used automotive spare parts in the UAE. All prices in AED.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    ip = request.client.host if request.client else "unknown"
    if not limiter.check(f"global:{ip}", settings.rate_limit_per_minute):
        return Response('{"detail":"Too many requests"}', status_code=429, media_type="application/json")
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if settings.environment == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


for r in (auth.router, public.router, me.router, supplier.router, admin.router, integrations.router, ai.router):
    app.include_router(r)


@app.get("/health", tags=["ops"])
def health():
    return {"ok": True}


@app.get("/sitemap-parts.xml", tags=["ops"], include_in_schema=False)
def sitemap_parts(db: Session = Depends(get_db)):
    """Lists every live listing page for search engines (served via the frontend's domain proxy)."""
    base = settings.cors_list[0] if settings.cors_list else ""
    rows = (
        db.query(Part.id, Part.updated_at)
        .join(Supplier, Supplier.id == Part.supplier_id)
        .filter(Supplier.status == "approved", Part.moderation == "approved", Part.status != "sold")
        .limit(50000)
    )
    urls = "".join(f"<url><loc>{base}/part/?id={pid}</loc><lastmod>{ts.date().isoformat()}</lastmod></url>" for pid, ts in rows)
    xml = f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>'
    return Response(xml, media_type="application/xml")
