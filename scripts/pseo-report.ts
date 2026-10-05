/**
 * Inventory pSEO route report: what renders, what would be indexable, what is in the sitemap.
 *   npm run pseo:report     → prints counts, writes reports/pseo-routes.json
 */
import fs from "node:fs";
import { CITIES, inventoryRoutes, PSEO_INVENTORY, ridesNear } from "../src/lib/inventory";

const routes = inventoryRoutes();
const city = routes.filter((r) => r.family === "city");
const rideCity = routes.filter((r) => r.family === "ride-city");
const indexable = routes.filter((r) => r.gate.indexable);
const supplyOk = (r: (typeof routes)[number]) => !r.gate.reasons.some((x) => x.startsWith("only "));
const zeroSupplyCities = CITIES.filter((c) => ridesNear(c.lat, c.lng).length === 0).length;
const out = {
  thresholds: PSEO_INVENTORY,
  renderable: {
    cityPages: CITIES.length,
    cityPagesWithSupply: city.length,
    cityPagesWithoutSupply: zeroSupplyCities,
    rideCityPages: rideCity.length,
    total: CITIES.length + rideCity.length,
  },
  meetSupplyThreshold: { city: city.filter(supplyOk).length, rideCity: rideCity.filter(supplyOk).length },
  indexableNow: indexable.length,
  sitemapUrls: indexable.length,
  noindexNow: CITIES.length + rideCity.length - indexable.length,
  blockingReasons: [...new Set(routes.flatMap((r) => r.gate.reasons.filter((x) => !x.startsWith("only "))))],
};
fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync("reports/pseo-routes.json", `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify(out, null, 2));
