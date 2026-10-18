/**
 * The private Leads list (/internal/leads, founder request 2026-10-18): every Event Access search
 * with what the customer asked for, what we could offer and what happened next, so the team can
 * follow up by hand (a reply to someone who asked us, not outreach). Customer data only: the email
 * the customer typed and their event details. Never operator identity or contact data, which this
 * module doesn't read. Behind the console login like every /internal page, which is never cached
 * and never sent to analytics (lib/analytics.ts drops /internal).
 */
import type { Row, Sql } from "../access/db";
import { eventTypeNoun } from "../access/event-types";
import { requirementNoun } from "../access/fallback";
import { excludedAddress } from "./engine";
import { CONCIERGE_SOURCE_PATH } from "./events";

/** The founder's own addresses used for QA, on top of the reserved and site domains the engine excludes. */
const TEAM_DOMAINS = ["poolrentalnearme.com"];
export const isTeamAddress = (email: string) => excludedAddress(email) || TEAM_DOMAINS.includes(email.split("@")[1]?.toLowerCase() ?? "");

export type LeadOutcome = "paid" | "refunded" | "checkout_abandoned" | "checkout_open" | "not_bought" | "not_sellable";

export interface Lead {
  id: string;
  createdAt: string;
  email: string;
  team: boolean;
  eventDate: string;
  eventType: string | null;
  city: string;
  state: string;
  zip: string | null;
  ride: string;
  attendance: number | null;
  budgetCents: number | null;
  matched: number;
  sellable: boolean;
  outcome: LeadOutcome;
  /** Live-mode money only (cs_live_ sessions), net of refunds. */
  liveCents: number;
  via: "chat" | "web";
  sourcePath: string | null;
  campaign: { source: string; medium: string | null; campaign: string | null } | null;
  alternativesShown: boolean;
  alternativePicked: boolean;
  manualSearchRequested: boolean;
  /** Lifecycle emails for this request, oldest first: "search_abandonment_1h: sent". */
  emails: string[];
}

const PAID = new Set(["paid", "partially_refunded"]);

function outcomeOf(sellable: boolean, purchases: Row[]): LeadOutcome {
  const statuses = purchases.map((p) => String(p.status));
  if (statuses.some((s) => PAID.has(s))) return "paid";
  if (statuses.includes("refunded")) return "refunded";
  if (statuses.includes("pending")) return "checkout_open";
  if (statuses.length) return "checkout_abandoned";
  return sellable ? "not_bought" : "not_sellable";
}

const byRequest = (rows: Row[], key = "event_request_id") => {
  const m = new Map<string, Row[]>();
  for (const r of rows) m.set(String(r[key]), [...(m.get(String(r[key])) ?? []), r]);
  return m;
};

/** Newest first, from `days` ago, at most `limit` rows. Team test searches are flagged, not dropped. */
export async function leadsReport(db: Sql, days: number, opts: { now?: Date; limit?: number } = {}): Promise<Lead[]> {
  const since = new Date((opts.now ?? new Date()).getTime() - days * 864e5).toISOString();
  const requests = await db.query(
    `SELECT e.*, a.source AS a_source, a.medium AS a_medium, a.campaign AS a_campaign
     FROM access_event_requests e LEFT JOIN access_attribution a ON a.event_request_id = e.id
     WHERE e.created_at >= ? ORDER BY e.created_at DESC LIMIT ?`,
    [since, opts.limit ?? 200],
  );
  if (!requests.length) return [];
  const ids = requests.map((r) => String(r.id));
  const marks = ids.map(() => "?").join(",");
  const [purchases, emails, funnel] = await Promise.all([
    db.query(`SELECT event_request_id, status, amount_cents, refund_cents, stripe_checkout_session_id FROM access_purchases WHERE event_request_id IN (${marks})`, ids),
    db.query(`SELECT event_request_id, template, status, created_at FROM access_lifecycle_emails WHERE event_request_id IN (${marks}) ORDER BY created_at`, ids),
    db.query(`SELECT event_request_id, name FROM access_funnel_events WHERE event_request_id IN (${marks})`, ids),
  ]);
  const pBy = byRequest(purchases), eBy = byRequest(emails), fBy = byRequest(funnel);
  return requests.map((r) => {
    const id = String(r.id);
    const ps = pBy.get(id) ?? [];
    const fs = (fBy.get(id) ?? []).map((f) => String(f.name));
    const sellable = String(r.status) === "matched";
    const email = String(r.email);
    return {
      id,
      createdAt: String(r.created_at),
      email,
      team: isTeamAddress(email),
      eventDate: String(r.event_date),
      eventType: eventTypeNoun(r.event_type ? String(r.event_type) : null),
      city: String(r.city),
      state: String(r.state),
      zip: r.zip ? String(r.zip) : null,
      ride: requirementNoun(r.ride_type ? String(r.ride_type) : null, r.ride_class ? String(r.ride_class) : null),
      attendance: r.attendance === null || r.attendance === undefined ? null : Number(r.attendance),
      budgetCents: r.budget_cents === null || r.budget_cents === undefined ? null : Number(r.budget_cents),
      matched: Number(r.matched_operators) || 0,
      sellable,
      outcome: outcomeOf(sellable, ps),
      liveCents: ps.filter((p) => PAID.has(String(p.status)) && String(p.stripe_checkout_session_id ?? "").startsWith("cs_live_")).reduce((s, p) => s + Number(p.amount_cents) - Number(p.refund_cents ?? 0), 0),
      via: r.source_path === CONCIERGE_SOURCE_PATH ? "chat" : "web",
      sourcePath: r.source_path ? String(r.source_path) : null,
      campaign: r.a_source ? { source: String(r.a_source), medium: r.a_medium ? String(r.a_medium) : null, campaign: r.a_campaign ? String(r.a_campaign) : null } : null,
      alternativesShown: fs.includes("fallback_match_shown"),
      alternativePicked: fs.includes("fallback_match_clicked"),
      manualSearchRequested: fs.includes("manual_search_requested"),
      emails: (eBy.get(id) ?? []).map((m) => `${String(m.template)}: ${String(m.status)}`),
    };
  });
}
