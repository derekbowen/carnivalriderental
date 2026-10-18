import { accessDb } from "../access/db";
import { stripeCheck, stripeMode } from "../access/stripe";
import { emailConfig } from "../email/config";
import { sharetribeConnection } from "./sharetribe";

/**
 * Honest integration status for the internal console. "Connected" is reported only
 * after a verified API round-trip, never from the mere presence of env vars. Payments and
 * email are the Event Access ones (lib/access); the ledger supplies the evidence that they
 * actually ran (last webhook, live sales, follow-ups sent).
 */
export interface IntegrationStatus {
  name: string;
  label: string;
  tone: "ok" | "neutral" | "bad";
  detail: string;
}

const CACHE_MS = 10 * 60 * 1000;
let stripeCache: { at: number; key: string; value: Awaited<ReturnType<typeof stripeCheck>> } | null = null;

const when = (iso: unknown) => (iso ? `${String(iso).slice(0, 16).replace("T", " ")} UTC` : "never");

/** What the ledger shows actually happened. Best effort: null when the ledger isn't reachable here. */
async function ledgerEvidence() {
  try {
    const db = await accessDb();
    const [hook, sales, mail] = await Promise.all([
      db.query(`SELECT COUNT(*) AS n, MAX(received_at) AS last FROM access_stripe_events`),
      db.query(`SELECT COUNT(*) AS n FROM access_purchases WHERE status IN ('paid', 'partially_refunded') AND stripe_checkout_session_id LIKE 'cs_live_%'`),
      db.query(`SELECT COUNT(*) AS n, MAX(updated_at) AS last FROM access_lifecycle_emails WHERE status = 'sent'`),
    ]);
    return { webhooks: Number(hook[0]?.n) || 0, lastWebhook: hook[0]?.last ?? null, liveSales: Number(sales[0]?.n) || 0, followUps: Number(mail[0]?.n) || 0, lastFollowUp: mail[0]?.last ?? null };
  } catch {
    return null;
  }
}

async function paymentsStatus(ev: Awaited<ReturnType<typeof ledgerEvidence>>, production: boolean): Promise<IntegrationStatus> {
  const name = "Payments";
  const mode = stripeMode();
  if (mode.kind === "fake") return { name, label: "fake checkout (local only)", tone: "neutral", detail: "No Stripe key in development: checkout uses the built-in fake. No money moves." };
  if (mode.kind === "disabled") return { name, label: "checkout closed", tone: production ? "bad" : "neutral", detail: mode.reason };
  if (!stripeCache || stripeCache.key !== mode.secretKey.slice(-8) || Date.now() - stripeCache.at > CACHE_MS) stripeCache = { at: Date.now(), key: mode.secretKey.slice(-8), value: await stripeCheck(mode.secretKey) };
  const check = stripeCache.value;
  const kind = mode.live ? "live" : "test";
  const evidence = ev ? ` Webhooks received: ${ev.webhooks} (last ${when(ev.lastWebhook)}). Live sales: ${ev.liveSales}.` : "";
  if (!check.ok) return { name, label: `Stripe ${kind} · check failed`, tone: "bad", detail: `${check.detail}.${evidence}` };
  if (!mode.webhookSecret) return { name, label: `Stripe ${kind} · no webhook secret`, tone: "bad", detail: `The key works, but STRIPE_WEBHOOK_SECRET is not set, so payments can't be confirmed by webhook.${evidence}` };
  return { name, label: `Stripe ${kind} · connected`, tone: mode.live ? "ok" : "neutral", detail: `Event Access checkout on our own Stripe account; key verified with a read-only call.${evidence}` };
}

function emailStatus(ev: Awaited<ReturnType<typeof ledgerEvidence>>, production: boolean): IntegrationStatus {
  const name = "Email";
  const cfg = emailConfig();
  const provider = cfg.provider === "emailit" ? "Emailit" : "Resend";
  if (!cfg.apiKey) return { name, label: "no API key", tone: production ? "bad" : "neutral", detail: `${provider} is selected but its API key is not set: pass and follow-up emails are not sent.` };
  const evidence = ev ? ` Follow-up emails sent: ${ev.followUps} (last ${when(ev.lastFollowUp)}).` : "";
  // A key can only be proven by sending; this check doesn't send, so it reports the setup, not "connected".
  if (cfg.mode === "test") return { name, label: `${provider} · test mode`, tone: "neutral", detail: `Every email goes to ${cfg.testRecipient}, not the customer.${evidence}` };
  return { name, label: `${provider} · live`, tone: "ok", detail: `Pass, sign-in and follow-up emails go to customers from ${cfg.fromTransactional}.${cfg.postalAddress ? "" : " No postal address set, so follow-ups are held."}${evidence}` };
}

export async function integrationStatuses(): Promise<IntegrationStatus[]> {
  const production = process.env.APP_ENV === "production";
  const [st, ev] = await Promise.all([sharetribeConnection(), ledgerEvidence()]);
  return [
    {
      name: "Sharetribe",
      label:
        st.state === "connected-readonly"
          ? `read-only connected · ${st.marketplaceName}${st.marketplaceApi === "verified" ? " · both APIs" : ""}`
          : st.state === "not-configured"
            ? "not configured"
            : "check failed",
      tone: st.state === "connected-readonly" ? "ok" : st.state === "error" ? "bad" : "neutral",
      detail: `${st.detail} Marketplace API client: ${st.marketplaceApi}. (checked ${st.checkedAt.slice(0, 16).replace("T", " ")} UTC)`,
    },
    await paymentsStatus(ev, production),
    emailStatus(ev, production),
  ];
}
