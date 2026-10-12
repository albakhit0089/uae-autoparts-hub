# Vehicle & parts reference data

## What ships today
`web/lib/data/vehicles.ts` is a hand-assembled seed catalogue of 12 makes common in the UAE (Toyota, Nissan, Mercedes-Benz, BMW, Lexus, Hyundai, Kia, Ford, Honda, Mitsubishi, Chevrolet, GMC). It covers their main models, generations, year ranges, engine codes and transmissions. It's built from publicly known model information, **is not a licensed OEM catalogue**, and should be reviewed by someone with dealer/workshop expertise before launch. `npm run export:catalog` writes it to `shared/catalog.json` for the API, and CI fails if the two drift apart.

## Sources and how they plug in

| Source | Access | Coverage | How it's used |
|---|---|---|---|
| **NHTSA vPIC** (https://vpic.nhtsa.dot.gov/api/) | Free, public | US-market makes/models/years. VIN decoding for US VINs | `python -m app.jobs import-nhtsa` adds missing models/years as `source='nhtsa'`, `market_spec='Unknown'`. It never overwrites curated data |
| **TecAlliance TecDoc** (https://www.tecalliance.net/) | Commercial licence | Global OEM ↔ aftermarket cross-references, vehicle linkages | Not included. With a licence, write an adapter that fills `variants` and `part_compatibility` (evidence `oem-catalogue`). Follow TecDoc's caching and display terms |
| OEM / dealer EPCs | Licence per brand | Exact OEM numbers by VIN | Same adapter pattern, `evidence='oem-catalogue'` |
| Supplier-provided data | Supplier's own data | Their stock, their knowledge of fitment | CSV/API imports. `fitment='verified'` only when an OEM number is supplied |

## Known gaps (handled gracefully)
- **GCC-specification vehicles** (e.g. Gulf-only engine/trim combinations, Patrol and Land Cruiser variants) are often missing or differently named in US data. When a customer's vehicle isn't in the catalogue, search still works on make/model/year/part, and compatibility is shown as *likely* or *confirm*, never *verified*.
- Imported vehicles (US/Japan/Korea grey imports) can differ from GCC spec. Listings carry `market_spec` (GCC / Imported / Unknown).
- The request flow (`/request`) covers anything the catalogue doesn't know.

## What we do not do
- No scraping of commercial catalogues or marketplaces, and no bypassing licence terms.
- No reuse of third-party photographs: `part_images.usage_rights` records where each image came from.
