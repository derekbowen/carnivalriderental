/**
 * Lifecycle email engine (founder decision 2026-10-14). Deterministic rules decide who is due which
 * email; the app renders an approved template (templates.ts); an optional AI step (ai.ts) may pick
 * among the templates already due and add one validated intro line; the email API sends it.
 *
 * Triggers (founder table):
 *   account created / email entered        → nothing (an event request is the intent signal)
 *   saved_search                            → only when the customer asks for it (button), immediately
 *   search_abandonment_1h                   → matched request, no checkout, inactive ≥ 60 min, request ≤ 6 h old
 *   search_abandonment_24h                  → matched request 24–48 h old, still no purchase
 *   checkout_abandonment_1h                 → checkout started, not paid, 1–24 h ago, inactive ≥ 60 min
 *   purchased_no_unlock_2h                  → active pass with 0 unlocks, 2–72 h after purchase
 * Stops: any paid Event Access for the address stops every sales email; at most one sales email per
 * address per 20 h; never for a past event date; never to our own or reserved test domains;
 * unsubscribed addresses get nothing. A search that started in the chat concierge gets sales email
 * only if the customer ticked "remind me" when giving their email (events.ts, chatFollowupConsent);
 * typing an email into the chat is never consent. Commercial templates need an approved campaign and a postal
 * address in live mode (CAN-SPAM); without them they are recorded as 'blocked' and retried while due.
 */
import crypto from "node:crypto";
import { MATCH_RADIUS_MILES } from "../access/config";
import type { AccessDb, Row } from "../access/db";
import { nowIso } from "../access/db";
import { eventTypeNoun } from "../access/event-types";
import { chatFollowupConsent, CONCIERGE_SOURCE_PATH } from "./events";
import { RELATED_RIDE_TYPES, requirementNoun, requirementPlural } from "../access/fallback";
import { fallbackView, getEventRequest, issueMagicLink, priceLabel, purchaseValidHere, quoteForEvent, type EventRequest } from "../access/service";
import type { EmailConfig } from "../email/config";
import { normalizeEmail, unsubscribeUrl, type SendFn } from "../email/outbox";
import { operatorCount, rideTypeFor, ridesNear } from "../inventory";
import { rideTypeCopy } from "../inventory/ride-type-copy";
import { validIntro } from "./ai";
import { LIFECYCLE_CAMPAIGN, longDate, renderLifecycle, TEMPLATE_KIND, defaultIntro, type LifecycleTemplate, type LifecycleVars } from "./templates";

const HOUR = 3600e3;
const SALES: LifecycleTemplate[] = ["checkout_abandonment_1h", "search_abandonment_1h", "search_abandonment_24h"];
/** Commercial lifecycle sends per UTC day (all templates together). */
export const COMMERCIAL_DAILY_CAP = 200;

export interface Candidate {
  template: LifecycleTemplate;
  email: string;
  eventRequestId: string;
  purchaseId: string | null;
  passId: string | null;
  dedupeKey: string;
}
/** One address's due emails, best first; the first is the deterministic choice. */
export interface Plan {
  email: string;
  options: Candidate[];
}

/** Our own domain and reserved test domains never receive lifecycle email. */
export function excludedAddress(email: string): boolean {
  const d = email.split("@")[1]?.toLowerCase() ?? "";
  return !d || d === "carnivalriderental.us" || d.endsWith(".carnivalriderental.us") || /^example\.(com|org|net)$/.test(d) || /\.(test|invalid|example|localhost)$/.test(d);
}

const iso = (t: number) => new Date(t).toISOString();

/** Who is due which email right now. Pure reads; nothing is written. */
export async function duePlans(db: AccessDb, now = new Date()): Promise<Plan[]> {
  const t = now.getTime();
  const today = iso(t).slice(0, 10);
  const requests = await db.query(`SELECT id, email, status, event_date, source_path, created_at FROM access_event_requests WHERE created_at >= ? ORDER BY created_at DESC`, [iso(t - 50 * HOUR)]);
  const purchases = await db.query(`SELECT id, email, event_request_id, status, created_at FROM access_purchases WHERE created_at >= ? ORDER BY created_at DESC`, [iso(t - 50 * HOUR)]);
  const paid = new Set((await db.query(`SELECT DISTINCT email FROM access_purchases WHERE status IN ('paid', 'partially_refunded') AND created_at >= ?`, [iso(t - 60 * 24 * HOUR)])).map((r) => normalizeEmail(String(r.email))));
  const recentSales = new Set(
    (await db.query(`SELECT DISTINCT email FROM access_lifecycle_emails WHERE status = 'sent' AND template IN (${SALES.map(() => "?").join(",")}) AND updated_at >= ?`, [...SALES, iso(t - 20 * HOUR)])).map((r) => normalizeEmail(String(r.email))),
  );
  const lastActivity = new Map<string, number>();
  for (const r of [...requests, ...purchases]) {
    const e = normalizeEmail(String(r.email));
    lastActivity.set(e, Math.max(lastActivity.get(e) ?? 0, Date.parse(String(r.created_at))));
  }

  const plans: Plan[] = [];
  const byEmail = new Map<string, Row[]>();
  for (const r of requests) {
    const e = normalizeEmail(String(r.email));
    byEmail.set(e, [...(byEmail.get(e) ?? []), r]);
  }
  for (const [email, reqs] of byEmail) {
    if (excludedAddress(email) || paid.has(email) || recentSales.has(email)) continue;
    const inactive = t - (lastActivity.get(email) ?? t) >= HOUR;
    const latest = reqs[0]; // newest first: an older search the customer replaced is never chased
    const age = t - Date.parse(String(latest.created_at));
    // No date yet counts as upcoming; a past date stops every sales email.
    if (latest.status !== "matched" || (latest.event_date && String(latest.event_date) < today)) continue;
    if (latest.source_path === CONCIERGE_SOURCE_PATH && !(await chatFollowupConsent(db, await withOrigins(db, String(latest.id))))) continue;
    const options: Candidate[] = [];
    const base = { email, eventRequestId: String(latest.id), passId: null };
    const checkout = purchases.find((p) => normalizeEmail(String(p.email)) === email && p.event_request_id === latest.id && (p.status === "pending" || p.status === "expired"));
    if (checkout && inactive) {
      const cAge = t - Date.parse(String(checkout.created_at));
      if (cAge >= HOUR && cAge <= 24 * HOUR) options.push({ ...base, template: "checkout_abandonment_1h", purchaseId: String(checkout.id), dedupeKey: `checkout_abandonment_1h:${latest.id}` });
    }
    if (!checkout && inactive && age >= HOUR && age <= 6 * HOUR) options.push({ ...base, template: "search_abandonment_1h", purchaseId: null, dedupeKey: `search_abandonment_1h:${latest.id}` });
    if (inactive && age >= 24 * HOUR && age <= 48 * HOUR) options.push({ ...base, template: "search_abandonment_24h", purchaseId: null, dedupeKey: `search_abandonment_24h:${latest.id}` });
    if (options.length) plans.push({ email, options });
  }

  const passes = await db.query(
    `SELECT pa.id, pa.email, pa.event_request_id, pa.purchase_id, pu.stripe_checkout_session_id FROM access_passes pa JOIN access_purchases pu ON pu.id = pa.purchase_id
     WHERE pa.status = 'active' AND pa.unlocked_count = 0 AND pa.created_at <= ? AND pa.created_at >= ? AND pa.expires_at > ?`,
    [iso(t - 2 * HOUR), iso(t - 72 * HOUR), iso(t)],
  );
  for (const p of passes) {
    const email = normalizeEmail(String(p.email));
    if (excludedAddress(email) || !purchaseValidHere({ stripeCheckoutSessionId: p.stripe_checkout_session_id ? String(p.stripe_checkout_session_id) : null })) continue;
    plans.push({ email, options: [{ template: "purchased_no_unlock_2h", email, eventRequestId: String(p.event_request_id), purchaseId: String(p.purchase_id), passId: String(p.id), dedupeKey: `purchased_no_unlock_2h:${p.id}` }] });
  }
  return plans;
}

/** A request plus the request(s) it is a no-match alternative to (access_funnel_events). */
async function withOrigins(db: AccessDb, id: string): Promise<string[]> {
  const rows = await db.query(`SELECT event_request_id FROM access_funnel_events WHERE result_event_request_id = ?`, [id]);
  return [id, ...rows.map((r) => String(r.event_request_id))];
}

// ------------------------------------------------------------------------------ variables
/** Everything a template needs, from the ledger and the public snapshot. The CTA is filled in at send time. */
export async function lifecycleVars(db: AccessDb, c: Candidate, cfg: EmailConfig, siteUrl: string): Promise<{ vars: LifecycleVars; event: EventRequest } | null> {
  const event = await getEventRequest(db, c.eventRequestId);
  if (!event) return null;
  const origin = (await fallbackView(db, event.id)).origin;
  const quote = await quoteForEvent(db, event);
  const pass = c.passId ? (await db.query(`SELECT unlock_limit, expires_at FROM access_passes WHERE id = ?`, [c.passId]))[0] : null;
  const nearby =
    c.template === "search_abandonment_24h" && event.rideType
      ? (RELATED_RIDE_TYPES[event.rideType] ?? [])
          .slice(0, 2)
          .map((type) => ({ label: rideTypeCopy(type, rideTypeFor(type)?.name ?? type).many, operators: operatorCount(ridesNear(event.lat, event.lng, MATCH_RADIUS_MILES).filter((r) => r.rideType === type)) }))
          .filter((n) => n.operators > 0)
      : [];
  const vars: LifecycleVars = {
    city: event.city,
    state: event.state,
    eventDate: event.eventDate,
    eventType: eventTypeNoun(event.eventType),
    ride: requirementNoun(event.rideType, event.rideClass),
    ridePlural: requirementPlural(event.rideType, event.rideClass),
    alternativeTo: origin ? requirementNoun(origin.requestedRideType, origin.requestedRideClass) : null,
    operators: event.matchedOperators,
    nearestMiles: event.operators.length ? Math.min(...event.operators.map((o) => o.miles)) : null,
    radiusMiles: origin?.offer.kind === "radius" ? origin.offer.radiusMiles : MATCH_RADIUS_MILES,
    listings: event.operators.slice(0, 3).flatMap((o) => (o.listings[0] ? [{ title: o.listings[0].title, rideLabel: o.listings[0].rideType ? rideTypeFor(o.listings[0].rideType)?.name ?? null : null, miles: o.listings[0].miles, thumb: o.listings[0].thumb, operatorLabel: o.label }] : [])),
    nearby,
    product: quote.product ? { name: quote.product.name, price: priceLabel(quote.product), unlockLimit: quote.product.unlockLimit, validityDays: quote.product.validityDays } : null,
    pass: pass ? { unlockLimit: Number(pass.unlock_limit), expiresOn: longDate(String(pass.expires_at).slice(0, 10)) } : null,
    ctaUrl: `${siteUrl}/connect/${event.id}`,
    unsubscribeUrl: cfg.unsubscribeSecret ? unsubscribeUrl(siteUrl, c.email, cfg.unsubscribeSecret) : null,
    postalAddress: cfg.postalAddress,
    intro: null,
  };
  return { vars, event };
}

// ------------------------------------------------------------------------------ suppression
export async function suppressEmail(db: AccessDb, email: string, reason: string): Promise<void> {
  await db.query(`INSERT INTO access_email_suppressions (email, reason, created_at) VALUES (?, ?, ?) ON CONFLICT (email) DO NOTHING`, [normalizeEmail(email), reason, nowIso()]);
}
export async function isSuppressedEmail(db: AccessDb, email: string): Promise<boolean> {
  return (await db.query(`SELECT email FROM access_email_suppressions WHERE email = ?`, [normalizeEmail(email)])).length > 0;
}

// ------------------------------------------------------------------------------ sending
export interface Personalized {
  template: LifecycleTemplate;
  intro: string | null;
}
/** Optional AI step (ai.ts): picks one of the due templates and may supply one intro line. */
export type Personalizer = (input: { options: { template: LifecycleTemplate; vars: LifecycleVars }[] }) => Promise<Personalized | null>;

export interface LifecycleDeps {
  cfg: EmailConfig;
  /** null when no provider key is configured: sends are recorded as blocked. */
  send: SendFn | null;
  siteUrl: string;
  now?: () => Date;
  personalize?: Personalizer | null;
}
export type Outcome = "sent" | "blocked" | "suppressed" | "failed" | "skipped" | "deferred";

const record = async (db: AccessDb, c: Candidate, status: "blocked" | "suppressed", reason: string) => {
  const t = nowIso();
  await db.query(
    `INSERT INTO access_lifecycle_emails (id, template, dedupe_key, email, event_request_id, purchase_id, pass_id, status, reason, attempts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
     ON CONFLICT (dedupe_key) DO UPDATE SET status = excluded.status, reason = excluded.reason, updated_at = excluded.updated_at WHERE access_lifecycle_emails.status IN ('blocked', 'failed')`,
    [crypto.randomUUID(), c.template, c.dedupeKey, c.email, c.eventRequestId, c.purchaseId, c.passId, status, reason, t, t],
  );
};

/** Claims the row for sending (concurrency-safe): a new row, or a retry of a blocked/failed one. */
async function claim(db: AccessDb, c: Candidate): Promise<boolean> {
  const t = nowIso();
  const ins = await db.query(
    `INSERT INTO access_lifecycle_emails (id, template, dedupe_key, email, event_request_id, purchase_id, pass_id, status, attempts, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'sending', 1, ?, ?) ON CONFLICT (dedupe_key) DO NOTHING RETURNING id`,
    [crypto.randomUUID(), c.template, c.dedupeKey, c.email, c.eventRequestId, c.purchaseId, c.passId, t, t],
  );
  if (ins.length) return true;
  const retry = await db.query(`UPDATE access_lifecycle_emails SET status = 'sending', attempts = attempts + 1, reason = NULL, updated_at = ? WHERE dedupe_key = ? AND status IN ('blocked', 'failed') AND attempts < 5 RETURNING id`, [t, c.dedupeKey]);
  return retry.length > 0;
}

/** Why this candidate can't go out right now, or null. Order: final → suppressed → gates. */
async function gate(db: AccessDb, c: Candidate, deps: LifecycleDeps): Promise<{ outcome: Outcome; reason: string } | null> {
  const existing = (await db.query(`SELECT status FROM access_lifecycle_emails WHERE dedupe_key = ?`, [c.dedupeKey]))[0];
  if (existing && ["sent", "suppressed", "sending"].includes(String(existing.status))) return { outcome: "skipped", reason: `already ${existing.status}` };
  if (await isSuppressedEmail(db, c.email)) return { outcome: "suppressed", reason: "unsubscribed" };
  if (!deps.send) return { outcome: "blocked", reason: "email provider not configured" };
  if (TEMPLATE_KIND[c.template] === "commercial" && deps.cfg.mode === "live") {
    if (!deps.cfg.postalAddress) return { outcome: "blocked", reason: "BUSINESS_POSTAL_ADDRESS not set (CAN-SPAM)" };
    if (!deps.cfg.approvedCampaigns.includes(LIFECYCLE_CAMPAIGN)) return { outcome: "blocked", reason: `${LIFECYCLE_CAMPAIGN} not in EMAIL_APPROVED_CAMPAIGNS` };
    if (!deps.cfg.unsubscribeSecret) return { outcome: "blocked", reason: "no unsubscribe secret" };
  }
  return null;
}

async function commercialSentToday(db: AccessDb, now: Date): Promise<number> {
  const commercial = (Object.keys(TEMPLATE_KIND) as LifecycleTemplate[]).filter((k) => TEMPLATE_KIND[k] === "commercial");
  const day = now.toISOString().slice(0, 10);
  const r = await db.query(`SELECT COUNT(*) AS n FROM access_lifecycle_emails WHERE status = 'sent' AND template IN (${commercial.map(() => "?").join(",")}) AND updated_at >= ? AND updated_at < ?`, [...commercial, `${day}T00:00:00.000Z`, `${day}T23:59:59.999Z`]);
  return Number(r[0]?.n ?? 0);
}

/** Sends one plan: gates, optional AI choice and intro, claim, render, send, record. */
export async function sendPlan(db: AccessDb, plan: Plan, deps: LifecycleDeps): Promise<{ outcome: Outcome; template: LifecycleTemplate; reason?: string }> {
  const now = (deps.now ?? (() => new Date()))();
  let chosen = plan.options[0];
  const blocked = await gate(db, chosen, deps);
  if (blocked) {
    if (blocked.outcome === "blocked" || blocked.outcome === "suppressed") await record(db, chosen, blocked.outcome, blocked.reason);
    return { outcome: blocked.outcome, template: chosen.template, reason: blocked.reason };
  }
  if (TEMPLATE_KIND[chosen.template] === "commercial" && (await commercialSentToday(db, now)) >= COMMERCIAL_DAILY_CAP) return { outcome: "deferred", template: chosen.template, reason: "daily cap" };

  // Variables for every due option (AI may pick among them; only options that pass the same gates are offered).
  const open: { c: Candidate; vars: LifecycleVars }[] = [];
  for (const c of plan.options) {
    if (c !== chosen && (await gate(db, c, deps))) continue;
    const v = await lifecycleVars(db, c, deps.cfg, deps.siteUrl);
    if (v) open.push({ c, vars: v.vars });
  }
  if (!open.length) return { outcome: "skipped", template: chosen.template, reason: "request missing" };
  let pick = open.find((o) => o.c === chosen) ?? open[0];
  let personalized = false;
  if (deps.personalize) {
    try {
      const ai = await deps.personalize({ options: open.map((o) => ({ template: o.c.template, vars: o.vars })) });
      const alt = ai && open.find((o) => o.c.template === ai.template);
      if (alt) {
        pick = alt;
        if (ai!.intro && validIntro(ai!.intro, alt.vars)) {
          pick.vars.intro = ai!.intro;
          personalized = true;
        }
      }
    } catch (e) {
      console.error("[lifecycle] personalization failed, default copy used:", (e as Error).message);
    }
  }
  chosen = pick.c;
  if (!(await claim(db, chosen))) return { outcome: "skipped", template: chosen.template, reason: "claimed elsewhere" };

  const vars = pick.vars;
  if (chosen.passId) {
    const { token } = await issueMagicLink(db, chosen.passId);
    vars.ctaUrl = `${deps.siteUrl}/pass/open?t=${token}`;
  }
  const content = renderLifecycle(chosen.template, vars);
  const live = deps.cfg.mode === "live";
  const to = live ? chosen.email : deps.cfg.testRecipient;
  const commercial = TEMPLATE_KIND[chosen.template] === "commercial";
  const body: Record<string, unknown> = {
    from: deps.cfg.fromTransactional,
    to: [to],
    subject: live ? content.subject : `[TEST → ${chosen.email}] ${content.subject}`,
    html: content.html,
    text: content.text,
    reply_to: `support@carnivalriderental.us`,
    ...(vars.unsubscribeUrl ? { headers: { "List-Unsubscribe": `<${vars.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
    tags: [{ name: "template", value: chosen.template }, { name: "kind", value: commercial ? "commercial" : "transactional" }],
  };
  const masked = to.replace(/^(.).*(@.*)$/, "$1***$2");
  try {
    await deps.send!(body, idempotency(chosen.dedupeKey));
    await db.query(`UPDATE access_lifecycle_emails SET status = 'sent', subject = ?, personalized = ?, delivered_to = ?, reason = NULL, updated_at = ? WHERE dedupe_key = ?`, [content.subject, personalized ? 1 : 0, live ? "customer" : "test-recipient", nowIso(), chosen.dedupeKey]);
    console.info("[lifecycle] sent:", chosen.template, deps.cfg.mode, "to", masked, personalized ? "(personalized)" : "");
    return { outcome: "sent", template: chosen.template };
  } catch (e) {
    const msg = String((e as Error).message).slice(0, 200);
    await db.query(`UPDATE access_lifecycle_emails SET status = 'failed', reason = ?, updated_at = ? WHERE dedupe_key = ?`, [msg, nowIso(), chosen.dedupeKey]);
    console.error("[lifecycle] send failed:", chosen.template, msg);
    return { outcome: "failed", template: chosen.template, reason: msg };
  }
}

/** Provider idempotency keys must be UUID-shaped; the same logical email always maps to the same key. */
const idempotency = (key: string) => {
  const h = crypto.createHash("sha256").update(`lifecycle:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

// ------------------------------------------------------------------------------ entry points
/** The customer pressed "Email me these results": transactional, immediate, once per request. */
export async function sendSavedSearch(db: AccessDb, eventRequestId: string, deps: LifecycleDeps): Promise<{ outcome: Outcome; reason?: string }> {
  const event = await getEventRequest(db, eventRequestId);
  if (!event || event.status !== "matched") return { outcome: "skipped", reason: "nothing to save" };
  const email = normalizeEmail(event.email);
  if (excludedAddress(email) && deps.cfg.mode === "live") return { outcome: "skipped", reason: "excluded address" };
  const r = await sendPlan(db, { email, options: [{ template: "saved_search", email, eventRequestId: event.id, purchaseId: null, passId: null, dedupeKey: `saved_search:${event.id}` }] }, { ...deps, personalize: null });
  return { outcome: r.outcome, reason: r.reason };
}

/** Whether this request's results were already emailed (the matches page shows it instead of the button). */
export async function savedSearchSent(db: AccessDb, eventRequestId: string): Promise<boolean> {
  return (await db.query(`SELECT id FROM access_lifecycle_emails WHERE dedupe_key = ? AND status = 'sent'`, [`saved_search:${eventRequestId}`])).length > 0;
}

export interface RunSummary {
  ran: boolean;
  due: number;
  outcomes: Partial<Record<Outcome, number>>;
}

/** One scheduled pass: skipped when another run started less than `minIntervalMs` ago. */
export async function runLifecycle(db: AccessDb, deps: LifecycleDeps, opts: { minIntervalMs?: number } = {}): Promise<RunSummary> {
  const now = (deps.now ?? (() => new Date()))();
  const started = now.toISOString();
  const cutoff = iso(now.getTime() - (opts.minIntervalMs ?? 4 * 60e3));
  const got =
    (await db.query(`INSERT INTO access_job_runs (name, started_at) VALUES ('lifecycle', ?) ON CONFLICT (name) DO NOTHING RETURNING name`, [started])).length ||
    (await db.query(`UPDATE access_job_runs SET started_at = ?, finished_at = NULL WHERE name = 'lifecycle' AND started_at < ? RETURNING name`, [started, cutoff])).length;
  if (!got) return { ran: false, due: 0, outcomes: {} };
  const plans = await duePlans(db, now);
  const outcomes: RunSummary["outcomes"] = {};
  for (const p of plans) {
    const r = await sendPlan(db, p, deps);
    outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + 1;
  }
  await db.query(`UPDATE access_job_runs SET finished_at = ?, result = ? WHERE name = 'lifecycle'`, [nowIso(), JSON.stringify({ due: plans.length, outcomes })]);
  return { ran: true, due: plans.length, outcomes };
}

export { defaultIntro };
