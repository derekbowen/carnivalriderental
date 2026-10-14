import { beforeEach, describe, expect, it } from "vitest";
import { fixtureSource } from "@/lib/access/contacts";
import { memoryAccessDb, type AccessDb } from "@/lib/access/db";
import { memoryContactCache } from "@/lib/access/matching";
import { activateFromSession, createCheckout, redeemMagicLink, startEventRequest, unlockOperator } from "@/lib/access/service";
import { fakeStripe } from "@/lib/access/stripe";
import { emailConfig } from "@/lib/email/config";
import { unsubscribeUrl, verifyUnsubscribe } from "@/lib/email/outbox";
import { validIntro } from "@/lib/lifecycle/ai";
import { duePlans, excludedAddress, runLifecycle, savedSearchSent, sendPlan, sendSavedSearch, suppressEmail, type LifecycleDeps, type Personalizer } from "@/lib/lifecycle/engine";
import { LIFECYCLE_TEMPLATES, renderLifecycle, TEMPLATE_KIND, type LifecycleVars } from "@/lib/lifecycle/templates";

const SITE = "https://carnivalriderental.us";
const EMAIL = "planner@fastmail.com";
// Riverside kiddie trains: 5 fixture operators, so the request is matched (sellable).
const request = { email: EMAIL, eventDate: "2030-06-01", city: "Riverside", state: "CA", rideType: "kiddie-train", eventType: "school-carnival" };
const MIN = 60e3;
const HOUR = 60 * MIN;
const FIXTURE_IDENTITY = /Fixture Amusements|555 010 00|example\.test|Pat Fixture|op-fixture/;

const liveEnv = { EMAIL_MODE: "live", EMAILIT_API_KEY: "test-key", BUSINESS_POSTAL_ADDRESS: "PO Box 1, Austin, TX 78701", EMAIL_APPROVED_CAMPAIGNS: "lifecycle-v1", ACCESS_SESSION_SECRET: "lifecycle-test-secret-lifecycle-test-secret" };
function deps(env: Record<string, string> = liveEnv, at?: Date, personalize: Personalizer | null = null) {
  const sent: Record<string, unknown>[] = [];
  const d: LifecycleDeps = { cfg: emailConfig(env), send: async (body) => (sent.push(body), { id: `msg-${sent.length}` }), siteUrl: SITE, now: () => at ?? new Date(), personalize };
  return { d, sent };
}
const later = (ms: number) => new Date(Date.now() + ms);
const templatesOf = (plans: Awaited<ReturnType<typeof duePlans>>) => plans.flatMap((p) => p.options.map((o) => o.template));

describe("lifecycle templates", () => {
  const v: LifecycleVars = {
    city: "Riverside", state: "CA", eventDate: "2026-10-30", eventType: "school carnival or fundraiser", ride: "Ferris wheel", ridePlural: "Ferris wheels", alternativeTo: null,
    operators: 7, nearestMiles: 16, radiusMiles: 200, listings: [], nearby: [], product: { name: "Ferris Wheel Event Access", price: "$199", unlockLimit: 5, validityDays: 30 },
    pass: { unlockLimit: 5, expiresOn: "Friday, November 13, 2026" }, ctaUrl: `${SITE}/connect/x`, unsubscribeUrl: `${SITE}/api/email/unsubscribe?e=a&t=b`, postalAddress: "PO Box 1, Austin, TX 78701", intro: null,
  };

  it("uses the approved subjects", () => {
    expect(Object.fromEntries(LIFECYCLE_TEMPLATES.map((t) => [t, renderLifecycle(t, v).subject]))).toEqual({
      saved_search: "Your carnival ride options for Riverside",
      search_abandonment_1h: "Still looking for a Ferris wheel in Riverside?",
      search_abandonment_24h: "Still planning your Riverside event?",
      checkout_abandonment_1h: "Your operator matches are still available",
      purchased_no_unlock_2h: "Your operator contacts are ready",
    });
    expect(renderLifecycle("search_abandonment_1h", { ...v, ride: "orbiter ride" }).subject).toBe("Still looking for an orbiter ride in Riverside?");
  });

  it("commercial emails carry the postal address and an unsubscribe link; every email has one CTA", () => {
    for (const t of LIFECYCLE_TEMPLATES) {
      const r = renderLifecycle(t, v);
      expect(r.text).toContain("Unsubscribe: ");
      expect(r.html).toContain(v.ctaUrl);
      expect(r.text.includes(v.postalAddress!)).toBe(TEMPLATE_KIND[t] === "commercial");
      expect(r.text).not.toMatch(/guarantee|book now|available on your date/i);
    }
  });
});

describe("lifecycle rules", () => {
  let db: AccessDb;
  const source = fixtureSource();
  beforeEach(() => {
    db = memoryAccessDb();
  });

  it("search abandonment: nothing before an hour, the 1 h email inside 1–6 h, the next-day email at 24–48 h", async () => {
    const { sellable } = await startEventRequest(db, source, request, { cache: memoryContactCache() });
    expect(sellable).toBe(true);
    expect(templatesOf(await duePlans(db, later(30 * MIN)))).toEqual([]);
    expect(templatesOf(await duePlans(db, later(61 * MIN)))).toEqual(["search_abandonment_1h"]);
    expect(templatesOf(await duePlans(db, later(7 * HOUR)))).toEqual([]);
    expect(templatesOf(await duePlans(db, later(25 * HOUR)))).toEqual(["search_abandonment_24h"]);
    expect(templatesOf(await duePlans(db, later(49 * HOUR)))).toEqual([]);
  });

  it("a started checkout gets the checkout email instead of the search one", async () => {
    const { event } = await startEventRequest(db, source, request, { cache: memoryContactCache() });
    await createCheckout(db, fakeStripe(SITE), event.id, SITE);
    expect(templatesOf(await duePlans(db, later(61 * MIN)))).toEqual(["checkout_abandonment_1h"]);
  });

  it("buying Event Access stops every sales email; a pass with no unlocks gets the reminder after 2 h, once used it doesn't", async () => {
    const stripe = fakeStripe(SITE);
    const { event } = await startEventRequest(db, source, request, { cache: memoryContactCache() });
    const { purchase } = await createCheckout(db, stripe, event.id, SITE);
    stripe.complete(purchase.stripeCheckoutSessionId!, "paid");
    const r = await activateFromSession(db, stripe, purchase.id, purchase.stripeCheckoutSessionId!, SITE);
    if (r.state !== "paid") throw new Error(r.state);
    expect(templatesOf(await duePlans(db, later(61 * MIN)))).toEqual([]);
    expect(templatesOf(await duePlans(db, later(25 * HOUR)))).toEqual(["purchased_no_unlock_2h"]);
    await unlockOperator(db, source, r.pass.id, event.operators[0].operatorId, { ipHash: null, userAgent: null });
    expect(templatesOf(await duePlans(db, later(25 * HOUR)))).toEqual([]);
  });

  it("chases only the newest search, never a zero-match one, a past date or our own and test domains", async () => {
    await startEventRequest(db, source, request, { cache: memoryContactCache() });
    const second = await startEventRequest(db, source, { ...request, rideType: "carousel" }, { cache: memoryContactCache() });
    const plans = await duePlans(db, later(61 * MIN));
    expect(plans.map((p) => p.options[0].eventRequestId)).toEqual(second.sellable ? [second.event.id] : []);
    await db.query(`DELETE FROM access_event_requests`);
    await startEventRequest(db, source, { ...request, rideType: "trackless-train" }, { cache: memoryContactCache() }).catch(() => undefined);
    expect(templatesOf(await duePlans(db, later(61 * MIN)))).toEqual([]);
    for (const e of ["qa@carnivalriderental.us", "x@example.com", "y@shop.test"]) expect(excludedAddress(e)).toBe(true);
    expect(excludedAddress(EMAIL)).toBe(false);
  });
});

describe("lifecycle sending", () => {
  let db: AccessDb;
  const source = fixtureSource();
  beforeEach(() => {
    db = memoryAccessDb();
  });

  it("commercial emails are blocked without a postal address or an approved campaign, then send once", async () => {
    await startEventRequest(db, source, request, { cache: memoryContactCache() });
    const at = later(61 * MIN);
    const [plan] = await duePlans(db, at);
    const noAddress = deps({ ...liveEnv, BUSINESS_POSTAL_ADDRESS: "" }, at);
    expect(await sendPlan(db, plan, noAddress.d)).toMatchObject({ outcome: "blocked", reason: expect.stringMatching(/BUSINESS_POSTAL_ADDRESS/) });
    const noCampaign = deps({ ...liveEnv, EMAIL_APPROVED_CAMPAIGNS: "" }, at);
    expect(await sendPlan(db, plan, noCampaign.d)).toMatchObject({ outcome: "blocked", reason: expect.stringMatching(/lifecycle-v1/) });
    expect(noAddress.sent.length + noCampaign.sent.length).toBe(0);
    const ok = deps(liveEnv, at);
    expect(await sendPlan(db, plan, ok.d)).toMatchObject({ outcome: "sent", template: "search_abandonment_1h" });
    expect(ok.sent[0]).toMatchObject({ to: [EMAIL], subject: "Still looking for a kiddie train in Riverside?", headers: { "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } });
    expect(String(ok.sent[0].html)).not.toMatch(FIXTURE_IDENTITY);
    expect(String(ok.sent[0].text)).toContain("PO Box 1, Austin, TX 78701");
    // Never twice, and no other sales email for 20 hours.
    expect(await sendPlan(db, plan, ok.d)).toMatchObject({ outcome: "skipped" });
    expect(await duePlans(db, later(2 * HOUR))).toEqual([]);
  });

  it("test mode sends everything to the test inbox and names the intended recipient", async () => {
    await startEventRequest(db, source, request, { cache: memoryContactCache() });
    const at = later(61 * MIN);
    const t = deps({ EMAILIT_API_KEY: "test-key", ACCESS_SESSION_SECRET: liveEnv.ACCESS_SESSION_SECRET }, at);
    const [plan] = await duePlans(db, at);
    expect(await sendPlan(db, plan, t.d)).toMatchObject({ outcome: "sent" });
    expect(t.sent[0]).toMatchObject({ to: ["qa@carnivalriderental.us"], subject: `[TEST → ${EMAIL}] Still looking for a kiddie train in Riverside?` });
  });

  it("unsubscribed addresses get nothing; the unsubscribe link verifies", async () => {
    await startEventRequest(db, source, request, { cache: memoryContactCache() });
    const at = later(61 * MIN);
    const { d, sent } = deps(liveEnv, at);
    const [plan] = await duePlans(db, at);
    const link = new URL(unsubscribeUrl(SITE, EMAIL, d.cfg.unsubscribeSecret!));
    expect(verifyUnsubscribe(link.searchParams.get("e")!, link.searchParams.get("t")!, d.cfg.unsubscribeSecret!)).toBe(true);
    await suppressEmail(db, EMAIL.toUpperCase(), "unsubscribe_link");
    expect(await sendPlan(db, plan, d)).toMatchObject({ outcome: "suppressed" });
    expect(sent).toHaveLength(0);
  });

  it("a failed send is recorded and retried on the next run", async () => {
    await startEventRequest(db, source, request, { cache: memoryContactCache() });
    const at = later(61 * MIN);
    const [plan] = await duePlans(db, at);
    const failing: LifecycleDeps = { ...deps(liveEnv, at).d, send: async () => Promise.reject(new Error("provider down")) };
    expect(await sendPlan(db, plan, failing)).toMatchObject({ outcome: "failed", reason: "provider down" });
    const ok = deps(liveEnv, at);
    expect(await sendPlan(db, plan, ok.d)).toMatchObject({ outcome: "sent" });
    expect((await db.query(`SELECT attempts FROM access_lifecycle_emails`))[0].attempts).toBe(2);
  });

  it("the no-unlock reminder links straight into the pass with a fresh sign-in link", async () => {
    const stripe = fakeStripe(SITE);
    const { event } = await startEventRequest(db, source, request, { cache: memoryContactCache() });
    const { purchase } = await createCheckout(db, stripe, event.id, SITE);
    stripe.complete(purchase.stripeCheckoutSessionId!, "paid");
    const r = await activateFromSession(db, stripe, purchase.id, purchase.stripeCheckoutSessionId!, SITE);
    if (r.state !== "paid") throw new Error(r.state);
    const at = later(3 * HOUR);
    const { d, sent } = deps({ ...liveEnv, BUSINESS_POSTAL_ADDRESS: "", EMAIL_APPROVED_CAMPAIGNS: "" }, at); // transactional: no campaign gate
    const [plan] = await duePlans(db, at);
    expect(await sendPlan(db, plan, d)).toMatchObject({ outcome: "sent", template: "purchased_no_unlock_2h" });
    const token = /\/pass\/open\?t=([A-Za-z0-9_-]+)/.exec(String(sent[0].text))![1];
    expect(await redeemMagicLink(db, token)).toBe(r.pass.id);
  });

  it("the AI step may pick among due templates and add one line, but only a line that passes validation", async () => {
    await startEventRequest(db, source, request, { cache: memoryContactCache() });
    const at = later(61 * MIN);
    const [plan] = await duePlans(db, at);
    const good: Personalizer = async ({ options }) => ({ template: options[0].template, intro: "Hope the Riverside planning is going well; your kiddie train search is right where you left it." });
    const a = deps(liveEnv, at, good);
    await sendPlan(db, plan, a.d);
    expect(String(a.sent[0].text)).toContain("Hope the Riverside planning is going well");
    expect((await db.query(`SELECT personalized FROM access_lifecycle_emails`))[0].personalized).toBe(1);

    const v = { operators: 5, nearestMiles: 13, eventDate: "2030-06-01" } as LifecycleVars;
    expect(validIntro("Only 2 spots left, book now at a discount!", v)).toBe(false);
    expect(validIntro("We found 12 operators near you.", v)).toBe(false); // a number that isn't a fact
    expect(validIntro("We found 5 operators, the closest about 13 miles from Riverside.", v)).toBe(true);
    expect(validIntro("See https://example.com for details about your event.", v)).toBe(false);
  });

  it("runs are locked: a second call within minutes does nothing", async () => {
    const { d } = deps(liveEnv);
    expect((await runLifecycle(db, d)).ran).toBe(true);
    expect((await runLifecycle(db, d)).ran).toBe(false);
  });

  it("saved search: sent on request, once, transactional; a zero-match request has nothing to save", async () => {
    const { event } = await startEventRequest(db, source, request, { cache: memoryContactCache() });
    const { d, sent } = deps({ ...liveEnv, BUSINESS_POSTAL_ADDRESS: "", EMAIL_APPROVED_CAMPAIGNS: "" });
    expect(await sendSavedSearch(db, event.id, d)).toMatchObject({ outcome: "sent" });
    expect(await sendSavedSearch(db, event.id, d)).toMatchObject({ outcome: "skipped" });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: [EMAIL], subject: "Your carnival ride options for Riverside" });
    expect(String(sent[0].text)).toContain("Here are the rides you were looking at for your school carnival or fundraiser in Riverside.");
    expect(String(sent[0].html)).not.toMatch(FIXTURE_IDENTITY);
    expect(await savedSearchSent(db, event.id)).toBe(true);
    const zero = await startEventRequest(db, source, { ...request, rideType: "trackless-train" }, { cache: memoryContactCache() });
    expect(await sendSavedSearch(db, zero.event.id, d)).toMatchObject({ outcome: "skipped" });
  });
});
