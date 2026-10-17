/**
 * Sales by source (2026-10-17): before raising the Google Ads budget the founder needs cost per sale.
 * Campaign tags from the landing URL live in a first-party cookie; searches record them once; the
 * funnel report groups searches, sales and live revenue by campaign. Tags only, never personal data.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixtureSource } from "@/lib/access/contacts";
import { accessDb, memoryAccessDb } from "@/lib/access/db";
import { activateFromSession, createCheckout, startEventRequest } from "@/lib/access/service";
import { fakeStripe } from "@/lib/access/stripe";
import { ATTRIBUTION_COOKIE, attributionFromUrl, decodeAttribution, encodeAttribution, recordAttribution } from "@/lib/attribution";
import { funnelReport } from "@/lib/lifecycle/report";
import { middleware } from "@/middleware";
import { POST as start } from "@/app/api/access/start/route";

const SITE = "https://carnivalriderental.us";
const EVENT = { email: "planner@fastmail.com", eventDate: "2030-06-01", city: "Riverside", state: "CA", rideType: "kiddie-train" };

describe("campaign tags", () => {
  it("keeps utm source, medium and campaign, normalised; drops click ids and anything else", () => {
    const a = attributionFromUrl(new URLSearchParams("utm_source=Google&utm_medium=CPC&utm_campaign=crr search&gclid=abc123&email=x@y.z"));
    expect(a).toEqual({ source: "google", medium: "cpc", campaign: "crr-search" });
    expect(decodeAttribution(encodeAttribution(a!))).toEqual(a);
    expect(attributionFromUrl(new URLSearchParams("gclid=abc123"))).toBeNull();
    expect(attributionFromUrl(new URLSearchParams("utm_source=<script>"))).toBeNull();
    expect(decodeAttribution("google|cpc|crr-search|extra")).toBeNull();
    expect(decodeAttribution("")).toBeNull();
    expect(decodeAttribution("facebook||")).toEqual({ source: "facebook", medium: null, campaign: null });
  });

  it("the middleware sets the cookie for a tagged landing page only", () => {
    const set = (url: string) => middleware(new NextRequest(url)).cookies.get(ATTRIBUTION_COOKIE);
    const c = set(`${SITE}/?utm_source=google&utm_medium=cpc&utm_campaign=crr-search&gclid=zzz`);
    expect(c?.value).toBe("google|cpc|crr-search");
    expect(c?.httpOnly).toBe(true);
    expect(c?.maxAge).toBe(30 * 86400);
    expect(set(`${SITE}/rides`)).toBeUndefined();
    expect(set(`${SITE}/api/concierge?utm_source=google`)).toBeUndefined();
  });
});

describe("sales by source", () => {
  it("records a search's campaign once and reports searches, sales and live revenue by source", async () => {
    const db = memoryAccessDb();
    const gateway = fakeStripe(SITE);
    const google = await startEventRequest(db, fixtureSource(), EVENT);
    expect(await recordAttribution(db, google.event.id, { source: "google", medium: "cpc", campaign: "crr-search" })).toBe(true);
    await recordAttribution(db, google.event.id, { source: "facebook", medium: null, campaign: null }); // first tags win
    const checkout = await createCheckout(db, gateway, google.event.id, SITE);
    gateway.complete(checkout.purchase.stripeCheckoutSessionId!, "paid");
    await activateFromSession(db, gateway, checkout.purchase.id, checkout.purchase.stripeCheckoutSessionId!, SITE);
    await startEventRequest(db, fixtureSource(), { ...EVENT, email: "other@fastmail.com" }); // untagged

    const r = await funnelReport(db, 30);
    expect(r.unavailable).toEqual([]);
    expect(r.bySource).toContainEqual({ source: "google", medium: "cpc", campaign: "crr-search", searches: 1, sales: 1, liveCents: 0 }); // fake payment: not live revenue
    expect(r.bySource).toContainEqual({ source: "(untagged)", medium: null, campaign: null, searches: 1, sales: 0, liveCents: 0 });
    expect(JSON.stringify(r.bySource)).not.toMatch(/fastmail|Riverside/);
  });

  it("a missing table never breaks a search", async () => {
    const broken = { query: async () => { throw new Error("no such table"); } };
    expect(await recordAttribution(broken, "e1", { source: "google", medium: null, campaign: null })).toBe(false);
  });
});

describe("the web search records the campaign cookie", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    for (const [k, v] of Object.entries({ APP_ENV: "development", DATABASE_PATH: ":memory:", ACCESS_DATABASE_URL: "", ACCESS_SESSION_SECRET: "attribution-test-secret-long-enough-00", ACCESS_OPERATOR_SOURCE: "fixture", ACCESS_RATE_LIMIT: "off" })) vi.stubEnv(k, v);
  });

  it("POST /api/access/start with the cookie stores google / cpc / crr-search for that event request", async () => {
    const form = new FormData();
    for (const [k, v] of Object.entries(EVENT)) form.set(k, v);
    const res = await start(new Request(`${SITE}/api/access/start`, { method: "POST", headers: { origin: SITE, cookie: `${ATTRIBUTION_COOKIE}=google|cpc|crr-search` }, body: form }));
    expect([303, 302, 200]).toContain(res.status);
    const rows = await (await accessDb()).query(`SELECT source, medium, campaign FROM access_attribution`);
    expect(rows).toEqual([{ source: "google", medium: "cpc", campaign: "crr-search" }]);
  });
});
