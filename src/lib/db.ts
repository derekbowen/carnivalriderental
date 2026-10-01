// Development backend: one SQLite file through Node's built-in node:sqlite.
// No native dependency, no extra service. Swappable later for Postgres behind
// the repository functions in src/lib/requests/repo.ts.
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const MIGRATIONS: string[] = [
  `CREATE TABLE event_requests (
     id TEXT PRIMARY KEY,
     reference TEXT NOT NULL UNIQUE,
     idempotency_key TEXT NOT NULL UNIQUE,
     payload_hash TEXT NOT NULL,
     ride_slug TEXT,
     ride_flexibility TEXT NOT NULL,
     date_start TEXT NOT NULL,
     date_end TEXT,
     date_flexibility TEXT NOT NULL,
     city TEXT NOT NULL,
     state TEXT NOT NULL,
     venue TEXT,
     operating_hours TEXT,
     event_type TEXT NOT NULL,
     expected_attendance TEXT,
     budget TEXT,
     site_access TEXT NOT NULL,
     available_space TEXT NOT NULL,
     power TEXT NOT NULL,
     notes TEXT,
     contact_name TEXT NOT NULL,
     contact_email TEXT NOT NULL,
     contact_phone TEXT,
     organization TEXT,
     fulfillment_status TEXT NOT NULL,
     payment_status TEXT NOT NULL,
     next_action TEXT,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )`,
  `CREATE TABLE request_history (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     request_id TEXT NOT NULL REFERENCES event_requests(id),
     kind TEXT NOT NULL,
     from_status TEXT,
     to_status TEXT,
     note TEXT,
     actor TEXT NOT NULL,
     created_at TEXT NOT NULL
   )`,
  `CREATE TABLE suppliers (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     status TEXT NOT NULL CHECK (status IN ('researched','contacted','verified')),
     region TEXT,
     contact TEXT,
     notes TEXT,
     is_fixture INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )`,
  `CREATE TABLE request_suppliers (
     id TEXT PRIMARY KEY,
     request_id TEXT NOT NULL REFERENCES event_requests(id),
     supplier_id TEXT NOT NULL REFERENCES suppliers(id),
     stage TEXT NOT NULL CHECK (stage IN ('considering','contacted','quoted','committed','declined')),
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     UNIQUE (request_id, supplier_id)
   )`,
  `CREATE TABLE supplier_quotes (
     id TEXT PRIMARY KEY,
     request_supplier_id TEXT NOT NULL REFERENCES request_suppliers(id),
     version INTEGER NOT NULL,
     supplier_quote_cents INTEGER,
     transport_cents INTEGER,
     crew_cents INTEGER,
     other_cents INTEGER,
     scope TEXT,
     created_at TEXT NOT NULL,
     UNIQUE (request_supplier_id, version)
   )`,
  `CREATE TABLE customer_quotes (
     id TEXT PRIMARY KEY,
     request_id TEXT NOT NULL REFERENCES event_requests(id),
     version INTEGER NOT NULL,
     price_cents INTEGER NOT NULL CHECK (price_cents > 0),
     scope TEXT NOT NULL,
     status TEXT NOT NULL CHECK (status IN ('draft','sent','accepted','superseded','withdrawn')),
     sent_at TEXT,
     accepted_at TEXT,
     created_at TEXT NOT NULL,
     UNIQUE (request_id, version)
   )`,
];

export type DB = DatabaseSync;

function migrate(db: DB) {
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)");
  const row = db.prepare("SELECT version FROM schema_version").get() as { version: number } | undefined;
  let version = row?.version ?? 0;
  if (!row) db.prepare("INSERT INTO schema_version (version) VALUES (0)").run();
  while (version < MIGRATIONS.length) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[version]);
      version += 1;
      db.prepare("UPDATE schema_version SET version = ?").run(version);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  }
}

export function openDb(file: string): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  migrate(db);
  return db;
}

const g = globalThis as unknown as { __bacDb?: DB };

/** The process-wide connection used by route handlers and server pages. */
export function getDb(): DB {
  if (!g.__bacDb) g.__bacDb = openDb(process.env.DATABASE_PATH || ".data/dev.sqlite");
  return g.__bacDb;
}

export function tx<T>(db: DB, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
