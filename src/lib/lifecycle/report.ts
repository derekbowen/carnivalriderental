/**
 * The private funnel dashboard (/internal/funnel): counts from what the ledger already records.
 * Aggregates only: no email addresses, message text, event details or operator data ever leave
 * these queries. A table that can't be read (concierge tables not migrated yet) is listed as missing
 * instead of failing the page.
 */
import type { Sql } from "../access/db";
import { LIFECYCLE_EVENTS } from "./events";

export interface FunnelReport {
  days: number;
  since: string;
  /** Per lifecycle event and source: rows, distinct chat sessions, rows with "remind me" consent. */
  events: { name: string; source: string; count: number; sessions: number; consented: number }[];
  /** Newest day first; counts per event name. */
  daily: { day: string; counts: Record<string, number> }[];
  availabilityRequests: { status: string; count: number }[];
  /** Live revenue only from live-mode Stripe sessions (cs_live_); everything else is test or fake. */
  purchases: { productId: string; status: string; count: number; liveCents: number; testCents: number }[];
  emails: { template: string; status: string; count: number }[];
  unavailable: string[];
}

const n = (v: unknown) => Number(v ?? 0) || 0;

export async function funnelReport(db: Sql, days: number, now = new Date()): Promise<FunnelReport> {
  const since = new Date(now.getTime() - days * 864e5).toISOString();
  const unavailable: string[] = [];
  const read = async (table: string, sql: string) => {
    try {
      return await db.query(sql, [since]);
    } catch {
      unavailable.push(table);
      return [];
    }
  };
  const [events, daily, requests, purchases, emails] = await Promise.all([
    read("access_lifecycle_events", `SELECT name, source, COUNT(*) AS count, COUNT(DISTINCT session_id) AS sessions, SUM(consent) AS consented FROM access_lifecycle_events WHERE created_at >= ? GROUP BY name, source`),
    read("access_lifecycle_events", `SELECT substr(created_at, 1, 10) AS day, name, COUNT(*) AS count FROM access_lifecycle_events WHERE created_at >= ? GROUP BY substr(created_at, 1, 10), name`),
    read("concierge_requests", `SELECT status, COUNT(*) AS count FROM concierge_requests WHERE created_at >= ? GROUP BY status`),
    read(
      "access_purchases",
      `SELECT product_id, status, COUNT(*) AS count,
        SUM(CASE WHEN stripe_checkout_session_id LIKE 'cs_live_%' THEN amount_cents - refund_cents ELSE 0 END) AS live_cents,
        SUM(CASE WHEN stripe_checkout_session_id LIKE 'cs_live_%' THEN 0 ELSE amount_cents - refund_cents END) AS test_cents
       FROM access_purchases WHERE created_at >= ? GROUP BY product_id, status`,
    ),
    read("access_lifecycle_emails", `SELECT template, status, COUNT(*) AS count FROM access_lifecycle_emails WHERE created_at >= ? GROUP BY template, status`),
  ]);
  const order = (name: string) => (LIFECYCLE_EVENTS as readonly string[]).indexOf(name);
  const byDay = new Map<string, Record<string, number>>();
  for (const r of daily) {
    const day = String(r.day);
    byDay.set(day, { ...byDay.get(day), [String(r.name)]: n(r.count) });
  }
  return {
    days,
    since,
    events: events
      .map((r) => ({ name: String(r.name), source: String(r.source), count: n(r.count), sessions: n(r.sessions), consented: n(r.consented) }))
      .sort((a, b) => order(a.name) - order(b.name) || a.source.localeCompare(b.source)),
    daily: [...byDay.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([day, counts]) => ({ day, counts })),
    availabilityRequests: requests.map((r) => ({ status: String(r.status), count: n(r.count) })).sort((a, b) => a.status.localeCompare(b.status)),
    purchases: purchases
      .map((r) => ({ productId: String(r.product_id), status: String(r.status), count: n(r.count), liveCents: r.status === "paid" || r.status === "partially_refunded" ? n(r.live_cents) : 0, testCents: r.status === "paid" || r.status === "partially_refunded" ? n(r.test_cents) : 0 }))
      .sort((a, b) => a.productId.localeCompare(b.productId) || a.status.localeCompare(b.status)),
    emails: emails.map((r) => ({ template: String(r.template), status: String(r.status), count: n(r.count) })).sort((a, b) => a.template.localeCompare(b.template) || a.status.localeCompare(b.status)),
    unavailable: [...new Set(unavailable)],
  };
}
