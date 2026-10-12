# Replacing demo inventory with real supplier data

The demo data is fictional and clearly marked (`is_sample = true`, supplier names end in "(Sample)", OEM-style numbers start with `SMP-`). To go live:

1. **Never run `seed-demo` against production.** Use `python -m app.jobs migrate && python -m app.jobs seed-reference` only.
   If a database was seeded by mistake:
   ```sql
   delete from parts where is_sample;
   delete from suppliers where is_sample;
   delete from users where email in ('admin@demo.ae','supplier@demo.ae','customer@demo.ae');
   ```
2. **Turn off demo mode in the frontend** by setting `NEXT_PUBLIC_API_URL`. The demo banner and demo-account shortcuts disappear automatically.
3. **Onboard suppliers** (start with Al Sajaa, Sharjah):
   - The supplier registers at `/register/supplier` and uploads their trade licence.
   - An admin verifies the licence against the issuing authority (e.g. Sharjah Economic Development Department), checks that the licence activity covers used spare parts or dismantling, and calls the contact number. Then they approve the supplier in **Admin → Suppliers**.
4. **Load inventory**, choosing whichever fits the supplier:
   - *Small yards:* add listings in the dashboard (with real photos).
   - *Spreadsheet users:* download the CSV template from **Dashboard → Bulk import**, fill it in, upload it, and fix the rows listed in the import report.
   - *Inventory software:* generate an API key in **Dashboard → API access** and call `PUT /integrations/inventory` on a schedule.
   - *Data partners (Method D):* only with a written agreement that covers photo and data usage rights. Record each record's provenance in `external_records`.
5. **Keep stock fresh.** Listings not confirmed for 30 days show up under *Need stock check* (supplier) and *Stale stock* (admin). Run `python -m app.jobs stale-stock` daily and remind suppliers through approved WhatsApp templates.
6. **Taxonomy and catalogue updates.** Edit `web/lib/data/*.ts`, run `npm run export:catalog`, commit both, and deploy. The API container reloads reference data on start.

## CSV template columns
`sku, part_name, part_type, oem_number, make, model, generation, year_from, year_to, engine_code, transmission, market_spec, condition, price_aed, quantity, warranty_days, description, donor_vehicle, status`

- `make` / `model` / `part_type` accept common spellings and Arabic names, normalised automatically (for example "Mercedes Benz" → `mercedes-benz`, "C200" → `c-class`, "Gear box" or "قير" → `gearbox`).
- `sku` lets later uploads update the same item instead of creating duplicates.
- Safety-critical part types require `oem_number`, and those listings are reviewed before going live.
