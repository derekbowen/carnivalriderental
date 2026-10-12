/**
 * Event Access configuration. Everything commercial is data: the products below are seeded into
 * `access_products` on first migration (ON CONFLICT DO NOTHING, so a price changed in the database
 * is never reset by a deploy) and can be changed there (price, unlock limit, validity, minimum
 * matches) without touching code. Copy must read these values, never hard-code them.
 *
 * Tiers (pricing.ts decides which one a request belongs to):
 *   standard  Event Access                slug event-access
 *   ferris    Ferris Wheel Event Access   slug ferris-wheel-access
 * A tier whose product row is missing or inactive is not for sale; there is no fallback to another
 * tier's price.
 */
import type { AccessDb, Row } from "./db";
import { nowIso } from "./db";
import type { AccessTier } from "./pricing";

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

/** Ferris wheel tier (founder decision 2026-10-12): same terms, premium price. Changeable in the database. */
export const FERRIS_PRODUCT: Omit<AccessProduct, "active"> = {
  id: "prod_ferris_wheel_access_v1",
  slug: "ferris-wheel-access",
  name: "Ferris Wheel Event Access",
  description: "Direct contact details for matching independent Ferris wheel operators, for one event.",
  stripePriceId: null,
  priceCents: 19900,
  currency: "usd",
  unlockLimit: 5,
  validityDays: 30,
  minimumMatches: 3,
};

export const DEFAULT_PRODUCTS: readonly Omit<AccessProduct, "active">[] = [DEFAULT_PRODUCT, FERRIS_PRODUCT];

/** Tier → product slug. The slug is the stable key; ids are versioned when terms change materially. */
export const TIER_SLUGS: Record<AccessTier, string> = { standard: DEFAULT_PRODUCT.slug, ferris: FERRIS_PRODUCT.slug };
export const tierOfProduct = (p: Pick<AccessProduct, "slug">): AccessTier | null => (Object.keys(TIER_SLUGS) as AccessTier[]).find((t) => TIER_SLUGS[t] === p.slug) ?? null;

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

/** Idempotent seed: inserts missing product rows, never updates existing ones (DB-managed prices survive deploys). */
export async function ensureDefaultProducts(db: AccessDb): Promise<void> {
  const t = nowIso();
  for (const p of DEFAULT_PRODUCTS) {
    await db.query(
      `INSERT INTO access_products (id, slug, name, description, stripe_price_id, price_cents, currency, unlock_limit, validity_days, minimum_matches, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?) ON CONFLICT (id) DO NOTHING`,
      [p.id, p.slug, p.name, p.description, p.stripePriceId, p.priceCents, p.currency, p.unlockLimit, p.validityDays, p.minimumMatches, t, t],
    );
  }
}
/** @deprecated use ensureDefaultProducts; kept for scripts written against the single-product ledger. */
export const ensureDefaultProduct = ensureDefaultProducts;

export async function activeProduct(db: AccessDb, slug = DEFAULT_PRODUCT.slug): Promise<AccessProduct | null> {
  await ensureDefaultProducts(db);
  const rows = await db.query(`SELECT * FROM access_products WHERE slug = ? AND active = 1`, [slug]);
  return rows[0] ? rowToProduct(rows[0]) : null;
}

/** The active product for a tier, or null when that tier is not for sale (never another tier's product). */
export const productForTier = (db: AccessDb, tier: AccessTier): Promise<AccessProduct | null> => activeProduct(db, TIER_SLUGS[tier]);

export interface AccessProducts {
  standard: AccessProduct | null;
  ferris: AccessProduct | null;
}
/** Both tiers' active products for display (null where a tier is not for sale). */
export async function activeProducts(db: AccessDb): Promise<AccessProducts> {
  await ensureDefaultProducts(db);
  const rows = (await db.query(`SELECT * FROM access_products WHERE active = 1`)).map(rowToProduct);
  const by = (slug: string) => rows.find((p) => p.slug === slug) ?? null;
  return { standard: by(TIER_SLUGS.standard), ferris: by(TIER_SLUGS.ferris) };
}

export const formatPrice = (cents: number, currency = "usd") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100);
