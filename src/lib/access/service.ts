/**
 * Event Access: the ledger's business rules. Every function takes the database (and, where needed,
 * the Stripe gateway and operator source) as arguments so tests run against an in-memory ledger and
 * a fake gateway. Route handlers in src/app/api/access and src/app/api/pass are thin wrappers.
 *
 * Invariants (see docs/PAID_ACCESS_ARCHITECTURE.md):
 * - a purchase is paid only on server-verified Stripe state (webhook or session retrieval);
 * - one purchase → at most one pass (UNIQUE purchase_id); terms copied at purchase time;
 * - unlocks are per operator (UNIQUE pass_id, operator_id); re-opening is free; the counter can't
 *   exceed the limit under concurrency (guarded UPDATE in a transaction, retried on unique conflict);
 * - refunds and disputes revoke the pass; the unlock audit is never deleted;
 * - contact values live only in unlocks.contact_snapshot, written after the entitlement check.
 */
import crypto from "node:crypto";
import { z } from "zod";
import { US_STATES } from "../taxonomy";
import { formatPrice, productForTier, type AccessProduct, rowToProduct } from "./config";
import { isContactable, revealFields, type OperatorSource, type ContactChannels } from "./contacts";
import type { AccessDb, Row, Sql } from "./db";
import { nowIso } from "./db";
import { BRAND } from "../config";
import { magicLinkEmail, manualSearchEmail, passEmail, sendNow } from "./email";
import { CONCIERGE_SOURCE_PATH, recordLifecycleEvent, sourceOfPath } from "../lifecycle/events";
import { conciergeEnabled } from "../concierge/flags";
import { computeFallbacks, matchForSpec, requirementNoun, sameOffer, specForOffer, type FallbackOffer } from "./fallback";
import { geocode, matchOperators, type ContactStatusCache, type MatchedOperator } from "./matching";
import { resolveCriteria, tierForRideType, type AccessTier } from "./pricing";
import { hashToken, newToken } from "./session";
import { stripeMode, type CheckoutSession, type StripeEvent, type StripeGateway } from "./stripe";

// ------------------------------------------------------------------------------ input
const STATE_CODES = new Set(US_STATES.map((s) => s.abbr.toUpperCase()));
/** An optional whole number from the form or the chat. Blank means not given: null, never 0. */
const optionalCount = (max: number) =>
  z
    .preprocess((v) => (v === null || (typeof v === "string" && v.trim() === "") ? undefined : v), z.coerce.number().int().min(0).max(max).optional())
    .transform((v) => v ?? null);

export const eventRequestInput = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  city: z.string().trim().min(1).max(80),
  state: z.string().trim().toUpperCase().refine((s) => STATE_CODES.has(s), "Choose a state"),
  zip: z.string().trim().regex(/^\d{5}$/).optional().or(z.literal("")).transform((v) => v || null),
  eventType: z.string().trim().max(60).optional().or(z.literal("")).transform((v) => v || null),
  rideType: z.string().trim().regex(/^[a-z0-9-]+$/).max(60).optional().or(z.literal("")).transform((v) => v || null),
  rideClass: z.string().trim().regex(/^[a-z0-9-]+$/).max(40).optional().or(z.literal("")).transform((v) => v || null),
  listingId: z.string().trim().regex(/^[0-9a-f-]{36}$/).optional().or(z.literal("")).transform((v) => v || null),
  attendance: optionalCount(1_000_000),
  budgetUsd: optionalCount(10_000_000),
  sourcePath: z.string().max(300).optional().or(z.literal("")).transform((v) => v || null),
});
export type EventRequestInput = z.infer<typeof eventRequestInput>;

export interface EventRequest {
  id: string;
  email: string;
  eventDate: string;
  city: string;
  state: string;
  zip: string | null;
  eventType: string | null;
  rideType: string | null;
  rideClass: string | null;
  listingId: string | null;
  attendance: number | null;
  budgetCents: number | null;
  lat: number;
  lng: number;
  operators: MatchedOperator[];
  matchedOperators: number;
  /** The product the request was quoted at when it was created (see quoteForEvent for the live quote). */
  productId: string;
  /** Re-derived from the persisted, already-resolved ride requirement; never from the client. */
  tier: AccessTier;
  status: "matched" | "insufficient";
  createdAt: string;
  sourcePath: string | null;
}
const rowToEvent = (r: Row): EventRequest => ({
  sourcePath: r.source_path ? String(r.source_path) : null,
  id: String(r.id),
  email: String(r.email),
  eventDate: String(r.event_date),
  city: String(r.city),
  state: String(r.state),
  zip: r.zip ? String(r.zip) : null,
  eventType: r.event_type ? String(r.event_type) : null,
  rideType: r.ride_type ? String(r.ride_type) : null,
  rideClass: r.ride_class ? String(r.ride_class) : null,
  listingId: r.listing_id ? String(r.listing_id) : null,
  attendance: r.attendance === null || r.attendance === undefined ? null : Number(r.attendance),
  budgetCents: r.budget_cents === null || r.budget_cents === undefined ? null : Number(r.budget_cents),
  lat: Number(r.lat),
  lng: Number(r.lng),
  operators: JSON.parse(String(r.match_json)) as MatchedOperator[],
  matchedOperators: Number(r.matched_operators),
  productId: String(r.product_id),
  tier: tierForRideType(r.ride_type ? String(r.ride_type) : null),
  status: r.status as EventRequest["status"],
  createdAt: String(r.created_at),
});

/** Contactability flags cached in the ledger for 24 h (flags only, never contact values). */
export function dbContactCache(db: AccessDb, ttlMs = 24 * 3600e3): ContactStatusCache {
  return {
    async get(ids) {
      if (ids.length === 0) return new Map();
      const rows = await db.query(`SELECT * FROM operator_contact_status WHERE sharetribe_operator_id IN (${ids.map(() => "?").join(",")})`, ids);
      const cutoff = new Date(Date.now() - ttlMs).toISOString();
      return new Map(rows.filter((r) => String(r.checked_at) > cutoff).map((r) => [String(r.sharetribe_operator_id), { hasPhone: !!Number(r.has_phone), hasEmail: !!Number(r.has_email), hasWebsite: !!Number(r.has_website), claimed: !!Number(r.claimed) } satisfies ContactChannels]));
    },
    async put(id, ch) {
      await db.query(`DELETE FROM operator_contact_status WHERE sharetribe_operator_id = ?`, [id]);
      await db.query(`INSERT INTO operator_contact_status (sharetribe_operator_id, has_phone, has_email, has_website, claimed, checked_at) VALUES (?, ?, ?, ?, ?, ?)`, [id, ch.hasPhone ? 1 : 0, ch.hasEmail ? 1 : 0, ch.hasWebsite ? 1 : 0, ch.claimed ? 1 : 0, nowIso()]);
    },
  };
}

// ------------------------------------------------------------------------------ 1. event request + preflight
export class AccessError extends Error {
  constructor(public code: "invalid" | "geocode" | "unavailable" | "not_found" | "not_sellable" | "forbidden" | "limit" | "expired" | "revoked", message: string) {
    super(message);
  }
}

const tierUnavailable = (tier: AccessTier) => new AccessError("unavailable", tier === "ferris" ? "Ferris Wheel Event Access is not available right now" : "Event Access is not configured");

/**
 * Step 1. The ride requirement is resolved once (pricing.ts: authoritative listing classification
 * first, then canonical ride type, then class) and that single resolution both selects the product
 * tier and drives matching. Nothing the client sends (price, product id, hidden fields, referrer)
 * is consulted for pricing. The resolved criteria and the product are persisted with the request.
 */
export async function startEventRequest(db: AccessDb, source: OperatorSource, raw: unknown, opts: { cache?: ContactStatusCache; today?: () => string } = {}): Promise<{ event: EventRequest; product: AccessProduct; sellable: boolean }> {
  const parsed = eventRequestInput.safeParse(raw);
  if (!parsed.success) throw new AccessError("invalid", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const input = parsed.data;
  const today = (opts.today ?? (() => new Date().toISOString().slice(0, 10)))();
  if (input.eventDate < today) throw new AccessError("invalid", "eventDate: pick a date from today onwards");
  const criteria = resolveCriteria({ listingId: input.listingId, rideType: input.rideType, rideClass: input.rideClass });
  const product = await productForTier(db, criteria.tier);
  if (!product) throw tierUnavailable(criteria.tier);
  const geo = geocode(input.city, input.state);
  if (!geo) throw new AccessError("geocode", "We couldn't place that city");
  const cache = opts.cache ?? dbContactCache(db);
  const match = await matchOperators({ lat: geo.lat, lng: geo.lng, state: input.state, listingId: criteria.listingId, rideType: criteria.rideType, rideClass: criteria.rideClass }, source, cache);
  if (match.criteria.tier !== criteria.tier || match.criteria.rideType !== criteria.rideType) throw new Error("matching and pricing resolved different criteria");
  const sellable = match.contactableCount >= product.minimumMatches;
  const id = crypto.randomUUID();
  const t = nowIso();
  await db.query(
    `INSERT INTO access_event_requests (id, email, event_date, city, state, zip, event_type, ride_type, ride_class, listing_id, attendance, budget_cents, lat, lng, match_json, matched_operators, product_id, status, source_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.email, input.eventDate, input.city, input.state, input.zip, input.eventType, criteria.rideType, criteria.rideClass, criteria.listingId, input.attendance, input.budgetUsd === null ? null : input.budgetUsd * 100, geo.lat, geo.lng, JSON.stringify(match.operators), match.contactableCount, product.id, sellable ? "matched" : "insufficient", input.sourcePath, t],
  );
  const event = (await getEventRequest(db, id))!;
  if (!sellable) {
    // The request is already saved; alternatives are a best effort and never block it.
    try {
      await offerFallbacks(db, event, source, cache);
    } catch (e) {
      console.error("[access] fallback offers failed:", (e as Error).message);
    }
  }
  return { event, product, sellable };
}

// ------------------------------------------------------------------------------ 1b. zero-match fallbacks and funnel (fallback.ts)
export type FunnelEventName = "zero_exact_match" | "fallback_match_shown" | "fallback_match_clicked" | "manual_search_requested";

async function recordFunnel(db: Sql, e: { name: FunnelEventName; eventRequestId: string; resultEventRequestId?: string | null; requestedRideType: string | null; requestedRideClass: string | null; offer?: FallbackOffer | null; detail?: unknown }): Promise<void> {
  await db.query(
    `INSERT INTO access_funnel_events (id, name, event_request_id, result_event_request_id, requested_ride_type, requested_ride_class, fallback_kind, fallback_ride_type, radius_miles, detail_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), e.name, e.eventRequestId, e.resultEventRequestId ?? null, e.requestedRideType, e.requestedRideClass, e.offer?.kind ?? null, e.offer?.rideType ?? null, e.offer?.radiusMiles ?? null, e.detail === undefined ? null : JSON.stringify(e.detail), nowIso()],
  );
}

/** The exact search can't be sold: record it, then compute and record the viable alternatives (if any). */
async function offerFallbacks(db: AccessDb, event: EventRequest, source: OperatorSource, cache: ContactStatusCache): Promise<FallbackOffer[]> {
  const requested = { requestedRideType: event.rideType, requestedRideClass: event.rideClass };
  await recordFunnel(db, { name: "zero_exact_match", eventRequestId: event.id, ...requested, detail: { exactOperators: event.matchedOperators } });
  const offers = await computeFallbacks({ lat: event.lat, lng: event.lng, state: event.state, rideType: event.rideType, rideClass: event.rideClass }, source, cache, async (tier) => (await productForTier(db, tier))?.minimumMatches ?? null);
  if (offers.length) await recordFunnel(db, { name: "fallback_match_shown", eventRequestId: event.id, ...requested, detail: { offers } });
  return offers;
}

/**
 * Requests saved before the fallback chain existed (2026-10-14) get their alternatives on first view.
 * Runs once per request: the zero_exact_match row marks it done. Best effort, like at creation.
 */
export async function ensureFallbacks(db: AccessDb, source: OperatorSource, event: EventRequest, cache?: ContactStatusCache): Promise<void> {
  if (event.status !== "insufficient") return;
  if ((await db.query(`SELECT id FROM access_funnel_events WHERE event_request_id = ? AND name = 'zero_exact_match'`, [event.id])).length) return;
  try {
    await offerFallbacks(db, event, source, cache ?? dbContactCache(db));
  } catch (e) {
    console.error("[access] fallback offers failed:", (e as Error).message);
  }
}

export interface FallbackView {
  /** Alternatives offered for this (unsellable) request, best first. */
  offers: FallbackOffer[];
  manualRequested: boolean;
  /** Set when this request is itself an alternative the customer picked: what they originally asked for. */
  origin: { eventRequestId: string; offer: FallbackOffer; requestedRideType: string | null; requestedRideClass: string | null } | null;
}

export async function fallbackView(db: Sql, eventId: string): Promise<FallbackView> {
  const rows = await db.query(`SELECT * FROM access_funnel_events WHERE event_request_id = ? OR result_event_request_id = ? ORDER BY created_at`, [eventId, eventId]);
  const shown = rows.find((r) => r.name === "fallback_match_shown" && r.event_request_id === eventId);
  const clicked = rows.find((r) => r.name === "fallback_match_clicked" && r.result_event_request_id === eventId);
  return {
    offers: shown?.detail_json ? ((JSON.parse(String(shown.detail_json)) as { offers?: FallbackOffer[] }).offers ?? []) : [],
    manualRequested: rows.some((r) => r.name === "manual_search_requested" && r.event_request_id === eventId),
    origin: clicked
      ? { eventRequestId: String(clicked.event_request_id), offer: JSON.parse(String(clicked.detail_json)) as FallbackOffer, requestedRideType: clicked.requested_ride_type ? String(clicked.requested_ride_type) : null, requestedRideClass: clicked.requested_ride_class ? String(clicked.requested_ride_class) : null }
      : null,
  };
}

/**
 * The customer picks one of the offered alternatives (by its position in the offers shown for that
 * request). The offer is re-matched now, so contactability is current, and saved as a new event
 * request with the offer's own ride requirement: its tier and price come from that requirement
 * (quoteForEvent), exactly as for a request typed into the form. Picking the same offer again reopens
 * the request it already created.
 */
export async function createAlternativeRequest(db: AccessDb, source: OperatorSource, eventId: string, offerIndex: number, opts: { cache?: ContactStatusCache } = {}): Promise<{ event: EventRequest; reused: boolean }> {
  const original = await getEventRequest(db, eventId);
  if (!original) throw new AccessError("not_found", "Unknown event request");
  const offer = (await fallbackView(db, eventId)).offers[offerIndex];
  if (!offer) throw new AccessError("invalid", "That alternative isn't available for this request");
  const prior = (await db.query(`SELECT * FROM access_funnel_events WHERE event_request_id = ? AND name = 'fallback_match_clicked'`, [eventId])).find((r) => r.detail_json && sameOffer(JSON.parse(String(r.detail_json)) as FallbackOffer, offer));
  if (prior?.result_event_request_id) {
    const existing = await getEventRequest(db, String(prior.result_event_request_id));
    if (existing) return { event: existing, reused: true };
  }
  const product = await productForTier(db, offer.tier);
  if (!product) throw tierUnavailable(offer.tier);
  const m = await matchForSpec({ lat: original.lat, lng: original.lng, state: original.state, rideType: original.rideType, rideClass: original.rideClass }, specForOffer(offer), source, opts.cache ?? dbContactCache(db));
  if (m.criteria.tier !== offer.tier || m.criteria.rideType !== offer.rideType) throw new Error("fallback matching and pricing resolved different criteria");
  if (m.contactableCount < product.minimumMatches) throw new AccessError("not_sellable", "That alternative no longer has enough contactable operators");
  const id = crypto.randomUUID();
  const sourcePath = (await db.query(`SELECT source_path FROM access_event_requests WHERE id = ?`, [original.id]))[0]?.source_path ?? null;
  await db.transaction(async (tx) => {
    await tx.query(
      `INSERT INTO access_event_requests (id, email, event_date, city, state, zip, event_type, ride_type, ride_class, listing_id, attendance, budget_cents, lat, lng, match_json, matched_operators, product_id, status, source_path, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, 'matched', ?, ?)`,
      [id, original.email, original.eventDate, original.city, original.state, original.zip, original.eventType, m.criteria.rideType, m.criteria.rideClass, original.attendance, original.budgetCents, original.lat, original.lng, JSON.stringify(m.operators), m.contactableCount, product.id, sourcePath, nowIso()],
    );
    await recordFunnel(tx, { name: "fallback_match_clicked", eventRequestId: original.id, resultEventRequestId: id, requestedRideType: original.rideType, requestedRideClass: original.rideClass, offer, detail: { ...offer, operators: m.contactableCount, nearestMiles: Math.min(...m.operators.map((o) => o.miles)) } });
  });
  return { event: (await getEventRequest(db, id))!, reused: false };
}

/**
 * The customer asks us to search by hand (free). Recorded once per request; the team is emailed the
 * event details (the customer's own request, never operator data). The email is best effort: the
 * ledger row is the record the team works from.
 */
export async function requestManualSearch(db: AccessDb, eventId: string, opts: { send?: typeof sendNow } = {}): Promise<{ created: boolean }> {
  const event = await getEventRequest(db, eventId);
  if (!event) throw new AccessError("not_found", "Unknown event request");
  const view = await fallbackView(db, eventId);
  if (view.manualRequested) return { created: false };
  await recordFunnel(db, { name: "manual_search_requested", eventRequestId: event.id, requestedRideType: event.rideType, requestedRideClass: event.rideClass, detail: { exactOperators: event.matchedOperators, offersShown: view.offers.length } });
  const content = manualSearchEmail({ ride: requirementNoun(event.rideType, event.rideClass), city: event.city, state: event.state, zip: event.zip, eventDate: event.eventDate, eventType: event.eventType, attendance: event.attendance, budgetCents: event.budgetCents, customerEmail: event.email, requestId: event.id, exactOperators: event.matchedOperators, offersShown: view.offers.length });
  await (opts.send ?? sendNow)(`support@${BRAND.domain}`, content, `manual-search:${event.id}`);
  return { created: true };
}

export interface Quote {
  tier: AccessTier;
  /** The active product for the request's tier, or null when that tier is not for sale (no fallback to another tier). */
  product: AccessProduct | null;
  /** True when the request was stored against a different product (e.g. a Ferris request quoted before the Ferris tier existed). */
  requoted: boolean;
  sellable: boolean;
}

/**
 * The live quote for a stored request: the tier comes from the persisted, resolved ride requirement
 * and the product from the database, never from the stored product id alone. The amount shown on the
 * matches page and the amount charged at checkout both come from here.
 */
export async function quoteForEvent(db: AccessDb, event: EventRequest): Promise<Quote> {
  const product = await productForTier(db, event.tier);
  return { tier: event.tier, product, requoted: !!product && product.id !== event.productId, sellable: !!product && event.status === "matched" && event.matchedOperators >= product.minimumMatches };
}

export async function getEventRequest(db: AccessDb, id: string): Promise<EventRequest | null> {
  const rows = await db.query(`SELECT * FROM access_event_requests WHERE id = ?`, [id]);
  return rows[0] ? rowToEvent(rows[0]) : null;
}

// ------------------------------------------------------------------------------ 2. checkout
export interface Purchase {
  id: string;
  eventRequestId: string;
  productId: string;
  email: string;
  unlockLimit: number;
  validityDays: number;
  amountCents: number;
  currency: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  status: "pending" | "paid" | "failed" | "expired" | "refunded" | "partially_refunded" | "disputed";
  refundCents: number;
  paidAt: string | null;
  createdAt: string;
}
const rowToPurchase = (r: Row): Purchase => ({
  id: String(r.id),
  eventRequestId: String(r.event_request_id),
  productId: String(r.product_id),
  email: String(r.email),
  unlockLimit: Number(r.unlock_limit),
  validityDays: Number(r.validity_days),
  amountCents: Number(r.amount_cents),
  currency: String(r.currency),
  stripeCheckoutSessionId: r.stripe_checkout_session_id ? String(r.stripe_checkout_session_id) : null,
  stripePaymentIntentId: r.stripe_payment_intent_id ? String(r.stripe_payment_intent_id) : null,
  status: r.status as Purchase["status"],
  refundCents: Number(r.refund_cents ?? 0),
  paidAt: r.paid_at ? String(r.paid_at) : null,
  createdAt: String(r.created_at),
});

/**
 * A purchase paid through a Stripe TEST-mode session (QA) is never a valid entitlement on a site
 * running live keys: test passes stay in the ledger (audit) but cannot view or unlock contacts there.
 */
export function purchaseValidHere(p: Pick<Purchase, "stripeCheckoutSessionId">, env: Record<string, string | undefined> = process.env): boolean {
  const m = stripeMode(env);
  return !(m.kind === "real" && m.live && (p.stripeCheckoutSessionId ?? "").startsWith("cs_test_"));
}

export async function getPurchase(db: Sql, id: string): Promise<Purchase | null> {
  const rows = await db.query(`SELECT * FROM access_purchases WHERE id = ?`, [id]);
  return rows[0] ? rowToPurchase(rows[0]) : null;
}

/**
 * Step 2. Creates the pending purchase (server-side price) and the Stripe Checkout Session. The
 * product is re-derived from the stored request's resolved criteria (quoteForEvent), so a request
 * can only ever be charged at its own tier: a Ferris request is never sold at the standard price and
 * a standard request is never upgraded by anything the client posts. Older unpaid quotes for the
 * same request at a different product or amount are expired (ledger and Stripe) and the request is
 * requoted at the current terms, which the matches page shows before this step.
 */
export async function createCheckout(db: AccessDb, gateway: StripeGateway, eventRequestId: string, siteUrl: string): Promise<{ purchase: Purchase; url: string }> {
  const event = await getEventRequest(db, eventRequestId);
  if (!event) throw new AccessError("not_found", "Unknown event request");
  const quote = await quoteForEvent(db, event);
  const product = quote.product;
  if (!product) throw tierUnavailable(quote.tier);
  if (!quote.sellable) throw new AccessError("not_sellable", "Not enough contactable operators for this event");
  const id = crypto.randomUUID();
  const t = nowIso();
  const stale = (await db.query(`SELECT * FROM access_purchases WHERE event_request_id = ? AND status = 'pending'`, [event.id])).map(rowToPurchase);
  for (const old of stale) {
    if (old.productId === product.id && old.amountCents === product.priceCents && old.currency === product.currency) continue;
    // A session the customer already paid is never voided: the webhook/return path activates it at the terms it was bought at.
    const outcome = old.stripeCheckoutSessionId ? await gateway.expireCheckoutSession(old.stripeCheckoutSessionId) : "expired";
    if (outcome === "complete") continue;
    await db.query(`UPDATE access_purchases SET status = 'expired', updated_at = ? WHERE id = ? AND status = 'pending'`, [t, old.id]);
  }
  if (quote.requoted) await db.query(`UPDATE access_event_requests SET product_id = ? WHERE id = ?`, [product.id, event.id]);
  await db.query(
    `INSERT INTO access_purchases (id, event_request_id, product_id, email, unlock_limit, validity_days, amount_cents, currency, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    [id, event.id, product.id, event.email, product.unlockLimit, product.validityDays, product.priceCents, product.currency, t, t],
  );
  const session = await gateway.createCheckoutSession({
    purchaseId: id,
    email: event.email,
    amountCents: product.priceCents,
    currency: product.currency,
    productName: product.name,
    productDescription: `${product.description} Unlock up to ${product.unlockLimit} operators within ${product.validityDays} days. ${event.city}, ${event.state}, ${event.eventDate}.`,
    successUrl: `${siteUrl}/api/access/return?p=${id}&cs={CHECKOUT_SESSION_ID}`,
    cancelUrl: event.sourcePath === CONCIERGE_SOURCE_PATH && conciergeEnabled() ? `${siteUrl}/concierge?cancelled=1` : `${siteUrl}/connect/${event.id}?cancelled=1`,
  });
  await db.query(`UPDATE access_purchases SET stripe_checkout_session_id = ?, updated_at = ? WHERE id = ?`, [session.id, nowIso(), id]);
  await recordLifecycleEvent(db, "checkout_started", sourceOfPath(event.sourcePath), { eventRequestId: event.id, purchaseId: id });
  return { purchase: (await getPurchase(db, id))!, url: session.url };
}

// ------------------------------------------------------------------------------ 3. activation (webhook or verified session)
export interface Pass {
  id: string;
  purchaseId: string;
  eventRequestId: string;
  email: string;
  unlockLimit: number;
  unlockedCount: number;
  status: "active" | "revoked" | "expired";
  expiresAt: string;
  createdAt: string;
}
const rowToPass = (r: Row): Pass => ({
  id: String(r.id),
  purchaseId: String(r.purchase_id),
  eventRequestId: String(r.event_request_id),
  email: String(r.email),
  unlockLimit: Number(r.unlock_limit),
  unlockedCount: Number(r.unlocked_count),
  status: r.status as Pass["status"],
  expiresAt: String(r.expires_at),
  createdAt: String(r.created_at),
});

/**
 * Marks a purchase paid and creates its pass, exactly once. Safe to call from the webhook and from
 * the return URL handler: the status guard makes the second call a no-op.
 */
export async function activatePurchase(db: AccessDb, purchaseId: string, verified: { sessionId: string | null; paymentIntentId: string | null }, opts: { siteUrl: string; sendEmail?: boolean; now?: () => Date } = { siteUrl: "" }): Promise<{ pass: Pass; created: boolean }> {
  const now = (opts.now ?? (() => new Date()))();
  const result = await db.transaction(async (tx) => {
    const p = await getPurchase(tx, purchaseId);
    if (!p) throw new AccessError("not_found", "Unknown purchase");
    const existing = await tx.query(`SELECT * FROM access_passes WHERE purchase_id = ?`, [purchaseId]);
    if (existing[0]) return { pass: rowToPass(existing[0]), created: false, purchase: p };
    // 'expired' is included on purpose: a session Stripe verifies as paid always yields a pass, even if
    // the ledger had written the quote off (expiry webhook raced the payment, or a requote crossed it).
    if (p.status !== "pending" && p.status !== "expired") throw new AccessError("forbidden", `purchase is ${p.status}`);
    const t = now.toISOString();
    const updated = await tx.query(
      `UPDATE access_purchases SET status = 'paid', paid_at = ?, updated_at = ?, stripe_checkout_session_id = COALESCE(stripe_checkout_session_id, ?), stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id) WHERE id = ? AND status IN ('pending', 'expired') RETURNING id`,
      [t, t, verified.sessionId, verified.paymentIntentId, purchaseId],
    );
    if (updated.length === 0) throw new AccessError("forbidden", "purchase already processed");
    const id = crypto.randomUUID();
    const expires = new Date(now.getTime() + p.validityDays * 864e5).toISOString();
    await tx.query(`INSERT INTO access_passes (id, purchase_id, event_request_id, email, unlock_limit, unlocked_count, status, expires_at, created_at) VALUES (?, ?, ?, ?, ?, 0, 'active', ?, ?)`, [id, p.id, p.eventRequestId, p.email, p.unlockLimit, expires, t]);
    const rows = await tx.query(`SELECT * FROM access_passes WHERE id = ?`, [id]);
    return { pass: rowToPass(rows[0]), created: true, purchase: p };
  });
  if (result.created) {
    // After the commit, best effort: the lifecycle engine itself stops sales email on the paid purchase.
    const origin = await getEventRequest(db, result.pass.eventRequestId);
    await recordLifecycleEvent(db, "event_access_purchased", sourceOfPath(origin?.sourcePath), { eventRequestId: result.pass.eventRequestId, purchaseId: result.purchase.id, passId: result.pass.id });
  }
  if (result.created && opts.sendEmail !== false) {
    const event = await getEventRequest(db, result.pass.eventRequestId);
    const product = (await db.query(`SELECT * FROM access_products WHERE id = ?`, [result.purchase.productId])).map(rowToProduct)[0];
    const link = await issueMagicLink(db, result.pass.id);
    await sendNow(
      result.pass.email,
      passEmail({ passUrl: `${opts.siteUrl}/pass/open?t=${link.token}`, productName: product?.name ?? "Event Access", amountLabel: formatPrice(result.purchase.amountCents, result.purchase.currency), unlockLimit: result.pass.unlockLimit, matched: event?.matchedOperators ?? 0, expiresOn: result.pass.expiresAt.slice(0, 10), eventSummary: event ? `${event.city}, ${event.state} on ${event.eventDate}` : "" }),
      `pass:${result.pass.id}:welcome`,
    );
  }
  return { pass: result.pass, created: result.created };
}

/** Return-URL handler path: trust only what Stripe's API says about the session. */
export async function activateFromSession(db: AccessDb, gateway: StripeGateway, purchaseId: string, sessionId: string, siteUrl: string): Promise<{ state: "paid"; pass: Pass } | { state: "pending" | "expired" | "mismatch" }> {
  const session = await gateway.retrieveCheckoutSession(sessionId);
  if (!session) return { state: "pending" };
  const purchase = await getPurchase(db, purchaseId);
  if (!purchase || session.purchaseId !== purchaseId || (purchase.stripeCheckoutSessionId && purchase.stripeCheckoutSessionId !== session.id)) return { state: "mismatch" };
  if (session.paymentStatus === "paid") {
    const { pass } = await activatePurchase(db, purchaseId, { sessionId: session.id, paymentIntentId: session.paymentIntentId }, { siteUrl });
    return { state: "paid", pass };
  }
  if (session.status === "expired") {
    await db.query(`UPDATE access_purchases SET status = 'expired', updated_at = ? WHERE id = ? AND status = 'pending'`, [nowIso(), purchaseId]);
    return { state: "expired" };
  }
  return { state: "pending" };
}

/** Webhook: idempotent on the Stripe event id. Returns what happened, for logging. */
export async function handleStripeEvent(db: AccessDb, event: StripeEvent, siteUrl: string): Promise<string> {
  const t = nowIso();
  const inserted = await db.query(`INSERT INTO access_stripe_events (stripe_event_id, type, received_at) VALUES (?, ?, ?) ON CONFLICT (stripe_event_id) DO NOTHING RETURNING stripe_event_id`, [event.id, event.type, t]);
  if (inserted.length === 0) return "duplicate";
  const o = event.data.object;
  const purchaseIdOf = async (): Promise<string | null> => {
    if (typeof o.client_reference_id === "string") return o.client_reference_id;
    const meta = o.metadata as Record<string, unknown> | undefined;
    if (meta && typeof meta.purchase_id === "string") return meta.purchase_id;
    const pi = typeof o.payment_intent === "string" ? o.payment_intent : typeof o.id === "string" && o.object === "payment_intent" ? o.id : null;
    if (pi) {
      const r = await db.query(`SELECT id FROM access_purchases WHERE stripe_payment_intent_id = ?`, [pi]);
      if (r[0]) return String(r[0].id);
    }
    if (typeof o.id === "string" && o.object === "checkout.session") {
      const r = await db.query(`SELECT id FROM access_purchases WHERE stripe_checkout_session_id = ?`, [o.id]);
      if (r[0]) return String(r[0].id);
    }
    return null;
  };
  let result = "ignored";
  try {
    const purchaseId = await purchaseIdOf();
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        if (!purchaseId) { result = "no purchase"; break; }
        const s: CheckoutSession = { id: String(o.id), url: null, paymentStatus: (o.payment_status as CheckoutSession["paymentStatus"]) ?? "unpaid", status: (o.status as CheckoutSession["status"]) ?? "open", paymentIntentId: typeof o.payment_intent === "string" ? o.payment_intent : null, purchaseId, amountTotal: null, currency: null };
        if (s.paymentStatus !== "paid") { result = "not paid yet"; break; }
        const { created } = await activatePurchase(db, purchaseId, { sessionId: s.id, paymentIntentId: s.paymentIntentId }, { siteUrl });
        result = created ? "pass created" : "already active";
        break;
      }
      case "checkout.session.async_payment_failed":
      case "checkout.session.expired": {
        if (!purchaseId) { result = "no purchase"; break; }
        const status = event.type.endsWith("expired") ? "expired" : "failed";
        await db.query(`UPDATE access_purchases SET status = ?, updated_at = ? WHERE id = ? AND status = 'pending'`, [status, t, purchaseId]);
        result = status;
        break;
      }
      case "charge.refunded": {
        if (!purchaseId) { result = "no purchase"; break; }
        const refunded = typeof o.amount_refunded === "number" ? o.amount_refunded : 0;
        // "Full" is judged against what this purchase actually cost (the ledger's snapshot), so a $99
        // refund on a $199 Ferris pass is partial and a $199 one revokes it.
        const purchase = await getPurchase(db, purchaseId);
        const amount = purchase?.amountCents ?? (typeof o.amount === "number" ? o.amount : 0);
        const full = amount > 0 && refunded >= amount;
        await db.query(`UPDATE access_purchases SET status = ?, refund_cents = ?, refunded_at = ?, updated_at = ? WHERE id = ?`, [full ? "refunded" : "partially_refunded", refunded, t, t, purchaseId]);
        if (full) await revokePass(db, purchaseId, "refunded");
        result = full ? "refunded, pass revoked" : "partial refund";
        break;
      }
      case "charge.dispute.created": {
        if (!purchaseId) { result = "no purchase"; break; }
        await db.query(`UPDATE access_purchases SET status = 'disputed', updated_at = ? WHERE id = ?`, [t, purchaseId]);
        await revokePass(db, purchaseId, "disputed");
        result = "disputed, pass revoked";
        break;
      }
      default:
        result = "ignored";
    }
    await db.query(`UPDATE access_stripe_events SET processed_at = ?, result = ?, purchase_id = ? WHERE stripe_event_id = ?`, [nowIso(), result, purchaseId, event.id]);
    return result;
  } catch (e) {
    await db.query(`UPDATE access_stripe_events SET processed_at = ?, result = ? WHERE stripe_event_id = ?`, [nowIso(), `error: ${(e as Error).message}`.slice(0, 300), event.id]);
    throw e;
  }
}

export async function revokePass(db: AccessDb, purchaseId: string, reason: string): Promise<void> {
  await db.query(`UPDATE access_passes SET status = 'revoked', revoked_at = ?, revoke_reason = ? WHERE purchase_id = ? AND status = 'active'`, [nowIso(), reason, purchaseId]);
}

// ------------------------------------------------------------------------------ 4. pass access
export async function getPass(db: Sql, id: string): Promise<Pass | null> {
  const rows = await db.query(`SELECT * FROM access_passes WHERE id = ?`, [id]);
  return rows[0] ? rowToPass(rows[0]) : null;
}

export async function issueMagicLink(db: AccessDb, passId: string, ttlDays = 14): Promise<{ token: string }> {
  const token = newToken();
  const t = new Date();
  await db.query(`INSERT INTO access_magic_links (token_hash, pass_id, expires_at, created_at) VALUES (?, ?, ?, ?)`, [hashToken(token), passId, new Date(t.getTime() + ttlDays * 864e5).toISOString(), t.toISOString()]);
  return { token };
}

export async function redeemMagicLink(db: AccessDb, token: string): Promise<string | null> {
  const rows = await db.query(`SELECT * FROM access_magic_links WHERE token_hash = ?`, [hashToken(token)]);
  const r = rows[0];
  if (!r || String(r.expires_at) < nowIso()) return null;
  await db.query(`UPDATE access_magic_links SET last_used_at = ? WHERE token_hash = ?`, [nowIso(), String(r.token_hash)]);
  return String(r.pass_id);
}

/** "Lost my link": one email with a fresh link per active pass; silent when there is none. */
export async function sendRecoveryLinks(db: AccessDb, email: string, siteUrl: string): Promise<number> {
  const rows = await db.query(`SELECT p.*, pr.name AS product_name FROM access_passes p JOIN access_purchases pu ON pu.id = p.purchase_id JOIN access_products pr ON pr.id = pu.product_id WHERE p.email = ? AND p.status = 'active' ORDER BY p.created_at DESC LIMIT 5`, [email.trim().toLowerCase()]);
  for (const r of rows) {
    const { token } = await issueMagicLink(db, String(r.id));
    await sendNow(String(r.email), magicLinkEmail({ passUrl: `${siteUrl}/pass/open?t=${token}`, productName: String(r.product_name) }), `pass:${String(r.id)}:recover:${hashToken(token).slice(0, 12)}`);
  }
  return rows.length;
}

export interface Unlock {
  operatorId: string;
  firstRevealedAt: string;
  contact: ReturnType<typeof revealFields>;
  reportedDeadAt: string | null;
}
const rowToUnlock = (r: Row): Unlock => ({ operatorId: String(r.sharetribe_operator_id), firstRevealedAt: String(r.first_revealed_at), contact: JSON.parse(String(r.contact_snapshot)), reportedDeadAt: r.reported_dead_at ? String(r.reported_dead_at) : null });

export interface PassView {
  pass: Pass;
  event: EventRequest;
  product: AccessProduct;
  /** The terms this pass was bought at (amount, limit, validity), snapshotted at purchase time. */
  purchase: Purchase;
  unlocks: Unlock[];
  remaining: number;
  usable: boolean;
  blockedReason: string | null;
}

export async function passView(db: AccessDb, passId: string, now = new Date()): Promise<PassView | null> {
  const pass = await getPass(db, passId);
  if (!pass) return null;
  const event = await getEventRequest(db, pass.eventRequestId);
  const purchase = await getPurchase(db, pass.purchaseId);
  const product = (await db.query(`SELECT * FROM access_products WHERE id = ?`, [purchase?.productId ?? ""])).map(rowToProduct)[0];
  if (!event || !purchase || !product) return null;
  const unlocks = (await db.query(`SELECT * FROM access_unlocks WHERE pass_id = ? ORDER BY first_revealed_at`, [passId])).map(rowToUnlock);
  const expired = pass.expiresAt <= now.toISOString();
  if (!purchaseValidHere(purchase)) return null; // test-mode QA pass on a live-keyed site: not an entitlement
  const blockedReason = pass.status === "revoked" ? "This pass was revoked (refund or dispute). Operators you already unlocked stay visible." : expired ? "This pass has expired. Operators you already unlocked stay visible." : null;
  return { pass, event, product, purchase, unlocks, remaining: Math.max(0, pass.unlockLimit - pass.unlockedCount), usable: pass.status === "active" && !expired, blockedReason };
}

/**
 * Reveal one operator. Order of checks: pass exists → already unlocked (free) → active, not expired
 * → operator is in this pass's match set → counter under limit (guarded UPDATE) → fetch contact
 * server-side → write the immutable snapshot. Concurrency: the UPDATE serialises; a unique-conflict
 * on insert (two requests for the same operator) rolls back the increment and is retried as a re-read.
 */
export async function unlockOperator(db: AccessDb, source: OperatorSource, passId: string, operatorId: string, meta: { ipHash: string | null; userAgent: string | null }, now = new Date()): Promise<{ unlock: Unlock; consumed: boolean }> {
  const attempt = async (): Promise<{ unlock: Unlock; consumed: boolean }> => {
    const pass = await getPass(db, passId);
    if (!pass) throw new AccessError("not_found", "Unknown pass");
    const purchase = await getPurchase(db, pass.purchaseId);
    if (!purchase || !purchaseValidHere(purchase)) throw new AccessError("not_found", "Unknown pass");
    const pre = await db.query(`SELECT * FROM access_unlocks WHERE pass_id = ? AND sharetribe_operator_id = ?`, [passId, operatorId]);
    if (pre[0]) return { unlock: rowToUnlock(pre[0]), consumed: false };
    if (pass.status === "revoked") throw new AccessError("revoked", "This pass was revoked");
    if (pass.status === "expired" || pass.expiresAt <= now.toISOString()) throw new AccessError("expired", "This pass has expired");
    const event = await getEventRequest(db, pass.eventRequestId);
    const matched = event?.operators.find((o) => o.operatorId === operatorId);
    if (!matched) throw new AccessError("forbidden", "That operator isn't part of this pass");
    if (pass.unlockedCount >= pass.unlockLimit) throw new AccessError("limit", "You've used every unlock on this pass");
    // Contact is fetched before the transaction (network), written inside it (atomic with the counter).
    const contact = await source.contact(operatorId);
    if (!contact || !isContactable({ hasPhone: !!contact.phone, hasEmail: !!contact.email, hasWebsite: !!contact.website, claimed: contact.claimed })) throw new AccessError("not_found", "This operator has no usable contact details right now; it hasn't used an unlock");
    const snapshot = JSON.stringify(revealFields(contact));
    return db.transaction(async (tx) => {
      const bumped = await tx.query(`UPDATE access_passes SET unlocked_count = unlocked_count + 1 WHERE id = ? AND status = 'active' AND unlocked_count < unlock_limit AND expires_at > ? RETURNING unlocked_count`, [passId, now.toISOString()]);
      if (bumped.length === 0) throw new AccessError("limit", "You've used every unlock on this pass");
      const t = now.toISOString();
      const ins = await tx.query(`INSERT INTO access_unlocks (id, pass_id, sharetribe_operator_id, first_revealed_at, contact_snapshot, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (pass_id, sharetribe_operator_id) DO NOTHING RETURNING id`, [crypto.randomUUID(), passId, operatorId, t, snapshot, meta.ipHash, meta.userAgent?.slice(0, 200) ?? null]);
      if (ins.length === 0) throw new RaceRetry();
      return { unlock: { operatorId, firstRevealedAt: t, contact: JSON.parse(snapshot), reportedDeadAt: null }, consumed: true };
    });
  };
  let result: { unlock: Unlock; consumed: boolean };
  try {
    result = await attempt();
  } catch (e) {
    if (e instanceof RaceRetry || /unique|constraint/i.test(String((e as Error).message))) result = await attempt();
    else throw e;
  }
  if (result.consumed) {
    // After the commit, best effort: never part of the unlock transaction.
    const pass = await getPass(db, passId);
    const event = pass ? await getEventRequest(db, pass.eventRequestId) : null;
    await recordLifecycleEvent(db, "operator_unlocked", sourceOfPath(event?.sourcePath), { eventRequestId: pass?.eventRequestId ?? null, passId });
  }
  return result;
}
class RaceRetry extends Error {}

/** Customer reports a dead contact: flag for review; the audit stays. Credit restoration is a team action. */
export async function reportDeadContact(db: AccessDb, passId: string, operatorId: string): Promise<boolean> {
  const r = await db.query(`UPDATE access_unlocks SET reported_dead_at = COALESCE(reported_dead_at, ?) WHERE pass_id = ? AND sharetribe_operator_id = ? RETURNING id`, [nowIso(), passId, operatorId]);
  return r.length > 0;
}

/** Team action: give back one unlock after a confirmed dead contact (once per unlock). */
export async function restoreUnlockCredit(db: AccessDb, passId: string, operatorId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const r = await tx.query(`UPDATE access_unlocks SET credit_restored_at = ? WHERE pass_id = ? AND sharetribe_operator_id = ? AND reported_dead_at IS NOT NULL AND credit_restored_at IS NULL RETURNING id`, [nowIso(), passId, operatorId]);
    if (r.length === 0) return false;
    await tx.query(`UPDATE access_passes SET unlocked_count = unlocked_count - 1 WHERE id = ? AND unlocked_count > 0`, [passId]);
    return true;
  });
}

export const priceLabel = (p: AccessProduct) => formatPrice(p.priceCents, p.currency);
