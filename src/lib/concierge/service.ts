import crypto from "node:crypto";
import { type AccessDb, nowIso } from "../access/db";
import { hashToken, newToken } from "../access/session";
import { AccessError, eventRequestInput, getEventRequest, passView, startEventRequest, unlockOperator as accessUnlock, type EventRequest } from "../access/service";
import type { AccessRuntime } from "../access/runtime";
import { geocode } from "../access/matching";
import { getOperatorListing, milesBetween, US_CENTER } from "../catalog/operator-search";
import { RIDES, rideTypeFor, toCard } from "../inventory";
import { paths } from "../seo/routes";
import { leadSchema, type Lead } from "./schema";
import { emptyLead } from "./defaults";
import { CONCIERGE_SOURCE_PATH, recordLifecycleEvent, sessionHasEvent } from "../lifecycle/events";
import { savedSearchSent, sendSavedSearch, type LifecycleDeps } from "../lifecycle/engine";
import { sendNow } from "../access/email";
import { BRAND } from "../config";
import { availabilityRequestEmail } from "./notify";
import { publicEventFacts } from "./extract";
import { leadState, listOf } from "./state";

export const SESSION_COOKIE = "cr_concierge";
export interface Conversation { id: string; details: Lead; eventId: string | null; searched: boolean; searchType: string | null }
export async function conversation(db: AccessDb, token?: string): Promise<{ session: Conversation; token?: string }> {
  const row = token && /^[A-Za-z0-9_-]{43}$/.test(token) ? (await db.query(`SELECT * FROM concierge_sessions WHERE token_hash = ? AND expires_at > ?`, [hashToken(token), nowIso()]))[0] : null;
  if (row) return { session: { id: String(row.id), details: leadSchema.parse(JSON.parse(String(row.details_json))), eventId: row.event_request_id ? String(row.event_request_id) : null, searched: !!Number(row.searched), searchType: row.search_type ? String(row.search_type) : null } };
  const fresh = newToken(), id = crypto.randomUUID(), now = nowIso();
  await db.query(`INSERT INTO concierge_sessions (id, token_hash, details_json, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`, [id, hashToken(fresh), JSON.stringify(emptyLead), now, new Date(Date.now() + 30 * 864e5).toISOString()]);
  await recordLifecycleEvent(db, "chat_started", "chat", { sessionId: id });
  return { session: { id, details: { ...emptyLead }, eventId: null, searched: false, searchType: null }, token: fresh };
}
/**
 * Saves the lead. The link to the session's last event request stays: reusableRequest only reuses it
 * when every stored detail still matches, so a chat turn that repeats the same details never creates
 * a second request (or a second saved-search email), and an edited one always does.
 */
export async function saveLead(db: AccessDb, session: Conversation, raw: unknown) {
  const details = leadSchema.parse(raw);
  await db.query(`UPDATE concierge_sessions SET details_json = ? WHERE id = ?`, [JSON.stringify(details), session.id]);
  session.details = details;
}

/** search_submitted, plus email_capture_offered the first time results are shown before an email was given. */
export async function recordSearch(db: AccessDb, session: Conversation, total: number): Promise<boolean> {
  await recordLifecycleEvent(db, "search_submitted", "chat", { sessionId: session.id });
  if (total === 0 || (await sessionHasEvent(db, session.id, "email_capture_accepted")) || (await sessionHasEvent(db, session.id, "email_capture_offered"))) return false;
  await recordLifecycleEvent(db, "email_capture_offered", "chat", { sessionId: session.id });
  return true;
}

/** The customer opened a listing from the chat results (public listing page; no contact data). */
export async function recordListingView(db: AccessDb, session: Conversation, listingId: string) {
  if (!RIDES.some((r) => r.id === listingId)) throw new AccessError("invalid", "Unknown ride");
  await recordLifecycleEvent(db, "listing_viewed", "chat", { sessionId: session.id, listingId });
}
/** Deterministic, bounded inventory search. Only the existing public projection leaves this function. */
export function searchRides(details: Lead, rideType: string | null) {
  if (rideType && !rideTypeFor(rideType)) throw new AccessError("invalid", "Choose a known ride type");
  const origin = details.city && details.state ? geocode(details.city, details.state) ?? US_CENTER : US_CENTER;
  const rides = RIDES.filter(r => !rideType || r.rideType === rideType)
    .map(r => ({ ...r, miles: Math.round(milesBetween(origin, r)) }))
    .sort((a, b) => a.miles - b.miles || a.id.localeCompare(b.id));
  return { cards: rides.slice(0, 12).map(toCard), total: rides.length, locationPrecision: "resolved" in origin ? origin.resolved : "national", availability: "Matching inventory only. Availability for your event date has not been confirmed." };
}
export const getRideDetails = (id: string) => getOperatorListing(id);
/** A public operator profile is an anonymous aggregate, never the privileged user resource. */
export function getPublicOperatorProfile(op: { label: string; homeState: string | null; miles: number; claimed: boolean }) {
  return { label: op.label, homeState: op.homeState, miles: op.miles, claimed: op.claimed };
}
/** The event request input for the lead as it stands (blank fields as the form sends them). */
const requestInput = (d: Lead, rideType: string | null) => ({ ...d, eventDate: d.eventDate ?? "", city: d.city ?? "", state: d.state ?? "", email: d.email ?? "", zip: d.zip ?? "", eventType: d.eventType ?? "", attendance: d.attendance ?? "", budgetUsd: d.budgetUsd ?? "", rideType: rideType ?? "", sourcePath: paths.concierge() });

/**
 * A chat request from the last 6 hours made from exactly these details (every stored field, compared
 * as the ledger parses them), reused so pressing "See access offer" or "Email me these options" again
 * never creates a second request, a second quote or a second email.
 */
async function reusableRequest(db: AccessDb, session: Conversation, rideType: string | null): Promise<EventRequest | null> {
  if (!session.eventId) return null;
  const e = await getEventRequest(db, session.eventId);
  if (!e || Date.now() - Date.parse(e.createdAt) >= 6 * 3600e3) return null;
  const parsed = eventRequestInput.safeParse(requestInput(session.details, rideType));
  if (!parsed.success) return null;
  const n = parsed.data;
  const same =
    e.email === n.email && e.eventDate === n.eventDate && e.city === n.city && e.state === n.state && e.zip === n.zip && e.eventType === n.eventType &&
    e.attendance === n.attendance && e.budgetCents === (n.budgetUsd === null ? null : n.budgetUsd * 100) && e.rideType === n.rideType;
  return same ? e : null;
}

export async function createEventRequest(rt: AccessRuntime, session: Conversation, rideType: string | null) {
  if (rideType && !rideTypeFor(rideType)) throw new AccessError("invalid", "Choose a known ride type");
  // Multiple requirements remain on the lead. Each checkout covers ONE existing, explicit ride criterion.
  const reused = await reusableRequest(rt.db, session, rideType);
  if (reused) {
    const { quoteForEvent } = await import("../access/service");
    const quote = await quoteForEvent(rt.db, reused);
    if (quote.product) return { event: reused, product: quote.product, sellable: quote.sellable };
  }
  const result = await startEventRequest(rt.db, rt.source, requestInput(session.details, rideType));
  await rt.db.query(`UPDATE concierge_sessions SET event_request_id = ? WHERE id = ?`, [result.event.id, session.id]);
  session.eventId = result.event.id;
  // These rows also link the request to this chat session (consent for follow-up is per session).
  await recordLifecycleEvent(rt.db, "search_submitted", "chat", { sessionId: session.id, eventRequestId: result.event.id });
  if (result.sellable) await recordLifecycleEvent(rt.db, "event_access_offered", "chat", { sessionId: session.id, eventRequestId: result.event.id });
  return result;
}

/**
 * The customer gives their email in the chat to have these results sent ("Email me these options").
 * One lifecycle system: this records email_capture_accepted (with consent only if they ticked
 * "remind me"), saves the email on the lead, and, when the event details are complete, sends the
 * lifecycle `saved_search` email for the matching request: once per request, whatever is pressed
 * again. Nothing else is scheduled here; any later reminder comes from the lifecycle engine's own
 * rules, and for chat searches only with that consent.
 */
export async function captureEmail(rt: AccessRuntime, session: Conversation, email: string, followupConsent: boolean, deps: LifecycleDeps): Promise<{ message: string; emailed: boolean; eventId: string | null; alternativesUrl?: string }> {
  const address = email.trim().toLowerCase();
  if (session.details.email?.trim().toLowerCase() !== address) await saveLead(rt.db, session, { ...session.details, email: address });
  await recordLifecycleEvent(rt.db, "email_capture_accepted", "chat", { sessionId: session.id, eventRequestId: session.eventId, consent: followupConsent });
  const d = session.details;
  const missing = leadState(d).missingForEmail;
  if (missing.length) {
    return { message: `Got it, I'll use ${address}. I still need your ${listOf(missing)}; tell me in the chat and I'll email your options.`, emailed: false, eventId: null };
  }
  const rideType = session.searchType ?? d.requestedRides[0]?.rideType ?? null;
  const { event, sellable } = await createEventRequest(rt, session, rideType);
  if (!sellable) {
    // The no-match fallback chain (access/fallback.ts) already ran for this request; send them to it.
    return { message: "Saved. There aren't enough contactable operators for this exact search yet, so there's nothing to email. The closest alternatives, and a free manual search, are on your matches page.", emailed: false, eventId: event.id, alternativesUrl: paths.connectMatches(event.id) };
  }
  const r = await sendSavedSearch(rt.db, event.id, deps);
  const emailed = r.outcome === "sent" || (r.outcome === "skipped" && r.reason?.startsWith("already") === true);
  return {
    message: emailed ? `Sent to ${address}. Your ${event.city} options are in your inbox, and your search stays saved.` : `Saved for ${address}. We couldn't send the email just now; your search stays saved here.`,
    emailed,
    eventId: event.id,
  };
}
/** Signed pass session is checked BEFORE reading the view (which contains private contact snapshots). */
export async function checkEventAccess(db: AccessDb, authorizedIds: string[], passId: string) {
  if (!authorizedIds.includes(passId)) throw new AccessError("forbidden", "Event Access is required to view operator contacts");
  const view = await passView(db, passId);
  if (!view) throw new AccessError("not_found", "Pass not found");
  return view;
}
export async function getPassStatus(db: AccessDb, authorizedIds: string[], passId: string) {
  const v = await checkEventAccess(db, authorizedIds, passId);
  return { id: v.pass.id, expiresAt: v.pass.expiresAt, remaining: v.remaining, usable: v.usable, productName: v.product.name, operators: v.event.operators.map(op => ({ operatorId: op.operatorId, ...getPublicOperatorProfile(op) })), event: { city: v.event.city, state: v.event.state, eventDate: v.event.eventDate, rideType: v.event.rideType } };
}
export async function getUnlockedOperators(db: AccessDb, authorizedIds: string[], passId: string) {
  const v = await checkEventAccess(db, authorizedIds, passId);
  // Preserve purchased terms: existing unlocks remain visible after expiry/revocation, as on /pass.
  return v.unlocks;
}
export async function unlockOperator(rt: AccessRuntime, authorizedIds: string[], passId: string, operatorId: string, meta: { ipHash: string | null; userAgent: string | null }) {
  await checkEventAccess(rt.db, authorizedIds, passId);
  // Existing service enforces purchase validity, category-bound match snapshot, eligibility, status and atomic balance.
  return accessUnlock(rt.db, rt.source, passId, operatorId, meta);
}
const AVAILABILITY_SENT = "Request saved for review and sent to our team. No operator has confirmed availability, and no message has been sent to operators yet.";
const AVAILABILITY_SAVED = `Request saved for review, but we couldn't notify our team just now. Press it again in a minute, or email support@${BRAND.domain}. No operator has confirmed availability, and no message has been sent to operators yet.`;
/** concierge_requests.status: 'received' until the team email is accepted by the provider, then 'with_team'. */
export const REQUEST_WITH_TEAM = "with_team";

/**
 * "Request Availability" / "Request My Event": saved, then emailed to the team (support@) so someone
 * actually reviews it. The row is marked with_team only once the email provider accepts the
 * notice; until then, pressing it again retries the email (same request, same idempotency key)
 * instead of saving a duplicate, and the customer is never told the team has it when it doesn't.
 */
export async function requestAvailability(db: AccessDb, session: Conversation, listingId: string | null, opts: { send?: typeof sendNow } = {}) {
  const listing = listingId ? RIDES.find(r => r.id === listingId) : null;
  if (listingId && !listing) throw new AccessError("invalid", "Unknown ride");
  const missing = leadState(session.details).missingForAvailability;
  if (missing.length) throw new AccessError("invalid", `Add your ${listOf(missing)} before requesting availability`);
  if ((session.details.eventDate ?? "") < nowIso().slice(0, 10)) throw new AccessError("invalid", "Choose a future event date");
  const recent = await db.query(`SELECT id, listing_id, details_json, status, created_at FROM concierge_requests WHERE session_id = ? ORDER BY created_at DESC LIMIT 20`, [session.id]);
  const same = recent.find(r => (r.listing_id ? String(r.listing_id) : null) === listingId && String(r.details_json) === JSON.stringify(session.details) && Date.now() - Date.parse(String(r.created_at)) < 864e5);
  let id: string;
  if (same) {
    id = String(same.id);
    if (String(same.status) === REQUEST_WITH_TEAM) return { id, status: REQUEST_WITH_TEAM, message: AVAILABILITY_SENT };
  } else {
    id = crypto.randomUUID();
    await db.query(`INSERT INTO concierge_requests (id, session_id, listing_id, details_json, status, created_at) VALUES (?, ?, ?, ?, 'received', ?)`, [id, session.id, listingId, JSON.stringify(session.details), nowIso()]);
  }
  // A failed email never loses the saved request; it is retried the next time the customer presses.
  const r = await (opts.send ?? sendNow)(`support@${BRAND.domain}`, availabilityRequestEmail({ requestId: id, details: session.details, listing: listing ? { id: listing.id, title: listing.title } : null }), `availability:${id}`);
  if (!r.sent) return { id, status: "received", message: AVAILABILITY_SAVED };
  await db.query(`UPDATE concierge_requests SET status = ? WHERE id = ?`, [REQUEST_WITH_TEAM, id]);
  return { id, status: REQUEST_WITH_TEAM, message: AVAILABILITY_SENT };
}
export async function getRequestStatus(db: AccessDb, session: Conversation) {
  return db.query(`SELECT id, listing_id, status, created_at FROM concierge_requests WHERE session_id = ? ORDER BY created_at DESC LIMIT 20`, [session.id]);
}

/**
 * What the application knows about this conversation, for the model and the no-AI answers: the
 * public event facts, what is still missing, and whether an email, request or pass exists. Never
 * the customer's email address, phone or name, and never operator data.
 */
export interface ConversationState {
  event: ReturnType<typeof publicEventFacts>;
  searchable: boolean;
  missingForEmail: string[];
  missingForAvailability: string[];
  emailOnFile: boolean;
  /** The "your options" email for the current event request was accepted by the provider. */
  savedSearchEmailSent: boolean;
  eventRequestSaved: boolean;
  availabilityRequests: { total: number; withTeam: number };
  passesInThisBrowser: number;
}
export async function conversationState(db: AccessDb, session: Conversation, passIds: string[]): Promise<ConversationState> {
  const st = leadState(session.details);
  const requests = await getRequestStatus(db, session);
  return {
    event: publicEventFacts(session.details),
    searchable: st.searchable,
    missingForEmail: st.missingForEmail,
    missingForAvailability: st.missingForAvailability,
    emailOnFile: st.hasEmail,
    savedSearchEmailSent: session.eventId ? await savedSearchSent(db, session.eventId) : false,
    eventRequestSaved: !!session.eventId,
    availabilityRequests: { total: requests.length, withTeam: requests.filter((r) => String(r.status) === REQUEST_WITH_TEAM).length },
    passesInThisBrowser: passIds.length,
  };
}
