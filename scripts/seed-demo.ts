/**
 * Seeds FICTIONAL demo suppliers and ride units into the development store so the
 * internal console can be exercised. Names are invented and labelled; they do not
 * represent real operators. Refuses to run outside APP_ENV=development.
 */
import { openDb } from "../src/lib/requests/db";
import { RequestService } from "../src/lib/requests/service";

if ((process.env.APP_ENV || "development") !== "development") {
  console.error("Refusing to seed demo data outside APP_ENV=development.");
  process.exit(1);
}
const svc = new RequestService(openDb(process.env.DATABASE_PATH || "data/dev.sqlite"));
if (svc.listSuppliers().some((s) => s.isDemo)) {
  console.log("Demo suppliers already present — nothing to do.");
  process.exit(0);
}
const a = svc.addSupplier({ name: "DEMO Operator A (fictional)", relationship: "verified_supplier", region: "Fictional — Central US", notes: "Fictional record for development. Not a real company.", isDemo: true });
const b = svc.addSupplier({ name: "DEMO Operator B (fictional)", relationship: "contacted", region: "Fictional — Southwest US", notes: "Fictional record for development.", isDemo: true });
const c = svc.addSupplier({ name: "DEMO Prospect C (fictional)", relationship: "researched_prospect", region: "Fictional — Mountain West", notes: "Fictional researched prospect. Not a partner.", isDemo: true });
svc.addUnit({ supplierId: a.id, rideSlug: "ferris-wheel-rental", description: "DEMO Ferris wheel unit A1 (fictional, specs unverified)", homeBase: null, verification: "unverified", isDemo: true });
svc.addUnit({ supplierId: b.id, rideSlug: "ferris-wheel-rental", description: "DEMO Ferris wheel unit B1 (fictional, specs unverified)", homeBase: null, verification: "unverified", isDemo: true });
svc.addUnit({ supplierId: c.id, rideSlug: "carousel-rental", description: "DEMO Carousel unit C1 (fictional, specs unverified)", homeBase: null, verification: "unverified", isDemo: true });
console.log("Seeded 3 fictional demo suppliers and 3 demo units.");
