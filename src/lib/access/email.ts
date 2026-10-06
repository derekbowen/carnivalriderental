/**
 * Pass emails: sent immediately through the configured provider (not the SQLite outbox, which is
 * not durable on Vercel). EMAIL_MODE=test redirects to the test inbox exactly like the outbox does.
 * Failures are logged, never thrown: a paid pass must not depend on email delivery.
 */
import crypto from "node:crypto";
import { BRAND } from "../config";
import { emailConfig } from "../email/config";
import { senderFor } from "../email/outbox";

/** Deterministic UUID-shaped idempotency key (the providers reject free-form keys). */
export const idempotencyUuid = (logicalKey: string) => {
  const h = crypto.createHash("sha256").update(logicalKey).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function passEmail(p: { passUrl: string; productName: string; unlockLimit: number; matched: number; expiresOn: string; eventSummary: string }): { subject: string; html: string; text: string } {
  const lines = [
    `Thanks for buying ${p.productName} from ${BRAND.name}.`,
    `Your event: ${p.eventSummary}.`,
    `We matched ${p.matched} independent operator${p.matched === 1 ? "" : "s"} with relevant equipment near your event. You can unlock up to ${p.unlockLimit} of them until ${p.expiresOn}.`,
    `Open your pass: ${p.passUrl}`,
    "Keep this email. The link opens your pass on any device and shows the operators you've already unlocked.",
    "Pricing, availability, contracts and payment for the rental are between you and each operator. We don't take part in the rental and can't guarantee that an operator is free on your date.",
  ];
  const html = `<!doctype html><html><body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;line-height:1.5;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px">${lines
    .map((l) => (l.startsWith("Open your pass:") ? `<p><a href="${esc(p.passUrl)}" style="display:inline-block;background:#f5b400;color:#0b1b3f;font-weight:700;padding:12px 18px;border-radius:8px;text-decoration:none">Open your pass</a></p>` : `<p>${esc(l)}</p>`))
    .join("")}<hr style="border:none;border-top:1px solid #ddd;margin:24px 0"><p style="font-size:12px;color:#666">${esc(BRAND.name)} is owned and operated by ${esc(BRAND.legalEntity)}.</p></body></html>`;
  return { subject: `Your ${p.productName} pass`, html, text: [...lines, "--", `${BRAND.name} is owned and operated by ${BRAND.legalEntity}.`].join("\n\n") };
}

export function magicLinkEmail(p: { passUrl: string; productName: string }): { subject: string; html: string; text: string } {
  const text = `Here is the link to open your ${p.productName} pass on ${BRAND.name}:\n\n${p.passUrl}\n\nIf you didn't ask for this, ignore this email.`;
  return { subject: `Open your ${p.productName} pass`, html: `<p>Here is the link to open your ${esc(p.productName)} pass on ${esc(BRAND.name)}:</p><p><a href="${esc(p.passUrl)}">${esc(p.passUrl)}</a></p><p>If you didn't ask for this, ignore this email.</p>`, text };
}

export async function sendNow(to: string, content: { subject: string; html: string; text: string }, idempotencyKey: string): Promise<{ sent: boolean; deliveredTo: string | null; error?: string }> {
  const cfg = emailConfig();
  if (!cfg.apiKey) return { sent: false, deliveredTo: null, error: "email provider not configured" };
  const live = cfg.mode === "live";
  const deliveredTo = live ? to : cfg.testRecipient;
  try {
    await senderFor(cfg)({ from: cfg.fromTransactional, to: [deliveredTo], subject: live ? content.subject : `[TEST → ${to}] ${content.subject}`, html: content.html, text: content.text, reply_to: cfg.replyTo }, idempotencyUuid(idempotencyKey));
    return { sent: true, deliveredTo };
  } catch (e) {
    console.error("[access] email send failed:", (e as Error).message);
    return { sent: false, deliveredTo, error: (e as Error).message };
  }
}
