/**
 * Exports reference data to ../shared so the Python backend uses exactly the
 * same catalogue as the frontend:
 *   shared/catalog.json      vehicle catalogue, part taxonomy, emirates
 *   shared/sample-data.json  FICTIONAL demo suppliers + listings (for `python -m app.jobs seed-demo`)
 * Run: npm run export:catalog
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { MAKES } from "../lib/data/vehicles";
import { CATEGORIES } from "../lib/data/taxonomy";
import { EMIRATES } from "../lib/data/emirates";
import { seedParts, seedSuppliers } from "../lib/data/seed";

const dir = resolve(__dirname, "../../shared");
writeFileSync(`${dir}/catalog.json`, JSON.stringify({ version: 1, makes: MAKES, categories: CATEGORIES, emirates: EMIRATES }, null, 1) + "\n");
const suppliers = seedSuppliers();
writeFileSync(
  `${dir}/sample-data.json`,
  JSON.stringify({ notice: "FICTIONAL SAMPLE DATA — not real suppliers or stock", exportedAt: new Date().toISOString(), suppliers, parts: seedParts(suppliers) }, null, 1) + "\n",
);
console.log(`wrote ${dir}/catalog.json and sample-data.json`);
