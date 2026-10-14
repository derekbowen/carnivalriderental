/** Run only on a trusted host with this project's existing env. Read-only; never prints env values. */
import "./lib/target-env";
import { Pool } from "pg";
import { integrationGet } from "../src/lib/integrations/sharetribe";
import { pgConnectionString } from "../src/lib/access/db";

async function main() {
  const marketplace = await integrationGet<{ data: { attributes: { name: string } } }>("/marketplace/show");
  if (marketplace.data.attributes.name !== "CarnivalRental") throw new Error("Integration app is not the expected LIVE marketplace");
  console.log("LIVE marketplace identity verified: CarnivalRental");
  // This ID is retired, not used by any production request route. Check it separately; never create a listing.
  const desk = process.env.REQUEST_DESK_LISTING_ID;
  if (desk) {
    try { await integrationGet("/listings/show", { id: desk }); console.log("Retired REQUEST_DESK_LISTING_ID resolves in LIVE; not used by Event Access or concierge."); }
    catch { console.log("Retired REQUEST_DESK_LISTING_ID does not resolve in LIVE; remove the stale env variable. No customer route uses it."); }
  } else console.log("Retired REQUEST_DESK_LISTING_ID is unset.");
  const url = process.env.ACCESS_DATABASE_URL;
  if (!url) throw new Error("Access database is not configured");
  const u = new URL(url);
  if (!`${u.hostname}/${decodeURIComponent(u.username)}`.includes("xvjnwsaxoszovogzbutw")) throw new Error("Database connection does not identify the documented carnivalriderental Supabase project; verify ownership before proceeding");
  const pool = new Pool({ connectionString: pgConnectionString(url), ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000, max: 1 });
  try {
    const tables = await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('access_products','access_event_requests','access_purchases','access_passes','access_unlocks')`);
    if (tables.rows.length !== 5) throw new Error("Access tables missing");
    const products = await pool.query(`SELECT slug, price_cents, unlock_limit, validity_days, active FROM access_products WHERE slug IN ('event-access', 'ferris-wheel-access') ORDER BY slug`);
    console.log("Documented Supabase project connection and existing access tables verified.");
    console.log(JSON.stringify({ products: products.rows }));
    const privacy = await pool.query(`SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'concierge_%'`);
    console.log(JSON.stringify({ conciergeTables: privacy.rows }));
  } finally { await pool.end(); }
}
main().catch(() => { console.error("Preflight failed; check marketplace identity, database ownership and connectivity on the trusted host. No credential or raw upstream error logged."); process.exitCode = 1; });
