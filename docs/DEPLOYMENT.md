# Deployment

## 1. Public demo (GitHub Pages, no backend)

`.github/workflows/pages.yml` builds `web/` as a static site in demo mode and publishes it on every push to `main`.
One-time setup: repository **Settings → Pages → Source: GitHub Actions**.

## 2. Production

### Database: Supabase (or any managed PostgreSQL 14+)
1. Create a project and copy the connection string (use the *session pooler* URL for long-running servers).
2. From a machine with the repo: `cd api && DATABASE_URL=... python -m app.jobs migrate && python -m app.jobs seed-reference`.
3. **Do not run `seed-demo` in production.**
4. Create the first admin: register normally, then `update users set role='admin' where email='you@company.ae';`
5. Turn on Supabase point-in-time recovery / daily backups (see *Backups* below).

### API: any container host (Render, Railway, Fly.io, AWS App Runner, Azure Container Apps)
- Build with the root-level context: `docker build -f api/Dockerfile -t autoparts-api .`
- Environment: `DATABASE_URL`, `JWT_SECRET` (long random value), `CORS_ORIGINS=https://www.your-domain.ae`, `ENVIRONMENT=production`, plus any optional integrations.
- The container applies new migrations and refreshes reference data on start, then serves on `$PORT`.
- Put it behind HTTPS (all of these hosts terminate TLS). The built-in rate limiter is per instance; when running more than one replica, add edge rate limiting (Cloudflare, or the host's WAF) or a Redis-backed limiter.
- Scheduled jobs (host cron or GitHub Actions on a schedule):
  - weekly: `python -m app.jobs seed-reference`, `python -m app.jobs import-nhtsa --make <make> --years 2015-2025`
  - daily: `python -m app.jobs stale-stock --days 30` (feed into supplier reminder messages)

### Frontend: Vercel
1. Import the GitHub repo and set **Root Directory = `web`**.
2. Env: `NEXT_PUBLIC_API_URL=https://api.your-domain.ae`, `NEXT_PUBLIC_SITE_URL=https://www.your-domain.ae`.
3. The app uses `output: "export"`, so Vercel serves it as static files from its CDN. To server-render part pages for SEO (recommended once real inventory exists), remove `output: "export"` and convert `/part` to `/parts/[id]` with `generateMetadata` that fetches from the API.

### Object storage (photos and documents)
Use Supabase Storage or S3: a **public** bucket for listing photos, and a **private** bucket for trade-licence documents (signed URLs, admin-only). Upload from the browser with a short-lived signed upload URL issued by the API, then send only the resulting URL to `/supplier/parts`. The demo stores resized images inline, which is acceptable only for demos. Run malware scanning (e.g. ClamAV, or the storage provider's scanning) on uploaded documents before admins open them.

### WhatsApp Business Platform
1. Create a Meta Business account, a WhatsApp Business app and a phone number.
2. Get templates approved (e.g. `new_part_request` with three body parameters: part, vehicle, emirate).
3. Set `WHATSAPP_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` on the API only. They are never exposed to the browser.
4. Only message suppliers who opted in (`suppliers.whatsapp` provided at registration with consent). Customers are contacted only through click-to-chat they start themselves.

### Maps
Demo: OpenStreetMap tiles (attribution shown). OSM's tile servers are not for production-scale traffic. Switch the tile URL in `web/components/supplier-map.tsx` to a commercial provider (MapTiler, Mapbox, Google Maps) and follow its attribution and caching terms.

## Backups & disaster recovery
- Daily automated backups plus point-in-time recovery (Supabase Pro or RDS). Test a restore quarterly.
- Recovery targets for the MVP: RPO ≤ 24 h (≤ 5 min with PITR), RTO ≤ 4 h.
- The API is stateless, so redeploy the container from Git. Keep secrets in the host's secret manager.
