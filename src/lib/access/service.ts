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
import { activeProduct, formatPrice, type AccessProduct, rowToProduct } from "./config";
import { isContactable, revealFields, type OperatorSource, type ContactChannels } from "./contacts";
import type { AccessDb, Row, Sql } from "./db";
import { nowIso } from "./db";
import { magicLinkEmail, passEmail, sendNow } from "./email";
import { geocode, matchOperators, type ContactStatusCache, type MatchedOperator } from "./matching";
import { hashToken, newToken } from "./session";
import type { CheckoutSession, StripeEvent, StripeGateway } from "./stripe";

// ------------------------------------------------------------------------------ input
const STATE_CODES = new Set(US_STATES.map((s) => s.abbr.toUpperCase()));
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
  attendance: z.coerce.number().int().min(0).max(1_000_000).optional().or(z.literal("")).transform((v) => (v === "" || v === undefined ? null : v)),
  budgetUsd: z.coerce.number().int().min(0).max(10_000_000).optional().or(z.literal("")).transform((v) => (v === "" || v === undefined ? null : v)),
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
  productId: string;
  status: "matched" | "insufficient";
  createdAt: string;
}
const rowToEvent = (r: Row): EventRequest => ({
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

export async function startEventRequest(db: AccessDb, source: OperatorSource, raw: unknown, opts: { cache?: ContactStatusCache; today?: () => string } = {}): Promise<{ event: EventRequest; product: AccessProduct; sellable: boolean }> {
  const parsed = eventRequestInput.safeParse(raw);
  if (!parsed.success) throw new AccessError("invalid", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  const input = parsed.data;
  const today = (opts.today ?? (() => new Date().toISOString().slice(0, 10)))();
  if (input.eventDate < today) throw new AccessError("invalid", "eventDate: pick a date from today onwards");
  const product = await activeProduct(db);
  if (!product) throw new AccessError("unavailable", "Event Access is not configured");
  const geo = geocode(input.city, input.state);
  if (!geo) throw new AccessError("geocode", "We couldn't place that city");
  const match = await matchOperators({ lat: geo.lat, lng: geo.lng, state: input.state, listingId: input.listingId, rideType: input.rideType, rideClass: input.rideClass }, source, opts.cache ?? dbContactCache(db));
  const sellable = match.contactableCount >= product.minimumMatches;
  const id = crypto.randomUUID();
  const t = nowIso();
  await db.query(
    `INSERT INTO access_event_requests (id, email, event_date, city, state, zip, event_type, ride_type, ride_class, listing_id, attendance, budget_cents, lat, lng, match_json, matched_operators, product_id, status, source_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.email, input.eventDate, input.city, input.state, input.zip, input.eventType, match.criteria.rideType ?? input.rideType, match.criteria.rideClass ?? input.rideClass, input.listingId, input.attendance, input.budgetUsd === null ? null : input.budgetUsd * 100, geo.lat, geo.lng, JSON.stringify(match.operators), match.contactableCount, product.id, sellable ? "matched" : "insufficient", input.sourcePath, t],
  );
  const event = (await getEventRequest(db, id))!;
  return { event, product, sellable };
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

export async function getPurchase(db: Sql, id: string): Promise<Purchase | null> {
  const rows = await db.query(`SELECT * FROM access_purchases WHERE id = ?`, [id]);
  return rows[0] ? rowToPurchase(rows[0]) : null;
}

/** Creates the pending purchase (server-side price) and the Stripe Checkout Session. */
export async function createCheckout(db: AccessDb, gateway: StripeGateway, eventRequestId: string, siteUrl: string): Promise<{ purchase: Purchase; url: string }> {
  const event = await getEventRequest(db, eventRequestId);
  if (!event) throw new AccessError("not_found", "Unknown event request");
  const prodRows = await db.query(`SELECT * FROM access_products WHERE id = ?`, [event.productId]);
  const product = prodRows[0] ? rowToProduct(prodRows[0]) : null;
  if (!product || !product.active) throw new AccessError("unavailable", "Event Access is not available");
  if (event.status !== "matched" || event.matchedOperators < product.minimumMatches) throw new AccessError("not_sellable", "Not enough contactable operators for this event");
  const id = crypto.randomUUID();
  const t = nowIso();
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
    cancelUrl: `${siteUrl}/connect/${event.id}?cancelled=1`,
  });
  await db.query(`UPDATE access_purchases SET stripe_checkout_session_id = ?, updated_at = ? WHERE id = ?`, [session.id, nowIso(), id]);
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
    if (p.status !== "pending") throw new AccessError("forbidden", `purchase is ${p.status}`);
    const t = now.toISOString();
    const updated = await tx.query(
      `UPDATE access_purchases SET status = 'paid', paid_at = ?, updated_at = ?, stripe_checkout_session_id = COALESCE(stripe_checkout_session_id, ?), stripe_payment_intent_id = COALESCE(?, stripe_payment_intent_id) WHERE id = ? AND status = 'pending' RETURNING id`,
      [t, t, verified.sessionId, verified.paymentIntentId, purchaseId],
    );
    if (updated.length === 0) throw new AccessError("forbidden", "purchase already processed");
    const id = crypto.randomUUID();
    const expires = new Date(now.getTime() + p.validityDays * 864e5).toISOString();
    await tx.query(`INSERT INTO access_passes (id, purchase_id, event_request_id, email, unlock_limit, unlocked_count, status, expires_at, created_at) VALUES (?, ?, ?, ?, ?, 0, 'active', ?, ?)`, [id, p.id, p.eventRequestId, p.email, p.unlockLimit, expires, t]);
    const rows = await tx.query(`SELECT * FROM access_passes WHERE id = ?`, [id]);
    return { pass: rowToPass(rows[0]), created: true, purchase: p };
  });
  if (result.created && opts.sendEmail !== false) {
    const event = await getEventRequest(db, result.pass.eventRequestId);
    const product = (await db.query(`SELECT * FROM access_products WHERE id = ?`, [result.purchase.productId])).map(rowToProduct)[0];
    const link = await issueMagicLink(db, result.pass.id);
    await sendNow(
      result.pass.email,
      passEmail({ passUrl: `${opts.siteUrl}/pass/open?t=${link.token}`, productName: product?.name ?? "Event Access", unlockLimit: result.pass.unlockLimit, matched: event?.matchedOperators ?? 0, expiresOn: result.pass.expiresAt.slice(0, 10), eventSummary: event ? `${event.city}, ${event.state} on ${event.eventDate}` : "" }),
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
        const amount = typeof o.amount === "number" ? o.amount : 0;
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
  const blockedReason = pass.status === "revoked" ? "This pass was revoked (refund or dispute). Operators you already unlocked stay visible." : expired ? "This pass has expired. Operators you already unlocked stay visible." : null;
  return { pass, event, product, unlocks, remaining: Math.max(0, pass.unlockLimit - pass.unlockedCount), usable: pass.status === "active" && !expired, blockedReason };
}

/**
 * Reveal one operator. Order of checks: pass exists → already unlocked (free) → active, not expired
 * → operator is in this pass's match set → counter under limit (guarded UPDATE) → fetch contact
 * server-side → write the immutable snapshot. Concurrency: the UPDATE serialises; a unique-conflict
 * on insert (two requests for the same operator) rolls back the increment and is retried as a re-read.
 */
export async function unlockOperator(db: AccessDb, source: OperatorSource, passId: string, operatorId: string, meta: { ipHash: string | null; userAgent: string | null }, now = new Date()): Promise<{ unlock: Unlock; consumed: boolean }> {
  const attempt = async (): Promise<{ unlock: Unlock; consumed: boolean }> => {
    const pre = await db.query(`SELECT * FROM access_unlocks WHERE pass_id = ? AND sharetribe_operator_id = ?`, [passId, operatorId]);
    if (pre[0]) return { unlock: rowToUnlock(pre[0]), consumed: false };
    const pass = await getPass(db, passId);
    if (!pass) throw new AccessError("not_found", "Unknown pass");
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
  try {
    return await attempt();
  } catch (e) {
    if (e instanceof RaceRetry || /unique|constraint/i.test(String((e as Error).message))) return attempt();
    throw e;
  }
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
