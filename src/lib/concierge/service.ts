import crypto from "node:crypto";
import { type AccessDb, nowIso } from "../access/db";
import { hashToken, newToken } from "../access/session";
import { AccessError, passView, startEventRequest, unlockOperator as accessUnlock } from "../access/service";
import type { AccessRuntime } from "../access/runtime";
import { geocode } from "../access/matching";
import { getOperatorListing, milesBetween, US_CENTER } from "../catalog/operator-search";
import { RIDES, rideTypeFor, toCard } from "../inventory";
import { paths } from "../seo/routes";
import { leadSchema, type Lead } from "./schema";
import { emptyLead } from "./defaults";
import { track } from "./analytics";

export const SESSION_COOKIE = "cr_concierge";
export interface Conversation { id: string; details: Lead; eventId: string | null; searched: boolean; searchType: string | null }
export async function conversation(db: AccessDb, token?: string): Promise<{ session: Conversation; token?: string }> {
  const row = token && /^[A-Za-z0-9_-]{43}$/.test(token) ? (await db.query(`SELECT * FROM concierge_sessions WHERE token_hash = ? AND expires_at > ?`, [hashToken(token), nowIso()]))[0] : null;
  if (row) return { session: { id: String(row.id), details: leadSchema.parse(JSON.parse(String(row.details_json))), eventId: row.event_request_id ? String(row.event_request_id) : null, searched: !!Number(row.searched), searchType: row.search_type ? String(row.search_type) : null } };
  const fresh = newToken(), id = crypto.randomUUID(), now = nowIso();
  await db.query(`INSERT INTO concierge_sessions (id, token_hash, details_json, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`, [id, hashToken(fresh), JSON.stringify(emptyLead), now, new Date(Date.now() + 30 * 864e5).toISOString()]);
  await track(db, "chat_started", { sessionId: id });
  return { session: { id, details: { ...emptyLead }, eventId: null, searched: false, searchType: null }, token: fresh };
}
export async function saveLead(db: AccessDb, session: Conversation, raw: unknown) {
  const details = leadSchema.parse(raw);
  await db.query(`UPDATE concierge_sessions SET details_json = ?, event_request_id = NULL WHERE id = ?`, [JSON.stringify(details), session.id]);
  session.details = details;
  session.eventId = null;
  await track(db, "event_details_submitted", { sessionId: session.id });
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
export async function createEventRequest(rt: AccessRuntime, session: Conversation, rideType: string | null) {
  if (rideType && !rideTypeFor(rideType)) throw new AccessError("invalid", "Choose a known ride type");
  // Multiple requirements remain on the lead. Each checkout covers ONE existing, explicit ride criterion.
  const d = session.details;
  const result = await startEventRequest(rt.db, rt.source, { ...d, eventDate: d.eventDate ?? "", city: d.city ?? "", state: d.state ?? "", email: d.email ?? "", zip: d.zip ?? "", eventType: d.eventType ?? "", attendance: d.attendance ?? "", budgetUsd: d.budgetUsd ?? "", rideType: rideType ?? "", sourcePath: paths.concierge() });
  await rt.db.query(`UPDATE concierge_sessions SET event_request_id = ? WHERE id = ?`, [result.event.id, session.id]);
  session.eventId = result.event.id;
  if (result.sellable) await track(rt.db, "event_access_offered", { sessionId: session.id, eventId: result.event.id });
  return result;
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
export async function requestAvailability(db: AccessDb, session: Conversation, listingId: string | null) {
  if (listingId && !RIDES.some(r => r.id === listingId)) throw new AccessError("invalid", "Unknown ride");
  if (!session.details.eventDate || !session.details.city || !session.details.state || !session.details.email) throw new AccessError("invalid", "Add event date, city, state and email before requesting availability");
  if (session.details.eventDate < nowIso().slice(0, 10)) throw new AccessError("invalid", "Choose a future event date");
  const id = crypto.randomUUID();
  await db.query(`INSERT INTO concierge_requests (id, session_id, listing_id, details_json, status, created_at) VALUES (?, ?, ?, ?, 'received', ?)`, [id, session.id, listingId, JSON.stringify(session.details), nowIso()]);
  await track(db, "availability_requested", { sessionId: session.id });
  return { id, status: "received", message: "Request saved for review. No operator has confirmed availability, and no message has been sent to operators yet." };
}
export async function getRequestStatus(db: AccessDb, session: Conversation) {
  return db.query(`SELECT id, listing_id, status, created_at FROM concierge_requests WHERE session_id = ? ORDER BY created_at DESC LIMIT 20`, [session.id]);
}
