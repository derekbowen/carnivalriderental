/**
 * Lifecycle events (founder decision 2026-10-14): the customer actions the lifecycle system records,
 * from the chat concierge and the web funnel alike. There is one lifecycle email system (engine.ts);
 * these events never schedule or send anything themselves. The engine reads one of them: for a
 * search that started in the chat, follow-up email requires `email_capture_accepted` with consent.
 *
 * Rows hold identifiers and a consent flag only: never message text, email addresses or contact
 * fields. Writes are best effort and happen outside payment and unlock transactions, so a missing
 * table (production before `npm run access:migrate -- --concierge`) can never break checkout,
 * activation or an unlock.
 */
import crypto from "node:crypto";
import type { Sql } from "../access/db";

export const LIFECYCLE_EVENTS = [
  "chat_started",
  "email_capture_offered",
  "email_capture_accepted",
  "search_submitted",
  "listing_viewed",
  "event_access_offered",
  "checkout_started",
  "event_access_purchased",
  "operator_unlocked",
] as const;
export type LifecycleEventName = (typeof LIFECYCLE_EVENTS)[number];
/** Where the action happened. Chat-originated searches need explicit follow-up consent. */
export type LifecycleSource = "chat" | "web";

export interface LifecycleRefs {
  sessionId?: string | null;
  eventRequestId?: string | null;
  purchaseId?: string | null;
  passId?: string | null;
  listingId?: string | null;
  /** email_capture_accepted only: the customer ticked "remind me about this search". */
  consent?: boolean;
}

/** Event requests created by the chat concierge carry this source path (paths.concierge()). */
export const CONCIERGE_SOURCE_PATH = "/concierge";
export const sourceOfPath = (sourcePath: string | null | undefined): LifecycleSource => (sourcePath === CONCIERGE_SOURCE_PATH ? "chat" : "web");

let warned = false;
export async function recordLifecycleEvent(db: Sql, name: LifecycleEventName, source: LifecycleSource, refs: LifecycleRefs = {}): Promise<boolean> {
  try {
    await db.query(
      `INSERT INTO access_lifecycle_events (id, name, source, session_id, event_request_id, purchase_id, pass_id, listing_id, consent, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), name, source, refs.sessionId ?? null, refs.eventRequestId ?? null, refs.purchaseId ?? null, refs.passId ?? null, refs.listingId ?? null, refs.consent ? 1 : 0, new Date().toISOString()],
    );
    return true;
  } catch (e) {
    if (!warned) console.warn("[lifecycle] event not recorded (lifecycle events table missing?):", (e as Error).message.slice(0, 120));
    warned = true;
    return false;
  }
}

/** True once per session: whether an event was already recorded (e.g. email_capture_offered). */
export async function sessionHasEvent(db: Sql, sessionId: string, name: LifecycleEventName): Promise<boolean> {
  try {
    return (await db.query(`SELECT id FROM access_lifecycle_events WHERE session_id = ? AND name = ?`, [sessionId, name])).length > 0;
  } catch {
    return false;
  }
}

/**
 * Whether the customer behind a chat-originated event request agreed to follow-up email: in the chat
 * session the request came from (or the request it is an alternative to), the latest
 * `email_capture_accepted` has consent. Unticking "remind me" on a later capture withdraws it.
 * Fails closed: no table, no session link or no consent → false.
 */
export async function chatFollowupConsent(db: Sql, eventRequestIds: string[]): Promise<boolean> {
  if (!eventRequestIds.length) return false;
  try {
    const sessions = await db.query(`SELECT DISTINCT session_id FROM access_lifecycle_events WHERE session_id IS NOT NULL AND event_request_id IN (${eventRequestIds.map(() => "?").join(",")})`, eventRequestIds);
    for (const s of sessions) {
      const latest = (await db.query(`SELECT consent FROM access_lifecycle_events WHERE session_id = ? AND name = 'email_capture_accepted' ORDER BY created_at DESC, id DESC LIMIT 1`, [String(s.session_id)]))[0];
      if (latest && Number(latest.consent) === 1) return true;
    }
    return false;
  } catch {
    return false;
  }
}
