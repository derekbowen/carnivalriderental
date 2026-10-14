/**
 * Applies src/lib/access/schema.sql to the ledger database and seeds the products (Event Access,
 * Ferris Wheel Event Access).
 *   npm run access:migrate                 # ACCESS_DATABASE_URL (Postgres) or DATABASE_PATH (SQLite, dev)
 *   npm run access:migrate -- --concierge  # also the concierge + lifecycle-event tables (schema-concierge.sql);
 *                                          # an explicit founder step, never run by a deploy
 * Idempotent: CREATE IF NOT EXISTS + ON CONFLICT DO NOTHING, so prices managed in the database are
 * never reset and purchases are untouched. Never prints secrets.
 */
import { ensureDefaultProducts } from "../src/lib/access/config";
import { accessDb, accessStorageMode, applyConciergeSchema, CONCIERGE_TABLES } from "../src/lib/access/db";

(async () => {
  const mode = accessStorageMode();
  if (mode.kind === "disabled") throw new Error(mode.reason);
  const db = await accessDb();
  await ensureDefaultProducts(db);
  if (process.argv.includes("--concierge")) {
    await applyConciergeSchema(db);
    console.log(`Concierge tables ready: ${CONCIERGE_TABLES.join(", ")}${db.engine === "postgres" ? " (RLS on, no PUBLIC grants)" : ""}.`);
  }
  const products = await db.query(`SELECT slug, price_cents, currency, unlock_limit, validity_days, minimum_matches, active FROM access_products ORDER BY slug`);
  console.log(`Ledger ready on ${db.engine}${mode.kind === "sqlite" ? ` (${mode.file})` : ""}.`);
  for (const p of products) console.log(`  ${p.slug}: ${Number(p.price_cents) / 100} ${String(p.currency).toUpperCase()}, ${p.unlock_limit} unlocks, ${p.validity_days} days, min ${p.minimum_matches} matches, active=${p.active}`);
  process.exit(0);
})().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
