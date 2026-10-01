import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";
import { databasePath } from "../config";

/**
 * Development request store: a single SQLite file via Node's built-in node:sqlite
 * (no native dependency, no extra service). Swappable for Postgres later behind
 * the same service API — see docs/ARCHITECTURE.md.
 *
 * Loaded through process.getBuiltinModule so the bundler never tries to resolve it.
 */
export type Db = DatabaseSyncType;

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS event_requests (
     id TEXT PRIMARY KEY,
     reference TEXT NOT NULL UNIQUE,
     idempotency_key TEXT NOT NULL UNIQUE,
     payload_hash TEXT NOT NULL,
     brief_json TEXT NOT NULL,
     fulfilment_status TEXT NOT NULL,
     payment_status TEXT NOT NULL,
     payment_mode TEXT NOT NULL,
     is_test_data INTEGER NOT NULL,
     assigned_supplier_id TEXT,
     assigned_unit_id TEXT,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS customer_quotes (
     id TEXT PRIMARY KEY,
     request_id TEXT NOT NULL REFERENCES event_requests(id),
     version INTEGER NOT NULL,
     amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
     scope TEXT NOT NULL,
     status TEXT NOT NULL,
     created_at TEXT NOT NULL,
     sent_at TEXT,
     accepted_at TEXT,
     UNIQUE (request_id, version)
   )`,
  `CREATE TABLE IF NOT EXISTS suppliers (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     relationship TEXT NOT NULL,
     region TEXT,
     notes TEXT,
     is_demo INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS ride_units (
     id TEXT PRIMARY KEY,
     supplier_id TEXT NOT NULL REFERENCES suppliers(id),
     ride_slug TEXT NOT NULL,
     description TEXT NOT NULL,
     home_base TEXT,
     verification TEXT NOT NULL,
     is_demo INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS request_suppliers (
     id TEXT PRIMARY KEY,
     request_id TEXT NOT NULL REFERENCES event_requests(id),
     supplier_id TEXT NOT NULL REFERENCES suppliers(id),
     unit_id TEXT REFERENCES ride_units(id),
     stage TEXT NOT NULL,
     notes TEXT,
     updated_at TEXT NOT NULL,
     UNIQUE (request_id, supplier_id)
   )`,
  `CREATE TABLE IF NOT EXISTS supplier_quotes (
     id TEXT PRIMARY KEY,
     request_id TEXT NOT NULL REFERENCES event_requests(id),
     supplier_id TEXT NOT NULL REFERENCES suppliers(id),
     supplier_price_cents INTEGER,
     transport_cents INTEGER,
     crew_cents INTEGER,
     other_cents INTEGER,
     notes TEXT,
     created_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS status_events (
     id TEXT PRIMARY KEY,
     request_id TEXT NOT NULL REFERENCES event_requests(id),
     track TEXT NOT NULL,
     from_status TEXT,
     to_status TEXT,
     actor TEXT NOT NULL,
     note TEXT,
     created_at TEXT NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS idx_status_events_request ON status_events(request_id, created_at)`,
];

export function openDb(file: string): Db {
  const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");
  if (file !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON");
  if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL");
  for (const m of MIGRATIONS) db.exec(m);
  return db;
}

const globalForDb = globalThis as unknown as { __bacDb?: Db };

/** Process-wide connection for the app server. */
export function getDb(): Db {
  if (!globalForDb.__bacDb) globalForDb.__bacDb = openDb(databasePath());
  return globalForDb.__bacDb;
}
