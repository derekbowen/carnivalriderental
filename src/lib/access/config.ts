/**
 * Event Access configuration. Everything commercial is data: the default product below is seeded
 * into `access_products` on first migration and can be changed there (price, unlock limit,
 * validity, minimum matches, more products) without touching code. Copy must read these values,
 * never hard-code them.
 */
import type { AccessDb, Row } from "./db";
import { nowIso } from "./db";

export interface AccessProduct {
  id: string;
  slug: string;
  name: string;
  description: string;
  stripePriceId: string | null;
  priceCents: number;
  currency: string;
  unlockLimit: number;
  validityDays: number;
  minimumMatches: number;
  active: boolean;
}

/** Founder's initial commercial configuration (2026-10-06). Changeable in the database. */
export const DEFAULT_PRODUCT: Omit<AccessProduct, "active"> = {
  id: "prod_event_access_v1",
  slug: "event-access",
  name: "Event Access",
  description: "Direct contact details for matching independent carnival operators, for one event.",
  stripePriceId: null,
  priceCents: 9900,
  currency: "usd",
  unlockLimit: 5,
  validityDays: 30,
  minimumMatches: 3,
};

/** Straight-line miles considered "near" the event; the same radius the public pages use. */
export const MATCH_RADIUS_MILES = 200;
/** Candidate operators kept in a match snapshot (the pass can unlock `unlockLimit` of them). */
export const MAX_MATCHED_OPERATORS = 25;

export const rowToProduct = (r: Row): AccessProduct => ({
  id: String(r.id),
  slug: String(r.slug),
  name: String(r.name),
  description: String(r.description),
  stripePriceId: r.stripe_price_id ? String(r.stripe_price_id) : null,
  priceCents: Number(r.price_cents),
  currency: String(r.currency),
  unlockLimit: Number(r.unlock_limit),
  validityDays: Number(r.validity_days),
  minimumMatches: Number(r.minimum_matches),
  active: Number(r.active) === 1,
});

export async function ensureDefaultProduct(db: AccessDb): Promise<void> {
  const t = nowIso();
  const p = DEFAULT_PRODUCT;
  await db.query(
    `INSERT INTO access_products (id, slug, name, description, stripe_price_id, price_cents, currency, unlock_limit, validity_days, minimum_matches, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?) ON CONFLICT (id) DO NOTHING`,
    [p.id, p.slug, p.name, p.description, p.stripePriceId, p.priceCents, p.currency, p.unlockLimit, p.validityDays, p.minimumMatches, t, t],
  );
}

export async function activeProduct(db: AccessDb, slug = DEFAULT_PRODUCT.slug): Promise<AccessProduct | null> {
  await ensureDefaultProduct(db);
  const rows = await db.query(`SELECT * FROM access_products WHERE slug = ? AND active = 1`, [slug]);
  return rows[0] ? rowToProduct(rows[0]) : null;
}

export const formatPrice = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
