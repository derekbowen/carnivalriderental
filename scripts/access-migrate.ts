/**
 * Applies src/lib/access/schema.sql to the ledger database and seeds the default product.
 *   npm run access:migrate            # ACCESS_DATABASE_URL (Postgres) or DATABASE_PATH (SQLite, dev)
 * Idempotent: CREATE IF NOT EXISTS + ON CONFLICT DO NOTHING. Never prints secrets.
 */
import { ensureDefaultProduct } from "../src/lib/access/config";
import { accessDb, accessStorageMode } from "../src/lib/access/db";

(async () => {
  const mode = accessStorageMode();
  if (mode.kind === "disabled") throw new Error(mode.reason);
  const db = await accessDb();
  await ensureDefaultProduct(db);
  const products = await db.query(`SELECT slug, price_cents, currency, unlock_limit, validity_days, minimum_matches, active FROM access_products ORDER BY slug`);
  console.log(`Ledger ready on ${db.engine}${mode.kind === "sqlite" ? ` (${mode.file})` : ""}.`);
  for (const p of products) console.log(`  ${p.slug}: ${Number(p.price_cents) / 100} ${String(p.currency).toUpperCase()}, ${p.unlock_limit} unlocks, ${p.validity_days} days, min ${p.minimum_matches} matches, active=${p.active}`);
  process.exit(0);
})().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
