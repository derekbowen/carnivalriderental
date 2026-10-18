/**
 * Console status pills report the real Event Access payments and email setup (founder 2026-10-18:
 * the old hardcoded "demo adapter" / "not configured" labels were wrong once Stripe and email went
 * live). Stripe is "connected" only after a read-only round trip; email reports its mode, not
 * "connected", because a key can only be proven by sending.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ENV = { APP_ENV: "development", DATABASE_PATH: ":memory:", ACCESS_DATABASE_URL: "", ACCESS_SESSION_SECRET: "integration-status-test-secret-0000", SHARETRIBE_INTEGRATION_CLIENT_ID: "", SHARETRIBE_INTEGRATION_CLIENT_SECRET: "", SHARETRIBE_CLIENT_ID: "" };

async function statuses(env: Record<string, string>, stripeOk = true) {
  vi.resetModules();
  for (const [k, v] of Object.entries({ ...ENV, ...env })) vi.stubEnv(k, v);
  const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => (String(url).startsWith("https://api.stripe.com/") ? new Response(stripeOk ? '{"data":[]}' : '{"error":{"type":"invalid_request_error"}}', { status: stripeOk ? 200 : 401 }) : new Response("{}", { status: 500 })));
  vi.stubGlobal("fetch", fetchMock);
  const { integrationStatuses } = await import("@/lib/integrations/status");
  const all = await integrationStatuses();
  return { payments: all.find((s) => s.name === "Payments")!, email: all.find((s) => s.name === "Email")!, fetchMock };
}

describe("console integration status", () => {
  beforeEach(() => vi.unstubAllEnvs());
  afterEach(() => vi.unstubAllGlobals());

  it("live Stripe key that answers, live email with a key: both green, with ledger evidence", async () => {
    const { payments, email, fetchMock } = await statuses({ STRIPE_SECRET_KEY: "sk_live_status_test", STRIPE_WEBHOOK_SECRET: "whsec_x", EMAIL_MODE: "live", EMAIL_PROVIDER: "emailit", EMAILIT_API_KEY: "em_test", BUSINESS_POSTAL_ADDRESS: "100 Test St" });
    expect(payments).toMatchObject({ label: "Stripe live · connected", tone: "ok" });
    expect(payments.detail).toMatch(/Webhooks received: 0 .* Live sales: 0\./);
    expect(email).toMatchObject({ label: "Emailit · live", tone: "ok" });
    expect(email.detail).toContain("Follow-up emails sent: 0");
    // The Stripe check is a read-only GET.
    const stripeCall = fetchMock.mock.calls.find(([u]) => String(u).startsWith("https://api.stripe.com/"))!;
    expect(String(stripeCall[0])).toBe("https://api.stripe.com/v1/checkout/sessions?limit=1");
    expect(stripeCall[1]?.method ?? "GET").toBe("GET");
  });

  it("a key Stripe rejects, or a missing webhook secret, is red", async () => {
    expect((await statuses({ STRIPE_SECRET_KEY: "sk_live_bad", STRIPE_WEBHOOK_SECRET: "whsec_x" }, false)).payments).toMatchObject({ label: "Stripe live · check failed", tone: "bad" });
    expect((await statuses({ STRIPE_SECRET_KEY: "sk_live_nohook", STRIPE_WEBHOOK_SECRET: "" })).payments).toMatchObject({ label: "Stripe live · no webhook secret", tone: "bad" });
  });

  it("no Stripe key on production: checkout closed; test email mode and a missing key say so", async () => {
    const prod = await statuses({ APP_ENV: "production", STRIPE_SECRET_KEY: "", EMAIL_MODE: "live", EMAIL_PROVIDER: "resend", RESEND_API_KEY: "", EMAILIT_API_KEY: "" });
    expect(prod.payments).toMatchObject({ label: "checkout closed", tone: "bad" });
    expect(prod.email).toMatchObject({ label: "no API key", tone: "bad" });
    const test = await statuses({ STRIPE_SECRET_KEY: "", EMAIL_MODE: "test", EMAIL_PROVIDER: "resend", RESEND_API_KEY: "re_x" });
    expect(test.payments).toMatchObject({ label: "fake checkout (local only)", tone: "neutral" });
    expect(test.email).toMatchObject({ label: "Resend · test mode", tone: "neutral" });
  });
});
