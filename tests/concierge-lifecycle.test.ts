/**
 * PR #13 reconciliation: the chat concierge feeds the ONE lifecycle email system (src/lib/lifecycle).
 * Hooks are recorded, the chat never sends a duplicate email, chat searches get sales follow-ups only
 * with explicit "remind me" consent, and merging the code enables nothing in production by itself.
 */
import fs from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fixtureSource } from "@/lib/access/contacts";
import { memoryAccessDb, type AccessDb } from "@/lib/access/db";
import { activateFromSession, createCheckout, startEventRequest } from "@/lib/access/service";
import { fakeStripe } from "@/lib/access/stripe";
import { emailConfig } from "@/lib/email/config";
import { conciergeEnabled } from "@/lib/concierge/flags";
import { emptyLead } from "@/lib/concierge/defaults";
import { captureEmail, conversation, recordListingView, recordSearch, saveLead, searchRides, sendPendingOptions, unlockOperator, type Conversation } from "@/lib/concierge/service";
import { runLifecycle, sendSavedSearch, type LifecycleDeps } from "@/lib/lifecycle/engine";
import { LIFECYCLE_EVENTS } from "@/lib/lifecycle/events";
import { RIDES } from "@/lib/inventory";
import { POST } from "@/app/api/concierge/route";

const SITE = "https://carnivalriderental.us";
const EMAIL = "planner@fastmail.com";
const CONTACT = /Fixture Amusements|555 010 00|example\.test|Pat Fixture/;
const MIN = 60e3;
const HOUR = 60 * MIN;
const later = (ms: number) => new Date(Date.now() + ms);
// Riverside kiddie trains: 5 fixture operators, so the request is matched (sellable).
const EVENT = { ...emptyLead, eventDate: "2030-06-01", city: "Riverside", state: "CA", requestedRides: [{ rideType: "kiddie-train", quantity: 1 }] };
const liveEnv = { EMAIL_MODE: "live", EMAILIT_API_KEY: "test-key", BUSINESS_POSTAL_ADDRESS: "PO Box 1, Austin, TX 78701", EMAIL_APPROVED_CAMPAIGNS: "lifecycle-v1", ACCESS_SESSION_SECRET: "lifecycle-test-secret-lifecycle-test-secret" };

describe("chat concierge → lifecycle email (one system)", () => {
  let db: AccessDb;
  let sent: Record<string, unknown>[];
  const rt = () => ({ db, source: fixtureSource(), gateway: fakeStripe(SITE), siteUrl: SITE });
  const deps = (at?: Date, env: Record<string, string> = liveEnv): LifecycleDeps => ({ cfg: emailConfig(env), send: async (body) => (sent.push(body), { id: `msg-${sent.length}` }), siteUrl: SITE, now: () => at ?? new Date(), personalize: null });
  const templates = () => sent.map((b) => (b.tags as { name: string; value: string }[]).find((t) => t.name === "template")!.value);
  const sales = () => templates().filter((t) => t !== "saved_search" && t !== "purchased_no_unlock_2h");
  /** Runs the scheduled job at each offset (the cron runs every 10 minutes; these are the interesting moments). */
  const runAt = async (...offsets: number[]) => {
    for (const o of offsets) await runLifecycle(db, deps(later(o)));
  };
  async function chat(): Promise<Conversation> {
    const { session } = await conversation(db);
    await saveLead(db, session, EVENT);
    await recordSearch(db, session, searchRides(session.details, "kiddie-train").total);
    return session;
  }
  beforeEach(() => {
    db = memoryAccessDb();
    sent = [];
    vi.unstubAllEnvs();
  });

  it("records all nine hooks, from chat start to an operator unlock, with identifiers only", async () => {
    const session = await chat();
    expect(await recordSearch(db, session, 5)).toBe(false); // email capture is offered once per session
    await recordListingView(db, session, RIDES[0].id);
    const captured = await captureEmail(rt(), session, EMAIL, true, deps());
    expect(captured.emailed).toBe(true);
    const r = rt();
    const checkout = await createCheckout(db, r.gateway, captured.eventId!, SITE);
    r.gateway.complete(checkout.purchase.stripeCheckoutSessionId!, "paid");
    const paid = await activateFromSession(db, r.gateway, checkout.purchase.id, checkout.purchase.stripeCheckoutSessionId!, SITE);
    if (paid.state !== "paid") throw new Error("expected paid");
    const event = (await db.query(`SELECT match_json FROM access_event_requests WHERE id = ?`, [captured.eventId]))[0];
    const operatorId = JSON.parse(String(event.match_json))[0].operatorId;
    await unlockOperator(r, [paid.pass.id], paid.pass.id, operatorId, { ipHash: null, userAgent: null });

    const rows = await db.query(`SELECT * FROM access_lifecycle_events ORDER BY created_at, rowid`);
    expect(new Set(rows.map((x) => x.name))).toEqual(new Set(LIFECYCLE_EVENTS));
    expect(rows.filter((x) => x.name === "email_capture_offered")).toHaveLength(1);
    expect(rows.every((x) => x.source === "chat")).toBe(true);
    expect(rows.find((x) => x.name === "email_capture_accepted")?.consent).toBe(1);
    expect(rows.find((x) => x.name === "operator_unlocked")?.pass_id).toBe(paid.pass.id);
    expect(JSON.stringify(rows)).not.toContain(EMAIL);
    expect(JSON.stringify(rows)).not.toMatch(CONTACT);
  });

  it("web checkouts are recorded as web, outside the payment transaction", async () => {
    const { event } = await startEventRequest(db, fixtureSource(), { email: EMAIL, eventDate: "2030-06-01", city: "Riverside", state: "CA", rideType: "kiddie-train" });
    await createCheckout(db, fakeStripe(SITE), event.id, SITE);
    const rows = await db.query(`SELECT name, source FROM access_lifecycle_events`);
    expect(rows).toEqual([{ name: "checkout_started", source: "web" }]);
    // A missing lifecycle-events table (production before the opt-in migration) never breaks checkout.
    await db.query(`DROP TABLE access_lifecycle_events`);
    await expect(createCheckout(db, fakeStripe(SITE), event.id, SITE)).resolves.toMatchObject({ url: expect.any(String) });
  });

  it("asking the chat to email the options sends the saved-search email once, however often it is pressed", async () => {
    const session = await chat();
    const first = await captureEmail(rt(), session, EMAIL, false, deps());
    const second = await captureEmail(rt(), session, ` ${EMAIL.toUpperCase()} `, false, deps());
    expect(second.eventId).toBe(first.eventId); // same request reused, no second quote
    // The web "Email me these results" button on the matches page is the same lifecycle email.
    expect((await sendSavedSearch(db, first.eventId!, deps())).outcome).toBe("skipped");
    expect(templates()).toEqual(["saved_search"]);
    expect(await db.query(`SELECT id FROM access_event_requests`)).toHaveLength(1);
  });

  it("an email without event details sends nothing", async () => {
    const { session } = await conversation(db);
    const r = await captureEmail(rt(), session, EMAIL, true, deps());
    expect(r).toMatchObject({ emailed: false, eventId: null });
    await runAt(61 * MIN, 25 * HOUR);
    expect(sent).toEqual([]);
  });

  it("an email given before the details is sent the options once the chat completes them, once per session", async () => {
    const { session } = await conversation(db);
    await saveLead(db, session, { ...emptyLead, requestedRides: EVENT.requestedRides });
    expect((await captureEmail(rt(), session, EMAIL, false, deps())).emailed).toBe(false);
    expect(sent).toEqual([]);
    await saveLead(db, session, { ...session.details, eventDate: EVENT.eventDate, city: EVENT.city, state: EVENT.state });
    expect((await sendPendingOptions(rt(), session, deps()))?.emailed).toBe(true);
    expect(templates()).toEqual(["saved_search"]);
    await saveLead(db, session, { ...session.details, city: "Fresno" });
    expect(await sendPendingOptions(rt(), session, deps())).toBeNull();
    expect(templates()).toEqual(["saved_search"]);
    // No "remind me" box: the deferred send is still only the email they asked for.
    await runAt(61 * MIN, 25 * HOUR);
    expect(templates()).toEqual(["saved_search"]);
  });

  it("an email the customer only typed never gets the options", async () => {
    const { session } = await conversation(db);
    await saveLead(db, session, { ...EVENT, email: EMAIL });
    expect(await sendPendingOptions(rt(), session, deps())).toBeNull();
    expect(sent).toEqual([]);
  });

  it("without the 'remind me' box a chat search gets only the email it asked for", async () => {
    await captureEmail(rt(), await chat(), EMAIL, false, deps());
    await runAt(61 * MIN, 2 * HOUR, 25 * HOUR, 30 * HOUR, 47 * HOUR);
    expect(templates()).toEqual(["saved_search"]);
  });

  it("with consent: at most the 1 h and the next-day reminder, never more", async () => {
    await captureEmail(rt(), await chat(), EMAIL, true, deps());
    await runAt(30 * MIN, 61 * MIN, 70 * MIN, 2 * HOUR, 5 * HOUR, 25 * HOUR, 26 * HOUR, 30 * HOUR, 47 * HOUR, 49 * HOUR);
    expect(templates()).toEqual(["saved_search", "search_abandonment_1h", "search_abandonment_24h"]);
  });

  it("unticking 'remind me' on a later capture withdraws consent", async () => {
    const session = await chat();
    await captureEmail(rt(), session, EMAIL, true, deps());
    await captureEmail(rt(), session, EMAIL, false, deps());
    await runAt(61 * MIN, 25 * HOUR);
    expect(sales()).toEqual([]);
  });

  it("typing an email into the chat is never consent, whatever the event details", async () => {
    const { session } = await conversation(db);
    await saveLead(db, session, { ...EVENT, email: EMAIL }); // what extractLead stores when the customer types it
    const { createEventRequest } = await import("@/lib/concierge/service");
    await createEventRequest(rt(), session, "kiddie-train"); // "See access offer"
    await runAt(61 * MIN, 25 * HOUR);
    expect(sent).toEqual([]);
  });

  it("a chat purchase stops every sales email; the paid-but-not-unlocked reminder goes once", async () => {
    const captured = await captureEmail(rt(), await chat(), EMAIL, true, deps());
    const r = rt();
    const checkout = await createCheckout(db, r.gateway, captured.eventId!, SITE);
    r.gateway.complete(checkout.purchase.stripeCheckoutSessionId!, "paid");
    await activateFromSession(db, r.gateway, checkout.purchase.id, checkout.purchase.stripeCheckoutSessionId!, SITE);
    await runAt(61 * MIN, 2 * HOUR + 5 * MIN, 3 * HOUR, 25 * HOUR, 47 * HOUR);
    expect(templates()).toEqual(["saved_search", "purchased_no_unlock_2h"]);
  });

  it("an abandoned chat checkout gets one checkout reminder, not a search reminder as well", async () => {
    const captured = await captureEmail(rt(), await chat(), EMAIL, true, deps());
    await createCheckout(db, fakeStripe(SITE), captured.eventId!, SITE);
    await runAt(61 * MIN, 2 * HOUR, 5 * HOUR);
    expect(sales()).toEqual(["checkout_abandonment_1h"]);
  });

  it("chat and web searches by the same address share one sales email per 20 h", async () => {
    await startEventRequest(db, fixtureSource(), { email: EMAIL, eventDate: "2030-06-01", city: "Riverside", state: "CA", rideType: "kiddie-train" });
    await captureEmail(rt(), await chat(), EMAIL, true, deps());
    await runAt(61 * MIN, 2 * HOUR, 5 * HOUR, 6 * HOUR);
    expect(sales()).toEqual(["search_abandonment_1h"]);
    expect(templates().filter((t) => t === "saved_search")).toHaveLength(1);
  });

  it("a newer chat search without consent is never chased through an older web search", async () => {
    await startEventRequest(db, fixtureSource(), { email: EMAIL, eventDate: "2030-06-01", city: "Riverside", state: "CA", rideType: "kiddie-train" });
    await new Promise((r) => setTimeout(r, 5));
    await captureEmail(rt(), await chat(), EMAIL, false, deps());
    await runAt(61 * MIN, 25 * HOUR);
    expect(sales()).toEqual([]);
  });

  it("without the approved campaign and postal address (production today) consented reminders stay blocked", async () => {
    const prodToday = { EMAIL_MODE: "live", EMAILIT_API_KEY: "test-key", ACCESS_SESSION_SECRET: "lifecycle-test-secret-lifecycle-test-secret" };
    await captureEmail(rt(), await chat(), EMAIL, true, deps(undefined, prodToday));
    for (const o of [61 * MIN, 25 * HOUR]) await runLifecycle(db, deps(later(o), prodToday));
    expect(templates()).toEqual(["saved_search"]);
    expect((await db.query(`SELECT status, reason FROM access_lifecycle_emails WHERE template != 'saved_search'`)).map((r) => r.status)).toEqual(["blocked", "blocked"]);
  });
});

describe("merging PR #13 enables nothing by itself", () => {
  it("the concierge is off unless CONCIERGE_ENABLED is exactly 'true'", async () => {
    expect(conciergeEnabled({})).toBe(false);
    expect(conciergeEnabled({ CONCIERGE_ENABLED: "1" })).toBe(false);
    expect(conciergeEnabled({ CONCIERGE_ENABLED: "true" })).toBe(true);
    vi.stubEnv("CONCIERGE_ENABLED", "");
    const res = await POST(new Request(`${SITE}/api/concierge`, { method: "POST", headers: { origin: SITE, "Content-Type": "application/json" }, body: JSON.stringify({ action: "status" }) }));
    expect(res.status).toBe(404);
    vi.unstubAllEnvs();
  });

  it("the runtime Postgres schema never creates the concierge or lifecycle-event tables", () => {
    const schema = fs.readFileSync("src/lib/access/schema.sql", "utf8");
    expect(schema).not.toMatch(/concierge_|access_lifecycle_events/);
    const db = fs.readFileSync("src/lib/access/db.ts", "utf8");
    const pgInit = db.slice(db.indexOf("async function postgresDb"), db.indexOf("// ------------------------------------------------------------------------------ singleton"));
    expect(pgInit).not.toMatch(/CONCIERGE|applyConciergeSchema/);
    // The opt-in migration is called from the migrate script only, never from app code.
    const callers = (fs.readdirSync("src", { recursive: true }) as string[]).filter((f) => /\.tsx?$/.test(f) && fs.readFileSync(`src/${f}`, "utf8").includes("applyConciergeSchema("));
    expect(callers.map((f) => f.replaceAll("\\", "/"))).toEqual(["lib/access/db.ts"]);
    expect(fs.readFileSync("scripts/access-migrate.ts", "utf8")).toContain("--concierge");
  });

  it("there is no second campaign engine: no follow-up tables, jobs, scripts or cron entries", () => {
    const tables = memoryAccessDb();
    return tables.query(`SELECT name FROM sqlite_master WHERE type = 'table'`).then((rows) => {
      const names = rows.map((r) => String(r.name));
      expect(names.filter((n) => /followup|concierge_events/.test(n))).toEqual([]);
      for (const f of ["src/lib/concierge/followup.ts", "src/lib/concierge/analytics.ts", "scripts/concierge-followups.ts"]) expect(fs.existsSync(f)).toBe(false);
      const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
      expect(Object.keys(pkg.scripts).filter((k) => /followup/i.test(k))).toEqual([]);
      expect(JSON.parse(fs.readFileSync("vercel.json", "utf8")).crons).toEqual([{ path: "/api/lifecycle/run", schedule: "*/10 * * * *" }]);
    });
  });
});
