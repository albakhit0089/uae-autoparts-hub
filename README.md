# UAE AutoParts Hub

A bilingual (English / العربية) marketplace for **used car spare parts in the United Arab Emirates**. It connects drivers and workshops with scrapyards, vehicle dismantlers and licensed parts suppliers, starting in Sharjah's Al Sajaa industrial area.

> **Demo data notice:** every supplier, listing, price and "SMP-" part number in this repository is **fictional sample data**. It is labelled as sample data throughout the UI. Nothing is for sale.

## What's in the box

| Area | Highlights |
|---|---|
| **Search** | Make → model → year → engine selector, part taxonomy, OEM number search, emirate and industrial-area filters, price, condition, warranty. Natural-language search in English and Arabic ("قير لكزس LX570 2016 في دبي أقل من 5 الف"), with typo tolerance and synonyms. |
| **Compatibility** | Each result is labelled **Verified fit**, **Likely fit** or **Confirm fitment**. A match on make, model and year alone is never shown as verified. |
| **Listings** | Condition, warranty, stock status, the date the supplier last confirmed stock, donor vehicle, photos. A WhatsApp "Contact supplier" button sends a prefilled message, and each inquiry is logged first. |
| **Price comparison** | Groups listings only when the OEM number is identical, or (when there's no OEM) the same part type, vehicle, engine and overlapping years. |
| **Part requests** | Requests are matched to suppliers who handle that make and part category. Suppliers send quotations and customers compare them side by side. The customer's phone number stays hidden until they accept a quote. Anti-spam: honeypot, challenge question and rate limits. |
| **Supplier portal** | Registration with trade-licence upload, which an admin must approve. Dashboard KPIs, add/edit/sell/reserve/confirm-stock actions, **CSV/Excel bulk import with a validation report**, an **inventory API with API keys**, inquiries, matched requests and quoting. |
| **Admin** | Supplier verification queue, listing moderation (safety-critical parts always need review), stale stock, duplicate detection, import errors, reports/disputes, featured listings, subscription plans, audit log, growth charts. |
| **Customer account** | Saved vehicles, favourites, requests and offers, inquiry history, consent preferences, data export, account deletion. |
| **Platform** | Light/dark mode, full RTL, AED pricing, SEO metadata, JSON-LD structured data, sitemap, robots.txt, accessible components. |

## Architecture

```
web/      Next.js 15 + React 19 + TypeScript + Tailwind CSS 4   (static export, deploys to Vercel / GitHub Pages)
api/      FastAPI + SQLAlchemy + PostgreSQL (Supabase-ready)    (OpenAPI docs at /docs)
  migrations/   SQL schema + row-level-security policies
shared/   catalog.json (vehicle catalogue, part taxonomy, emirates) + sample-data.json — generated from web/lib/data
docs/     architecture, deployment, data sources, replacing demo data, security
```

The frontend talks to a single `api` interface (`web/lib/api.ts`):

- **Demo mode** (no `NEXT_PUBLIC_API_URL`): a complete in-browser backend (`web/lib/demo-backend.ts`) seeded with sample data and saved to `localStorage`. This is what the public preview link runs. It is for demonstration only and not secure.
- **API mode** (`NEXT_PUBLIC_API_URL=https://…`): the same calls go to FastAPI (`web/lib/http-backend.ts`). Permissions are enforced server-side, with RLS in Postgres as a second layer.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Quick start

### Frontend only (demo mode)

```bash
cd web
npm install
npm run dev            # http://localhost:3000
```

Demo accounts (password `Demo@1234`) are also available from the "Demo accounts" menu in the top banner:

| Role | Email |
|---|---|
| Customer | customer@demo.ae |
| Supplier (Al Sajaa Euro Parts — sample) | supplier@demo.ae |
| Administrator | admin@demo.ae |

### Full stack (frontend + API + PostgreSQL)

```bash
# 1. Database (any PostgreSQL 14+, e.g. Supabase or docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16)
cd api
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt
cp .env.example .env                                    # set DATABASE_URL and JWT_SECRET
python -m app.jobs migrate                              # apply migrations/*.sql
python -m app.jobs seed-demo                            # reference data + FICTIONAL sample data + demo accounts
uvicorn app.main:app --reload                           # http://localhost:8000/docs

# 2. Frontend pointing at the API
cd ../web
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
```

No Postgres available? `DATABASE_URL=sqlite:///./dev.db python -m app.jobs init-sqlite && python -m app.jobs seed-demo` works for local development. Row-level security only applies on Postgres.

## Tests

```bash
cd web && npm test          # search parser, compatibility, comparison, importer, WhatsApp links
cd api && pytest            # parser + end-to-end customer / supplier / admin workflows
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests and the production build for `web`, and runs `ruff` plus the API test suite against **PostgreSQL with the real SQL migrations** and against SQLite.

## Configuration

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | web | FastAPI base URL. Leave empty for demo mode |
| `NEXT_PUBLIC_SITE_URL` | web | Canonical site URL (sitemap, JSON-LD) |
| `NEXT_PUBLIC_BASE_PATH` | web | Sub-path hosting (GitHub Pages) |
| `DATABASE_URL` | api | PostgreSQL / Supabase connection string |
| `JWT_SECRET` | api | Required in production |
| `CORS_ORIGINS` | api | Comma-separated frontend origins |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | api | Optional. WhatsApp Business Platform template notifications to suppliers. Logged only when unset |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | api | Optional. Claude-powered query extraction for `/ai/search`. Falls back to the rule-based parser when unset |

Full examples: [web/.env.example](web/.env.example) and [api/.env.example](api/.env.example).

## Integration status (honest)

| Integration | Status |
|---|---|
| WhatsApp click-to-chat (`wa.me`) | ✅ Works with no setup. Sample suppliers have no number, so the link opens without a recipient |
| WhatsApp Business Platform notifications | ⚙️ Implemented server-side, **not tested against Meta**. Needs a business account, approved templates and a token |
| NHTSA vPIC vehicle import | ⚙️ Job implemented (`python -m app.jobs import-nhtsa`). Covers US-market vehicles only. GCC gaps are documented |
| TecDoc / licensed OEM catalogues | ❌ Not included. Requires a commercial licence (adapter guidance in docs) |
| Claude query extraction | ⚙️ Implemented, off by default. The rule-based parser is always the fallback |
| Map tiles | ✅ OpenStreetMap with attribution. Switch provider for production traffic |
| Online payments | ❌ Not in the MVP, by design. WhatsApp inquiries come first |
| Meilisearch / Typesense | ❌ Not wired. Postgres filtering + in-process scoring is used. Migration path in docs |

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Vehicle & parts data sources](docs/DATA_SOURCES.md)
- [Replacing demo inventory with real supplier data](docs/REAL_DATA.md)
- [Security, privacy & compliance notes](docs/SECURITY.md)
