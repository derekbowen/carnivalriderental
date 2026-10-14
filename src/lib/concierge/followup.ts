import crypto from "node:crypto";
import type { AccessDb } from "../access/db";
import { newToken } from "../access/session";
import { sendNow } from "../access/email";
import { leadSchema } from "./schema";
import { RIDE_TYPES } from "../inventory";

export async function consentToFollowup(db: AccessDb, sessionId: string, email: string, now = new Date()) {
  return db.transaction(async tx => {
    const existing = (await tx.query(`SELECT * FROM concierge_followup_consent WHERE session_id = ?`, [sessionId]))[0];
    if (existing && String(existing.email) !== email) throw new Error("Use the same saved-search email or start a new conversation");
    if (existing?.unsubscribed_at) throw new Error("This saved search is unsubscribed; contact support to change preferences");
    if (!existing) {
      await tx.query(`INSERT INTO concierge_followup_consent (session_id, email, consent_version, consented_at, resume_token) VALUES (?, ?, 'saved-search-v1', ?, ?)`, [sessionId, email, now.toISOString(), newToken()]);
      for (const [stage, hours] of [[1, 1], [2, 24], [3, 72]]) await tx.query(`INSERT INTO concierge_followup_jobs (id, session_id, stage, due_at) VALUES (?, ?, ?, ?)`, [crypto.randomUUID(), sessionId, stage, new Date(now.getTime() + hours * 3600e3).toISOString()]);
    }
  });
}
export async function unsubscribe(db: AccessDb, token: string) {
  await db.transaction(async tx => {
    const rows = await tx.query(`UPDATE concierge_followup_consent SET unsubscribed_at = ? WHERE resume_token = ? RETURNING session_id`, [new Date().toISOString(), token]);
    if (rows[0]) await tx.query(`UPDATE concierge_followup_jobs SET status = 'cancelled' WHERE session_id = ? AND status = 'pending'`, [rows[0].session_id]);
  });
}
export async function eligibleForFollowup(db: AccessDb, sessionId: string) {
  const consent = (await db.query(`SELECT * FROM concierge_followup_consent WHERE session_id = ? AND unsubscribed_at IS NULL`, [sessionId]))[0];
  if (!consent) return false;
  // Covers purchases from other conversations using the same email; never keep selling to a buyer.
  const purchased = await db.query(`SELECT id FROM access_purchases WHERE email = ? AND paid_at IS NOT NULL LIMIT 1`, [consent.email]);
  return purchased.length === 0;
}
/** Explicit operator invocation only. Off by default; no cron or live campaign is enabled here. */
export async function dispatchFollowups(db: AccessDb, siteUrl: string, now = new Date()) {
  if (process.env.CONCIERGE_FOLLOWUPS_ENABLED !== "true") return { sent: 0, disabled: true };
  if (!process.env.EMAIL_POSTAL_ADDRESS) throw new Error("A valid sender postal address is required before follow-ups can send");
  const due = await db.query(`SELECT * FROM concierge_followup_jobs WHERE status = 'pending' AND due_at <= ? ORDER BY due_at LIMIT 25`, [now.toISOString()]);
  let sent = 0;
  const handled = new Set<string>();
  for (const job of due) {
    const sid = String(job.session_id);
    if (handled.has(sid)) continue;
    handled.add(sid);
    if (!await eligibleForFollowup(db, sid)) { await db.query(`UPDATE concierge_followup_jobs SET status = 'cancelled' WHERE id = ?`, [job.id]); continue; }
    const claimed = await db.query(`UPDATE concierge_followup_jobs SET status = 'sending' WHERE id = ? AND status = 'pending' RETURNING id`, [job.id]);
    if (!claimed.length) continue;
    const c = (await db.query(`SELECT c.*, s.details_json FROM concierge_followup_consent c JOIN concierge_sessions s ON s.id = c.session_id WHERE c.session_id = ?`, [sid]))[0];
    if (!await eligibleForFollowup(db, sid)) { await db.query(`UPDATE concierge_followup_jobs SET status = 'cancelled' WHERE id = ?`, [job.id]); continue; }
    const lead = leadSchema.parse(JSON.parse(String(c.details_json)));
    const ride = RIDE_TYPES.find(t => t.id === lead.requestedRides[0]?.rideType)?.name ?? "carnival rides";
    const location = lead.city ? ` in ${lead.city}${lead.state ? `, ${lead.state}` : ""}` : "";
    const subject = Number(job.stage) === 1 ? `Still looking for ${ride}${location}?` : Number(job.stage) === 2 ? `Still planning your event${location}?` : "Need help finding the right rides?";
    const token = encodeURIComponent(String(c.resume_token));
    const text = `${subject}\n\nYou asked us to save your search and follow up. Continue reviewing public ride options: ${siteUrl}/concierge/resume?t=${token}\n\nAvailability is unconfirmed. Operator contacts still require eligible Event Access.\n\nStop reminders: ${siteUrl}/concierge/unsubscribe?t=${token}\n\nCarnival Ride Rental\n${process.env.EMAIL_POSTAL_ADDRESS}`;
    const escape = (s: string) => s.replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]!));
    const result = await sendNow(String(c.email), { subject, text, html: `<pre style="white-space:pre-wrap">${escape(text)}</pre>` }, `concierge-followup:${job.id}`);
    await db.query(`UPDATE concierge_followup_jobs SET status = ?, sent_at = ? WHERE id = ?`, [result.sent ? "sent" : "failed", result.sent ? now.toISOString() : null, job.id]);
    if (result.sent) sent++;
  }
  return { sent, disabled: false };
}
