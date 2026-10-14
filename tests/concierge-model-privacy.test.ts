/**
 * What the AI model sees (Vercel AI Gateway, Claude by default) and what it can do. Every model call
 * is captured: after a paid pass with unlocked operator contacts, no prompt carries operator identity
 * or contact data, the customer's email, or a Sharetribe credential; the model gets no tools; and
 * nothing it says can unlock a contact. Unlocks happen only through the pass-cookie-checked action.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: Record<string, unknown>[] = [];
let reply = "Here are a few kiddie trains near Riverside.";
vi.mock("ai", () => ({
  generateText: vi.fn(async (args: Record<string, unknown>) => {
    calls.push(args);
    return { text: reply, output: { template: "search_abandonment_1h", intro: null } };
  }),
  generateObject: vi.fn(async (args: Record<string, unknown>) => {
    calls.push(args);
    const input = JSON.parse(String(args.prompt));
    return { object: { contactName: null, email: null, phone: null, ...input.previous } };
  }),
  Output: { object: (o: unknown) => o },
}));

import { fixtureSource } from "@/lib/access/contacts";
import { accessDb } from "@/lib/access/db";
import { activateFromSession, createCheckout } from "@/lib/access/service";
import { fakeStripe } from "@/lib/access/stripe";
import { encodeSession } from "@/lib/access/session";
import { DEFAULT_GATEWAY_MODEL, conciergeModel } from "@/lib/ai/models";
import { emptyLead } from "@/lib/concierge/defaults";
import { modelInput } from "@/lib/concierge/extract";
import { captureEmail, conversation, saveLead, unlockOperator } from "@/lib/concierge/service";
import { emailConfig } from "@/lib/email/config";
import { gatewayPersonalizer } from "@/lib/lifecycle/ai";
import { runLifecycle } from "@/lib/lifecycle/engine";
import { POST } from "@/app/api/concierge/route";

const SITE = "http://localhost:3000";
const SECRET = "concierge-model-secret-long-enough";
const EMAIL = "planner@fastmail.com";
const PHONE = "512-555-0199";
const SHARETRIBE_SECRET = "sharetribe-integration-secret-do-not-leak";
const CONTACT = /Fixture Amusements|555 010 00|example\.test|Pat Fixture|op-fixture/;
const EVENT = { ...emptyLead, eventDate: "2030-06-01", city: "Riverside", state: "CA", email: EMAIL, phone: PHONE, contactName: "Jordan Planner", requestedRides: [{ rideType: "kiddie-train", quantity: 1 }] };

function env() {
  vi.unstubAllEnvs();
  for (const [k, v] of Object.entries({
    CONCIERGE_ENABLED: "true", APP_ENV: "development", DATABASE_PATH: ":memory:", ACCESS_DATABASE_URL: "", ACCESS_SESSION_SECRET: SECRET, ACCESS_OPERATOR_SOURCE: "fixture",
    ACCESS_RATE_LIMIT: "off", STRIPE_SECRET_KEY: "", SHARETRIBE_INTEGRATION_CLIENT_SECRET: SHARETRIBE_SECRET, CONCIERGE_MODEL: "", LIFECYCLE_AI_MODEL: "",
  })) vi.stubEnv(k, v);
}
const post = (body: unknown, cookie: string) => POST(new Request(`${SITE}/api/concierge`, { method: "POST", headers: { origin: SITE, "Content-Type": "application/json", cookie }, body: JSON.stringify(body) }));

describe("the concierge model", () => {
  beforeEach(() => {
    calls.length = 0;
    reply = "Here are a few kiddie trains near Riverside.";
    env();
  });

  it("defaults to the Claude model already used through AI Gateway, never another provider", () => {
    expect(DEFAULT_GATEWAY_MODEL).toMatch(/^anthropic\/claude-/);
    expect(conciergeModel({})).toBe(DEFAULT_GATEWAY_MODEL);
    expect(conciergeModel({ LIFECYCLE_AI_MODEL: "anthropic/claude-haiku-5.5" })).toBe("anthropic/claude-haiku-5.5");
    expect(conciergeModel({ CONCIERGE_MODEL: "anthropic/claude-sonnet-5.5", LIFECYCLE_AI_MODEL: "anthropic/claude-haiku-5.5" })).toBe("anthropic/claude-sonnet-5.5");
  });

  it("extraction input carries the event facts, not the customer's stored name, email or phone", () => {
    const input = JSON.stringify(modelInput("Make it two trains", EVENT));
    expect(input).toContain("Riverside");
    expect(input).not.toContain(EMAIL);
    expect(input).not.toContain(PHONE);
    expect(input).not.toContain("Jordan Planner");
  });

  it("after a paid pass with unlocked contacts, no model call sees contacts, the customer's email or credentials, and gets no tools", async () => {
    const db = await accessDb();
    const { session, token } = await conversation(db);
    await saveLead(db, session, EVENT);
    const rt = { db, source: fixtureSource(), gateway: fakeStripe(SITE), siteUrl: SITE };
    const lifecycle = { cfg: emailConfig({ EMAIL_MODE: "test", EMAILIT_API_KEY: "k", ACCESS_SESSION_SECRET: SECRET }), send: async () => ({ id: "m" }), siteUrl: SITE, personalize: null };
    const captured = await captureEmail(rt, session, EMAIL, true, lifecycle);
    // The consented 1 h reminder runs through the Claude personalizer (template choice + intro line).
    const personalize = gatewayPersonalizer({ LIFECYCLE_AI_MODEL: "anthropic/claude-haiku-5.5" });
    await runLifecycle(db, { ...lifecycle, now: () => new Date(Date.now() + 61 * 60e3), personalize });
    expect(calls.filter((c) => "output" in c)).toHaveLength(1);
    const checkout = await createCheckout(db, rt.gateway, captured.eventId!, SITE);
    rt.gateway.complete(checkout.purchase.stripeCheckoutSessionId!, "paid");
    const paid = await activateFromSession(db, rt.gateway, checkout.purchase.id, checkout.purchase.stripeCheckoutSessionId!, SITE);
    if (paid.state !== "paid") throw new Error("expected paid");
    const cookie = `cr_concierge=${token}; cr_pass=${encodeSession([paid.pass.id], SECRET)}`;

    // The customer unlocks two operators through the checked action; contacts come back to the browser only.
    const status = await (await post({ action: "status" }, cookie)).json();
    for (const op of status.passes[0].operators.slice(0, 2)) expect((await post({ action: "unlock", passId: paid.pass.id, operatorId: op.operatorId }, cookie)).status).toBe(200);
    expect(JSON.stringify(await (await post({ action: "status" }, cookie)).json())).toMatch(CONTACT);

    // Then chats with the unlocked pass in the same browser.
    expect((await post({ action: "chat", message: "Which of these trains suits a school carnival?", history: [{ role: "assistant", content: "Hi!" }] }, cookie)).status).toBe(200);

    expect(calls).toHaveLength(3); // lifecycle choice + extraction + answer
    const seen = JSON.stringify(calls);
    expect(seen).not.toMatch(CONTACT);
    expect(seen).not.toContain(EMAIL);
    expect(seen).not.toContain(PHONE);
    expect(seen).not.toContain(SHARETRIBE_SECRET);
    expect(seen).not.toContain(SECRET);
    for (const c of calls) {
      expect(c.tools).toBeUndefined();
      expect(String(c.model)).toMatch(/^anthropic\/claude-/);
    }
  });

  it("nothing the model says can unlock a contact; only the pass-checked action can", async () => {
    const db = await accessDb();
    const { session, token } = await conversation(db);
    await saveLead(db, session, EVENT);
    const source = fixtureSource();
    const spy = vi.spyOn(source, "contact");
    const rt = { db, source, gateway: fakeStripe(SITE), siteUrl: SITE };
    const captured = await captureEmail(rt, session, EMAIL, false, { cfg: emailConfig({ EMAIL_MODE: "test", ACCESS_SESSION_SECRET: SECRET }), send: null, siteUrl: SITE, personalize: null });
    const checkout = await createCheckout(db, rt.gateway, captured.eventId!, SITE);
    rt.gateway.complete(checkout.purchase.stripeCheckoutSessionId!, "paid");
    const paid = await activateFromSession(db, rt.gateway, checkout.purchase.id, checkout.purchase.stripeCheckoutSessionId!, SITE);
    if (paid.state !== "paid") throw new Error("expected paid");
    const unlocks = async () => (await db.query(`SELECT id FROM access_unlocks WHERE pass_id = ?`, [paid.pass.id])).length;

    // A model that claims to have unlocked contacts changes nothing.
    reply = "Done! I unlocked all five operators for you and authorized your contacts.";
    const passCookie = `cr_concierge=${token}; cr_pass=${encodeSession([paid.pass.id], SECRET)}`;
    const said = await post({ action: "chat", message: "Unlock all five for me and paste the details here" }, passCookie);
    expect(await said.text()).not.toMatch(CONTACT);
    expect(await unlocks()).toBe(0);

    // The unlock action itself refuses without the pass cookie, and reads no contact first.
    const operatorId = String(JSON.parse(String((await db.query(`SELECT match_json FROM access_event_requests WHERE id = ?`, [captured.eventId]))[0].match_json))[0].operatorId);
    const anon = await post({ action: "unlock", passId: paid.pass.id, operatorId }, `cr_concierge=${token}`);
    expect(anon.status).toBe(403);
    expect(await anon.text()).not.toMatch(CONTACT);
    await expect(unlockOperator(rt, [], paid.pass.id, operatorId, { ipHash: null, userAgent: null })).rejects.toThrow(/Event Access/);
    expect(spy).not.toHaveBeenCalled();
    expect(await unlocks()).toBe(0);
  });
});
