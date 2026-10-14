import crypto from "node:crypto";
import type { Sql } from "../access/db";
export type FunnelEvent = "chat_started" | "event_details_submitted" | "inventory_search" | "zero_result_search" | "event_access_offered" | "checkout_started" | "event_access_purchased" | "operator_unlocked" | "contact_viewed" | "availability_requested";
/** IDs and event names only: never customer text, email, operator identity or contact fields. */
export async function track(db: Sql, name: FunnelEvent, refs: { sessionId?: string; eventId?: string; passId?: string } = {}) {
  await db.query(`INSERT INTO concierge_events (id, session_id, event_request_id, pass_id, name, created_at) VALUES (?, ?, ?, ?, ?, ?)`, [crypto.randomUUID(), refs.sessionId ?? null, refs.eventId ?? null, refs.passId ?? null, name, new Date().toISOString()]);
}
