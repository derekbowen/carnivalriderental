/**
 * Stripe for the access fee: our own standard account, Checkout Sessions, no Connect, no payouts.
 * Plain fetch against the REST API (the repo's convention; no SDK). The gateway is an interface so
 * tests and e2e run against a deterministic fake that never touches Stripe.
 *
 * Modes (stripeMode()):
 *   real      STRIPE_SECRET_KEY set (test or live key; the key decides which). Webhooks must be signed.
 *   fake      no key and APP_ENV=development: local/e2e only. Never on a deployed environment.
 *   disabled  no key outside development: the funnel renders, payment is refused.
 */
import crypto from "node:crypto";

export interface CheckoutSession {
  id: string;
  url: string | null;
  paymentStatus: "paid" | "unpaid" | "no_payment_required";
  status: "open" | "complete" | "expired";
  paymentIntentId: string | null;
  purchaseId: string | null;
  amountTotal: number | null;
  currency: string | null;
}
export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}
export interface StripeGateway {
  mode: "real" | "fake";
  createCheckoutSession(p: {
    purchaseId: string;
    email: string;
    amountCents: number;
    currency: string;
    productName: string;
    productDescription: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ id: string; url: string }>;
  retrieveCheckoutSession(id: string): Promise<CheckoutSession | null>;
  /** Verifies the signature and parses the event. Throws on a bad signature. */
  parseWebhook(rawBody: string, signatureHeader: string | null): StripeEvent;
}

export type StripeMode = { kind: "real"; secretKey: string; webhookSecret: string | null; live: boolean } | { kind: "fake" } | { kind: "disabled"; reason: string };

export function stripeMode(env: Record<string, string | undefined> = process.env): StripeMode {
  const key = env.STRIPE_SECRET_KEY;
  if (key) {
    if (!/^(sk|rk)_(test|live)_/.test(key)) return { kind: "disabled", reason: "STRIPE_SECRET_KEY has an unexpected format" };
    return { kind: "real", secretKey: key, webhookSecret: env.STRIPE_WEBHOOK_SECRET || null, live: key.includes("_live_") };
  }
  if ((env.APP_ENV || "development") === "development") return { kind: "fake" };
  return { kind: "disabled", reason: "STRIPE_SECRET_KEY is not set; Event Access cannot take payment on this environment" };
}

// ------------------------------------------------------------------------------ real
const API = "https://api.stripe.com/v1";

function form(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((item, i) => out.push(...(typeof item === "object" ? form(item as Record<string, unknown>, `${key}[${i}]`) : [`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`])));
    else if (typeof v === "object") out.push(...form(v as Record<string, unknown>, key));
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

function toSession(s: Record<string, unknown>): CheckoutSession {
  const pi = s.payment_intent;
  return {
    id: String(s.id),
    url: typeof s.url === "string" ? s.url : null,
    paymentStatus: (s.payment_status as CheckoutSession["paymentStatus"]) ?? "unpaid",
    status: (s.status as CheckoutSession["status"]) ?? "open",
    paymentIntentId: typeof pi === "string" ? pi : pi && typeof pi === "object" ? String((pi as { id: string }).id) : null,
    purchaseId: typeof s.client_reference_id === "string" ? s.client_reference_id : null,
    amountTotal: typeof s.amount_total === "number" ? s.amount_total : null,
    currency: typeof s.currency === "string" ? s.currency : null,
  };
}

/** Stripe-Signature: t=<ts>,v1=<hmac>. Constant-time compare; 5-minute tolerance. */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, now = Date.now()): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=") as [string, string]));
  const t = parts.t;
  const v1s = header.split(",").map((p) => p.trim()).filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || v1s.length === 0) return false;
  if (Math.abs(now / 1000 - Number(t)) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return v1s.some((v) => v.length === expected.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(expected)));
}

export function realStripe(secretKey: string, webhookSecret: string | null): StripeGateway {
  const call = async (method: "GET" | "POST", path: string, body?: Record<string, unknown>, idempotencyKey?: string) => {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: body ? form(body).join("&") : undefined,
      signal: AbortSignal.timeout(15000),
    });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) {
      const err = (json?.error as { message?: string; type?: string } | undefined) ?? {};
      throw new Error(`Stripe ${method} ${path} failed (HTTP ${res.status}${err.type ? ` ${err.type}` : ""})`);
    }
    return json ?? {};
  };
  return {
    mode: "real",
    async createCheckoutSession(p) {
      const s = await call(
        "POST",
        "/checkout/sessions",
        {
          mode: "payment",
          client_reference_id: p.purchaseId,
          customer_email: p.email,
          success_url: p.successUrl,
          cancel_url: p.cancelUrl,
          line_items: [{ quantity: 1, price_data: { currency: p.currency, unit_amount: p.amountCents, product_data: { name: p.productName, description: p.productDescription } } }],
          metadata: { purchase_id: p.purchaseId },
          payment_intent_data: { metadata: { purchase_id: p.purchaseId } },
          expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
        },
        `checkout:${p.purchaseId}`,
      );
      return { id: String(s.id), url: String(s.url) };
    },
    async retrieveCheckoutSession(id) {
      try {
        return toSession(await call("GET", `/checkout/sessions/${encodeURIComponent(id)}`));
      } catch {
        return null;
      }
    },
    parseWebhook(rawBody, signatureHeader) {
      if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
      if (!verifyStripeSignature(rawBody, signatureHeader, webhookSecret)) throw new Error("invalid Stripe signature");
      const e = JSON.parse(rawBody) as StripeEvent;
      if (!e?.id || !e?.type || !e?.data?.object) throw new Error("malformed Stripe event");
      return e;
    },
  };
}

// ------------------------------------------------------------------------------ fake
/** Deterministic in-process Stripe for local development, unit tests and e2e. */
export function fakeStripe(_siteUrl = ""): StripeGateway & { complete(id: string, outcome?: "paid" | "expired"): CheckoutSession | null; sessions: Map<string, CheckoutSession & { successUrl: string; cancelUrl: string }> } {
  const sessions = new Map<string, CheckoutSession & { successUrl: string; cancelUrl: string }>();
  return {
    mode: "fake",
    sessions,
    async createCheckoutSession(p) {
      const id = `cs_test_fake_${crypto.randomBytes(8).toString("hex")}`;
      const url = `/api/access/dev-checkout?cs=${id}`; // relative: the stand-in page lives on this app
      sessions.set(id, { id, url, paymentStatus: "unpaid", status: "open", paymentIntentId: null, purchaseId: p.purchaseId, amountTotal: p.amountCents, currency: p.currency, successUrl: p.successUrl, cancelUrl: p.cancelUrl });
      return { id, url };
    },
    async retrieveCheckoutSession(id) {
      return sessions.get(id) ?? null;
    },
    complete(id, outcome = "paid") {
      const s = sessions.get(id);
      if (!s) return null;
      if (outcome === "paid") Object.assign(s, { paymentStatus: "paid", status: "complete", paymentIntentId: `pi_fake_${id.slice(-8)}` });
      else Object.assign(s, { status: "expired" });
      return s;
    },
    parseWebhook(rawBody, signatureHeader) {
      if (signatureHeader !== "fake") throw new Error("fake gateway expects stripe-signature: fake");
      return JSON.parse(rawBody) as StripeEvent;
    },
  };
}

const g = globalThis as unknown as { __stripeFake?: ReturnType<typeof fakeStripe> };
export function stripeGateway(siteUrl: string): StripeGateway {
  const m = stripeMode();
  if (m.kind === "real") return realStripe(m.secretKey, m.webhookSecret);
  if (m.kind === "fake") return (g.__stripeFake ??= fakeStripe(siteUrl));
  throw new Error(m.reason);
}
export const fakeGatewayInstance = () => g.__stripeFake ?? null;
