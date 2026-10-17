/**
 * Tracking (2026-10-17): cookieless Vercel Web Analytics that never sees per-customer identifiers or
 * tokens, and a private funnel dashboard built from what the ledger already records, aggregates only.
 */
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { fixtureSource } from "@/lib/access/contacts";
import { memoryAccessDb } from "@/lib/access/db";
import { activateFromSession, createCheckout } from "@/lib/access/service";
import { fakeStripe } from "@/lib/access/stripe";
import { analyticsUrl } from "@/lib/analytics";
import { emptyLead } from "@/lib/concierge/defaults";
import { captureEmail, conversation, recordSearch, saveLead, searchRides } from "@/lib/concierge/service";
import { emailConfig } from "@/lib/email/config";
import { funnelReport } from "@/lib/lifecycle/report";

const SITE = "https://carnivalriderental.us";

describe("analytics URLs", () => {
  it("keeps campaign tags, drops every other parameter and the hash", () => {
    expect(analyticsUrl(`${SITE}/rides?utm_source=google&utm_medium=cpc&utm_campaign=fall&gclid=abc&near=43215#top`)).toBe(`${SITE}/rides?utm_source=google&utm_medium=cpc&utm_campaign=fall`);
    expect(analyticsUrl(`${SITE}/s?type=ferris-wheel&near=Columbus%2C%20OH`)).toBe(`${SITE}/s`);
  });

  it("counts private pages by route, never by id or token, and skips the console", () => {
    expect(analyticsUrl(`${SITE}/pass/0b7c2a7e-1111-4222-8333-444455556666`)).toBe(`${SITE}/pass/[id]`);
    expect(analyticsUrl(`${SITE}/pass/open?token=secret-magic-token`)).toBe(`${SITE}/pass/open`);
    expect(analyticsUrl(`${SITE}/pass/recover`)).toBe(`${SITE}/pass/recover`);
    expect(analyticsUrl(`${SITE}/connect/0b7c2a7e-1111-4222-8333-444455556666?paid=1`)).toBe(`${SITE}/connect/[id]`);
    expect(analyticsUrl(`${SITE}/requests/CR-1234`)).toBe(`${SITE}/requests/[reference]`);
    expect(analyticsUrl(`${SITE}/internal/funnel`)).toBeNull();
    expect(analyticsUrl(`${SITE}/api/concierge`)).toBeNull();
    expect(analyticsUrl("not a url")).toBeNull();
  });

  it("is rendered on production only, through the plain React integration", () => {
    expect(fs.readFileSync("src/app/layout.tsx", "utf8")).toMatch(/appEnv\(\) === "production" && <SiteAnalytics \/>/);
    const component = fs.readFileSync("src/components/SiteAnalytics.tsx", "utf8");
    expect(component).toContain('from "@vercel/analytics/react"');
    expect(component).toContain("beforeSend={beforeSend}");
    expect(fs.readFileSync("src/app/privacy/page.tsx", "utf8")).toContain("Vercel Web Analytics");
  });
});

describe("funnel report", () => {
  it("counts events, sessions, consent and purchases without any email address or contact", async () => {
    const db = memoryAccessDb();
    const rt = { db, source: fixtureSource(), gateway: fakeStripe(SITE), siteUrl: SITE };
    const deps = { cfg: emailConfig({ EMAIL_MODE: "test" }), send: async () => ({ id: "msg-1" }), siteUrl: SITE, personalize: null };
    const { session } = await conversation(db);
    await saveLead(db, session, { ...emptyLead, eventDate: "2030-06-01", city: "Riverside", state: "CA", requestedRides: [{ rideType: "kiddie-train", quantity: 1 }] });
    await recordSearch(db, session, searchRides(session.details, "kiddie-train").total);
    const captured = await captureEmail(rt, session, "planner@fastmail.com", true, deps);
    const checkout = await createCheckout(db, rt.gateway, captured.eventId!, SITE);
    rt.gateway.complete(checkout.purchase.stripeCheckoutSessionId!, "paid");
    await activateFromSession(db, rt.gateway, checkout.purchase.id, checkout.purchase.stripeCheckoutSessionId!, SITE);

    const r = await funnelReport(db, 30);
    expect(r.unavailable).toEqual([]);
    const ev = (name: string) => r.events.find((e) => e.name === name && e.source === "chat");
    expect(ev("chat_started")).toMatchObject({ count: 1, sessions: 1 });
    expect(ev("email_capture_offered")?.count).toBe(1);
    expect(ev("email_capture_accepted")).toMatchObject({ count: 1, consented: 1 });
    expect(r.events.map((e) => e.name)).toContain("event_access_purchased");
    expect(r.daily[0].counts.chat_started).toBe(1);
    // A fake (or test-mode) payment is never counted as revenue.
    const paid = r.purchases.find((p) => p.status === "paid")!;
    expect(paid).toMatchObject({ count: 1, liveCents: 0 });
    expect(paid.testCents).toBeGreaterThan(0);
    expect(JSON.stringify(r)).not.toMatch(/planner@|fastmail|Fixture Amusements|555 010 00|Riverside/);
    expect((await funnelReport(db, 30, new Date(Date.now() + 40 * 864e5))).events).toEqual([]);
  });

  it("a missing table is reported, not fatal", async () => {
    const db = { engine: "sqlite", query: async (sql: string) => { if (/concierge_requests/.test(sql)) throw new Error("no such table"); return []; } } as unknown as Parameters<typeof funnelReport>[0];
    expect((await funnelReport(db, 7)).unavailable).toEqual(["concierge_requests"]);
  });

  it("the dashboard lives behind the internal console's auth and is linked from it", () => {
    expect(fs.existsSync("src/app/internal/funnel/page.tsx")).toBe(true);
    expect(fs.readFileSync("src/app/internal/layout.tsx", "utf8")).toContain('href="/internal/funnel"');
    expect(fs.readFileSync("src/middleware.ts", "utf8")).toMatch(/\/internal/);
  });
});
