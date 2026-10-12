# Architecture

```
                ┌──────────────────────────── web (Next.js, static export) ───────────────────────────┐
 Browser ──────▶│ pages (app/)  ─▶  lib/api.ts ──┬─▶ demo-backend.ts  (localStorage, sample data)       │
                │ i18n EN/AR, RTL, dark mode      └─▶ http-backend.ts ─────────────┐                    │
                └─────────────────────────────────────────────────────────────────│────────────────────┘
                                                                                   ▼ HTTPS + JWT / X-API-Key
                ┌──────────────────────────── api (FastAPI) ──────────────────────────────────────────┐
                │ routers: auth · public catalogue · me · supplier · admin · integrations · ai        │
                │ services: query_parser · importer · whatsapp · nhtsa · llm                          │
                │ security: bcrypt, JWT, role deps, rate limits, API-key hashes, audit log            │
                └──────────────┬──────────────────────────────────────┬────────────────────────────────┘
                               ▼                                      ▼
                 PostgreSQL / Supabase (RLS)            WhatsApp Business Platform · NHTSA vPIC · Claude
                 object storage (photos, documents)     (all optional, server-side only)
```

## Repository layout

| Path | Contents |
|---|---|
| `web/app/` | Routes: `/`, `/search`, `/part?id=`, `/compare?id=`, `/suppliers`, `/shop?id=`, `/request`, `/login`, `/register`, `/register/supplier`, `/account`, `/dashboard/supplier`, `/dashboard/admin`, `/legal/*`, `sitemap.xml`, `robots.txt` |
| `web/lib/search.ts` | Normalization (Arabic letter forms, digits, diacritics), Levenshtein typo tolerance, NL query parser, compatibility rules, ranking, comparison grouping, duplicate keys |
| `web/lib/importer.ts` | CSV row validation, name standardization and duplicate detection |
| `web/lib/data/` | Vehicle catalogue, part taxonomy (EN/AR synonyms, safety-critical flags), emirates and industrial areas, fictional seed data |
| `api/app/services/query_parser.py` | Python port of `search.ts` (both have tests for the same cases) |
| `api/migrations/` | `001_init.sql` (normalized schema), `002_rls.sql` (row-level security) |

## Data model (PostgreSQL)

- **Reference:** `makes → models → generations → variants` (engine code, capacity, transmission, market spec, source), `part_categories → part_types` (synonyms, `safety_critical`).
- **Accounts:** `users` (role customer/supplier/admin, consents, soft delete), `suppliers` (licence, location, coverage, makes, categories, status, plan, hashed API key), `supplier_documents`.
- **Inventory:** `parts` (one row per listing: fitment range, OEM, condition, price AED, quantity, warranty, status, moderation, `last_verified`, source, `is_sample`), `part_images` (with usage rights), `part_compatibility` (explicit fitment evidence), `inventory_events` (price/stock history), `external_records` (provenance for partner data: source, collected date, verification status, usage rights).
- **Marketplace:** `inquiries`, `part_requests`, `request_matches`, `quotations`, `favourites`, `saved_vehicles`, `reports`.
- **Operations:** `import_jobs` (with error reports), `plans`, `search_events`, `audit_logs`.

## Key rules

1. **Grounded results.** The NL parser (and the optional Claude extractor) only produces *filters*. Listings, prices and stock always come from the database. Claude's output is validated against catalogue ids before use.
2. **Compatibility.** `verified` requires an OEM match or OEM-backed fitment plus a matching engine code. Make/model/year alone gives at most `likely`. An engine mismatch gives `confirm`.
3. **Comparison.** Listings are grouped by identical OEM number, or (when there's no OEM) by identical part type, make, model and engine with overlapping years. Description similarity is never used.
4. **Safety-critical parts** (brakes, ABS, airbags, steering, suspension) need an OEM number and go through admin moderation.
5. **Contact privacy.** Suppliers see a request's contact details only after the customer accepts their quotation.
6. **Supplier verification** is always manual: registration creates a `pending` supplier whose listings stay hidden until an admin approves.

## Inventory ingestion

| Method | Path |
|---|---|
| A. Excel/CSV upload | Dashboard → Bulk import (`POST /supplier/imports`, `POST /supplier/imports/file` accepts `.csv`/`.xlsx`) |
| B. Supplier API | `PUT /integrations/inventory` (upsert by `sku`, `mode=replace` marks missing SKUs sold), `DELETE /integrations/inventory/{sku}` with `X-API-Key` |
| C. Dashboard | Add/edit listings, photos, status, stock confirmation |
| D. Partner adapters | Write an adapter that maps partner records to the import row format and calls `_apply_import(..., source="partner")`. Store provenance in `external_records`. Only with written authorization |

All four methods share one validation and normalization pipeline (`services/importer.py`).

## Search scaling path

The MVP filters in SQL (indexed by make/model/part type/emirate, with OEM and trigram indexes) and scores in-process, which is fine for tens of thousands of listings. Next step: sync `parts` to Meilisearch or Typesense on write (or via `inventory_events`), keeping `query_parser` for structured-filter extraction and using the engine for typo-tolerant text ranking.
