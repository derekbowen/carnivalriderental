/**
 * Email outbox: enqueue (synchronous, inside the caller's DB transaction) and dispatch (async, via
 * Resend). Guarantees:
 * - Each logical email has a dedupe key; enqueueing it twice is a no-op, so retries never double-send.
 * - EMAIL_MODE=test (default) redirects every email to the test inbox and names the intended recipient.
 * - Outreach is dropped as "suppressed" for unsubscribed addresses, held as "blocked" unless its
 *   campaign is approved (live mode), and capped per UTC day by the warm-up schedule.
 * - Sends carry an Idempotency-Key (the outbox id) so a retried request can't send twice at Resend.
 */
import crypto from "node:crypto";
import type { Db } from "../requests/db";
import { emailConfig, type EmailConfig } from "./config";
import type { Rendered } from "./templates";

export type EmailKind = "transactional" | "outreach";
export type OutboxStatus = "pending" | "sent" | "failed" | "suppressed" | "blocked";

export interface OutboxRow {
  id: string;
  kind: EmailKind;
  template: string;
  campaign: string | null;
  dedupe_key: string;
  to_email: string;
  subject: string;
  html: string;
  text: string;
  reply_to: string | null;
  unsubscribe_url: string | null;
  request_id: string | null;
  status: OutboxStatus;
  attempts: number;
  sent_mode: string | null;
  delivered_to: string | null;
  provider_id: string | null;
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const normalizeEmail = (e: string) => e.trim().toLowerCase();

export function enqueue(
  db: Db,
  e: { kind: EmailKind; template: string; dedupeKey: string; to: string; content: Rendered; campaign?: string; replyTo?: string; unsubscribeUrl?: string; requestId?: string },
): { queued: boolean } {
  const to = normalizeEmail(e.to);
  if (!EMAIL_RE.test(to)) return { queued: false };
  if (e.kind === "outreach" && !e.unsubscribeUrl) throw new Error("Outreach email needs an unsubscribe link");
  const res = db
    .prepare(
      `INSERT OR IGNORE INTO email_outbox
         (id, kind, template, campaign, dedupe_key, to_email, subject, html, text, reply_to, unsubscribe_url, request_id, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    )
    .run(crypto.randomUUID(), e.kind, e.template, e.campaign ?? null, e.dedupeKey, to, e.content.subject, e.content.html, e.content.text, e.replyTo ?? null, e.unsubscribeUrl ?? null, e.requestId ?? null, new Date().toISOString());
  return { queued: Number(res.changes) > 0 };
}

// ------------------------------------------------------------------------------- unsubscribe

export function unsubscribeToken(email: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`unsub:${normalizeEmail(email)}`).digest("base64url").slice(0, 32);
}

export function verifyUnsubscribe(email: string, token: string, secret: string): boolean {
  const a = Buffer.from(unsubscribeToken(email, secret));
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function unsubscribeUrl(siteUrl: string, email: string, secret: string): string {
  return `${siteUrl}/api/email/unsubscribe?e=${encodeURIComponent(normalizeEmail(email))}&t=${unsubscribeToken(email, secret)}`;
}

export function suppress(db: Db, email: string, reason: string): void {
  db.prepare(`INSERT OR IGNORE INTO email_suppressions (email, reason, created_at) VALUES (?, ?, ?)`).run(normalizeEmail(email), reason, new Date().toISOString());
}

export function isSuppressed(db: Db, email: string): boolean {
  return !!db.prepare(`SELECT 1 FROM email_suppressions WHERE email = ?`).get(normalizeEmail(email));
}

// ------------------------------------------------------------------------------- dispatch

export type SendFn = (body: Record<string, unknown>, idempotencyKey: string) => Promise<{ id: string }>;

/** Resend HTTP API. */
export function resendSender(apiKey: string): SendFn {
  return async (body, idempotencyKey) => {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const json = (await res.json().catch(() => null)) as { id?: string; message?: string; name?: string } | null;
    if (!res.ok || !json?.id) throw new Error(`Resend HTTP ${res.status}${json?.name ? ` (${json.name})` : ""}`);
    return { id: json.id };
  };
}

export interface DispatchResult {
  sent: number;
  failed: number;
  suppressed: number;
  blocked: number;
  deferred: number;
}

/** Outreach sent today, and the number of distinct earlier UTC days with outreach sends (warm-up day index). */
function warmupState(db: Db, today: string) {
  const sentToday = Number((db.prepare(`SELECT COUNT(*) AS n FROM email_outbox WHERE kind = 'outreach' AND status = 'sent' AND substr(sent_at, 1, 10) = ?`).get(today) as { n: number }).n);
  const priorDays = Number((db.prepare(`SELECT COUNT(DISTINCT substr(sent_at, 1, 10)) AS n FROM email_outbox WHERE kind = 'outreach' AND status = 'sent' AND substr(sent_at, 1, 10) < ?`).get(today) as { n: number }).n);
  return { sentToday, priorDays };
}

export async function dispatchOutbox(
  db: Db,
  opts: { send: SendFn; config?: EmailConfig; limit?: number; now?: () => Date; pauseMs?: number },
): Promise<DispatchResult> {
  const cfg = opts.config ?? emailConfig();
  const now = opts.now ?? (() => new Date());
  const result: DispatchResult = { sent: 0, failed: 0, suppressed: 0, blocked: 0, deferred: 0 };
  const rows = db.prepare(`SELECT * FROM email_outbox WHERE status IN ('pending', 'failed') AND attempts < 5 ORDER BY created_at LIMIT ?`).all(opts.limit ?? 100) as unknown as OutboxRow[];
  const mark = (id: string, fields: Partial<OutboxRow>) => {
    const keys = Object.keys(fields);
    db.prepare(`UPDATE email_outbox SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`).run(...keys.map((k) => (fields as Record<string, string | number | null>)[k]), id);
  };

  for (const row of rows) {
    if (row.kind === "outreach") {
      if (isSuppressed(db, row.to_email)) {
        mark(row.id, { status: "suppressed" });
        result.suppressed++;
        continue;
      }
      if (cfg.mode === "live" && (!row.campaign || !cfg.approvedCampaigns.includes(row.campaign))) {
        mark(row.id, { status: "blocked", error: `campaign ${row.campaign ?? "(none)"} not in EMAIL_APPROVED_CAMPAIGNS` });
        result.blocked++;
        continue;
      }
      const today = now().toISOString().slice(0, 10);
      const { sentToday, priorDays } = warmupState(db, today);
      const cap = cfg.warmupDailyCaps[Math.min(priorDays, cfg.warmupDailyCaps.length - 1)];
      if (sentToday >= cap) {
        result.deferred++;
        continue;
      }
    }

    const live = cfg.mode === "live";
    const to = live ? row.to_email : cfg.testRecipient;
    const body: Record<string, unknown> = {
      from: row.kind === "outreach" ? cfg.fromOutreach : cfg.fromTransactional,
      to: [to],
      subject: live ? row.subject : `[TEST → ${row.to_email}] ${row.subject}`,
      html: row.html,
      text: row.text,
      ...(row.reply_to ? { reply_to: row.reply_to } : {}),
      ...(row.unsubscribe_url ? { headers: { "List-Unsubscribe": `<${row.unsubscribe_url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } } : {}),
      tags: [{ name: "template", value: row.template.replace(/[^A-Za-z0-9_-]/g, "_") }],
    };
    try {
      const r = await opts.send(body, row.id);
      mark(row.id, { status: "sent", attempts: row.attempts + 1, sent_mode: cfg.mode, delivered_to: to, provider_id: r.id, error: null, sent_at: now().toISOString() });
      result.sent++;
    } catch (e) {
      mark(row.id, { status: "failed", attempts: row.attempts + 1, error: String((e as Error).message).slice(0, 300) });
      result.failed++;
    }
    if (opts.pauseMs) await new Promise((r) => setTimeout(r, opts.pauseMs));
  }
  return result;
}
