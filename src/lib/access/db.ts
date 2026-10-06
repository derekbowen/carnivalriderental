/**
 * The access ledger's database: one small driver interface over Postgres (production, via
 * ACCESS_DATABASE_URL) or node:sqlite (local development and e2e, via DATABASE_PATH).
 *
 * SQL is written once with `?` placeholders in src/lib/access/*.ts and converted to `$n` for
 * Postgres here. Only features both engines share are used (RETURNING, ON CONFLICT DO NOTHING,
 * transactions). See docs/PAID_ACCESS_ARCHITECTURE.md for why there are two engines.
 *
 * Production never runs on SQLite: accessStorageMode() refuses it unless APP_ENV=development.
 */
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { appEnv, databasePath } from "../config";

export type Row = Record<string, unknown>;
export interface Sql {
  query<T extends Row = Row>(text: string, params?: unknown[]): Promise<T[]>;
}
export interface AccessDb extends Sql {
  engine: "postgres" | "sqlite";
  transaction<T>(fn: (tx: Sql) => Promise<T>): Promise<T>;
}

export type StorageMode = { kind: "postgres"; url: string } | { kind: "sqlite"; file: string } | { kind: "disabled"; reason: string };

/** Which engine this process may use. The paid flow is disabled rather than silently unsafe. */
export function accessStorageMode(env: Record<string, string | undefined> = process.env): StorageMode {
  const url = env.ACCESS_DATABASE_URL;
  if (url) return { kind: "postgres", url };
  if ((env.APP_ENV || "development") === "development") return { kind: "sqlite", file: env.DATABASE_PATH || databasePath() };
  return { kind: "disabled", reason: "ACCESS_DATABASE_URL is not set; the access ledger needs Postgres outside development" };
}

const SCHEMA = fs.readFileSync(path.join(process.cwd(), "src/lib/access/schema.sql"), "utf8");
const statements = () => SCHEMA.split(/;\s*\n/).map((s) => s.replace(/^\s*--.*$/gm, "").trim()).filter(Boolean);

// ------------------------------------------------------------------------------ sqlite
function sqliteDb(file: string): AccessDb {
  const { DatabaseSync } = process.getBuiltinModule("node:sqlite") as typeof import("node:sqlite");
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db: DatabaseSync = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  for (const s of statements()) db.exec(s);
  const run = async <T extends Row>(text: string, params: unknown[] = []): Promise<T[]> => {
    const stmt = db.prepare(text);
    const norm = params.map((p) => (typeof p === "boolean" ? (p ? 1 : 0) : p === undefined ? null : p)) as Parameters<typeof stmt.all>;
    if (/^\s*(select|with)\b/i.test(text) || /\breturning\b/i.test(text)) return stmt.all(...norm) as unknown as T[];
    stmt.run(...norm);
    return [];
  };
  let depth = 0;
  return {
    engine: "sqlite",
    query: run,
    async transaction(fn) {
      if (depth > 0) return fn({ query: run });
      depth++;
      db.exec("BEGIN IMMEDIATE");
      try {
        const out = await fn({ query: run });
        db.exec("COMMIT");
        return out;
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      } finally {
        depth--;
      }
    },
  };
}

// ------------------------------------------------------------------------------ postgres
const toPg = (text: string) => {
  let i = 0;
  return text.replace(/\?/g, () => `$${++i}`);
};

/**
 * TLS is decided here, not by the URL: `pg` treats `sslmode=require` as verify-full, which fails on
 * Supabase's pooler certificate chain, so any sslmode/ssl query parameter is stripped.
 */
export function pgConnectionString(url: string): string {
  const u = new URL(url);
  for (const k of ["sslmode", "ssl", "sslrootcert", "uselibpqcompat"]) u.searchParams.delete(k);
  return u.toString().replace(/\?$/, "");
}

async function postgresDb(url: string): Promise<AccessDb> {
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString: pgConnectionString(url), max: 4, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    for (const s of statements()) await client.query(s);
  } finally {
    client.release();
  }
  const q = (c: { query: (t: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }) =>
    async <T extends Row>(text: string, params: unknown[] = []) => (await c.query(toPg(text), params.map((p) => (p === undefined ? null : p)))).rows as T[];
  return {
    engine: "postgres",
    query: q(pool),
    async transaction(fn) {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const out = await fn({ query: q(c) });
        await c.query("COMMIT");
        return out;
      } catch (e) {
        await c.query("ROLLBACK").catch(() => undefined);
        throw e;
      } finally {
        c.release();
      }
    },
  };
}

// ------------------------------------------------------------------------------ singleton
const g = globalThis as unknown as { __accessDb?: Promise<AccessDb>; __accessDbKey?: string };

export async function accessDb(): Promise<AccessDb> {
  const mode = accessStorageMode();
  if (mode.kind === "disabled") throw new Error(mode.reason);
  const key = mode.kind === "postgres" ? `pg:${mode.url}` : `sqlite:${mode.file}`;
  if (!g.__accessDb || g.__accessDbKey !== key) {
    g.__accessDbKey = key;
    g.__accessDb = mode.kind === "postgres" ? postgresDb(mode.url) : Promise.resolve(sqliteDb(mode.file));
  }
  return g.__accessDb;
}

/** Tests: an isolated in-memory ledger. */
export function memoryAccessDb(): AccessDb {
  return sqliteDb(":memory:");
}

export const nowIso = () => new Date().toISOString();
export const isProductionLike = () => appEnv() !== "development";
