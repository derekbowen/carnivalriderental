import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { accessStorageMode } from "@/lib/access/db";
import { accessAvailability, rateLimited } from "@/lib/access/runtime";
import { decodeSession, encodeSession } from "@/lib/access/session";
import { realStripe, stripeMode, verifyStripeSignature } from "@/lib/access/stripe";

const sig = (body: string, secret: string, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;

describe("Stripe webhook signatures", () => {
  const secret = "whsec_test_secret";
  const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_1" } } });
  it("accepts a valid v1 signature and rejects tampering, replay and missing headers", () => {
    expect(verifyStripeSignature(body, sig(body, secret), secret)).toBe(true);
    expect(verifyStripeSignature(`${body} `, sig(body, secret), secret)).toBe(false);
    expect(verifyStripeSignature(body, sig(body, "other"), secret)).toBe(false);
    expect(verifyStripeSignature(body, sig(body, secret, Math.floor(Date.now() / 1000) - 3600), secret)).toBe(false);
    expect(verifyStripeSignature(body, null, secret)).toBe(false);
    const gw = realStripe("sk_test_x", secret);
    expect(gw.parseWebhook(body, sig(body, secret)).id).toBe("evt_1");
    expect(() => gw.parseWebhook(body, "t=1,v1=bad")).toThrow(/signature/);
    expect(() => realStripe("sk_test_x", null).parseWebhook(body, sig(body, secret))).toThrow(/STRIPE_WEBHOOK_SECRET/);
  });
});

describe("environment safety", () => {
  it("fake Stripe and SQLite are allowed only in development; production needs real keys and Postgres", () => {
    expect(stripeMode({ APP_ENV: "development" }).kind).toBe("fake");
    expect(stripeMode({ APP_ENV: "preview" }).kind).toBe("disabled");
    expect(stripeMode({ APP_ENV: "production" }).kind).toBe("disabled");
    expect(stripeMode({ APP_ENV: "production", STRIPE_SECRET_KEY: "sk_live_abc" })).toMatchObject({ kind: "real", live: true });
    expect(stripeMode({ STRIPE_SECRET_KEY: "pk_test_abc" }).kind).toBe("disabled");
    expect(accessStorageMode({ APP_ENV: "development" }).kind).toBe("sqlite");
    expect(accessStorageMode({ APP_ENV: "production" }).kind).toBe("disabled");
    expect(accessStorageMode({ APP_ENV: "production", ACCESS_DATABASE_URL: "postgres://x" }).kind).toBe("postgres");
    const prod = accessAvailability({ APP_ENV: "production", ACCESS_DATABASE_URL: "postgres://x", STRIPE_SECRET_KEY: "sk_test_x", ACCESS_SESSION_SECRET: "0123456789abcdef0123", SHARETRIBE_INTEGRATION_CLIENT_ID: "a", SHARETRIBE_INTEGRATION_CLIENT_SECRET: "b" });
    expect(prod.enabled).toBe(true);
    expect(accessAvailability({ APP_ENV: "production", ACCESS_DATABASE_URL: "postgres://x", STRIPE_SECRET_KEY: "sk_test_x", ACCESS_SESSION_SECRET: "0123456789abcdef0123", ACCESS_OPERATOR_SOURCE: "fixture" }).enabled).toBe(false);
    expect(accessAvailability({ APP_ENV: "preview" }).enabled).toBe(false);
  });
});

describe("pass session cookie", () => {
  it("round-trips, is bound to pass ids, and rejects forgery or expiry", () => {
    const secret = "0123456789abcdef0123456789abcdef";
    const id = "11111111-1111-4111-8111-111111111111";
    const v = encodeSession([id], secret);
    expect(decodeSession(v, secret)).toEqual([id]);
    expect(decodeSession(v, "wrong-secret-wrong-secret")).toEqual([]);
    expect(decodeSession(`${v}x`, secret)).toEqual([]);
    expect(decodeSession(v, secret, Date.now() + 40 * 864e5)).toEqual([]);
    expect(decodeSession(encodeSession(["nope"], secret), secret)).toEqual([]);
  });
});

describe("rate limiter", () => {
  it("blocks after the window's quota", () => {
    const k = `k${Math.random()}`;
    for (let i = 0; i < 3; i++) expect(rateLimited(k, 3, 1000)).toBe(false);
    expect(rateLimited(k, 3, 1000)).toBe(true);
    expect(rateLimited(k, 3, 1000, Date.now() + 2000)).toBe(false);
  });
});
