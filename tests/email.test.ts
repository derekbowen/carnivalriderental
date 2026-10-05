import { afterEach, describe, expect, it, vi } from "vitest";
import { emailConfig, type EmailConfig } from "@/lib/email/config";
import { dispatchOutbox, emailitSender, enqueue, senderFor, isSuppressed, suppress, unsubscribeToken, unsubscribeUrl, verifyUnsubscribe, type OutboxRow, type SendFn } from "@/lib/email/outbox";
import { claimInvite } from "@/lib/email/templates";
import { createRequestSchema } from "@/lib/requests/schema";
import { memoryService, validBody } from "./helpers";

const SECRET = "unsubscribe-secret-0123456789";
const cfg = (over: Partial<EmailConfig> = {}): EmailConfig => ({ ...emailConfig({}), unsubscribeSecret: SECRET, postalAddress: "1 Test St, Austin, TX 78701", ...over });

function fakeSender() {
  const sent: { body: Record<string, unknown>; key: string }[] = [];
  const send: SendFn = async (body, key) => {
    sent.push({ body, key });
    return { id: `re_${sent.length}` };
  };
  return { sent, send };
}

const rows = (db: ReturnType<typeof memoryService>["db"]) => db.prepare(`SELECT * FROM email_outbox ORDER BY created_at`).all() as unknown as OutboxRow[];
const invite = (to: string) => ({
  kind: "outreach" as const,
  template: "claim_invite",
  campaign: "claim-invite-v1",
  dedupeKey: `claim_invite:${to}`,
  to,
  unsubscribeUrl: unsubscribeUrl("https://x.test", to, SECRET),
  content: claimInvite({ companyName: "Acme Shows", rideCount: 3, unsubscribeUrl: unsubscribeUrl("https://x.test", to, SECRET), postalAddress: "1 Test St", replyTo: "claims@carnivalriderental.us" }),
});

describe("request flow emails", () => {
  it("queues request-received, payment and quote emails once each, inside the state change", () => {
    const { db, svc } = memoryService();
    const body = createRequestSchema.parse(validBody());
    const { request } = svc.createRequest(body);
    svc.createRequest(body); // idempotent replay: no second email
    expect(rows(db).map((r) => r.template)).toEqual(["request_received"]);
    expect(rows(db)[0]).toMatchObject({ kind: "transactional", to_email: "planner@example.com", status: "pending" });
    expect(rows(db)[0].text).toMatch(/not the final price/);
    expect(rows(db)[0].text).toMatch(/request, not a booking/);
    expect(rows(db)[0].text).toMatch(new RegExp(request.reference));

    svc.recordDemoPayment(request.id, "funds_authorized", "test");
    expect(rows(db).map((r) => r.template)).toEqual(["request_received", "payment_received"]);
    expect(rows(db)[1].text).toMatch(/not yet a confirmed booking/);
  });

  it("never says confirmed or booked in customer emails", () => {
    const { db, svc } = memoryService();
    const { request } = svc.createRequest(createRequestSchema.parse(validBody()));
    svc.recordDemoPayment(request.id, "funds_authorized", "test");
    for (const r of rows(db)) expect(r.text).not.toMatch(/\b(is|has been) (confirmed|booked)\b/i);
  });
});

describe("dispatch", () => {
  it("test mode redirects to the test inbox, names the real recipient, sends once with an idempotency key", async () => {
    const { db, svc } = memoryService();
    svc.createRequest(createRequestSchema.parse(validBody()));
    const { sent, send } = fakeSender();
    const r1 = await dispatchOutbox(db, { send, config: cfg() });
    const r2 = await dispatchOutbox(db, { send, config: cfg() });
    expect(r1.sent).toBe(1);
    expect(r2.sent).toBe(0);
    expect(sent).toHaveLength(1);
    expect(sent[0].body.to).toEqual(["qa@carnivalriderental.us"]);
    expect(sent[0].body.subject).toMatch(/^\[TEST → planner@example\.com\]/);
    expect(sent[0].key).toBe(rows(db)[0].id);
    expect(rows(db)[0]).toMatchObject({ status: "sent", sent_mode: "test", delivered_to: "qa@carnivalriderental.us", provider_id: "re_1" });
  });

  it("failed sends are retried later and capped at 5 attempts", async () => {
    const { db, svc } = memoryService();
    svc.createRequest(createRequestSchema.parse(validBody()));
    const failing: SendFn = async () => {
      throw new Error("Resend HTTP 500");
    };
    for (let i = 0; i < 7; i++) await dispatchOutbox(db, { send: failing, config: cfg() });
    expect(rows(db)[0]).toMatchObject({ status: "failed", attempts: 5 });
  });

  it("outreach: suppressed addresses are skipped; live mode blocks unapproved campaigns", async () => {
    const { db } = memoryService();
    enqueue(db, invite("owner@acme.example"));
    enqueue(db, invite("gone@acme.example"));
    suppress(db, "Gone@Acme.example", "unsubscribe_link");
    const { sent, send } = fakeSender();
    const live = await dispatchOutbox(db, { send, config: cfg({ mode: "live", approvedCampaigns: [] }) });
    expect(live).toMatchObject({ sent: 0, suppressed: 1, blocked: 1 });
    expect(sent).toHaveLength(0);
  });

  it("outreach respects the warm-up daily cap", async () => {
    const { db } = memoryService();
    for (let i = 0; i < 5; i++) enqueue(db, invite(`o${i}@acme.example`));
    const { sent, send } = fakeSender();
    const r = await dispatchOutbox(db, { send, config: cfg({ warmupDailyCaps: [2, 4] }) });
    expect(r).toMatchObject({ sent: 2, deferred: 3 });
    expect(sent.every((s) => (s.body.headers as Record<string, string>)["List-Unsubscribe-Post"] === "List-Unsubscribe=One-Click")).toBe(true);
  });

  it("outreach cannot be queued without an unsubscribe link", () => {
    const { db } = memoryService();
    expect(() => enqueue(db, { ...invite("a@acme.example"), unsubscribeUrl: undefined })).toThrow(/unsubscribe/);
  });
});

describe("unsubscribe and invite content", () => {
  it("tokens are bound to the address and case-insensitive", () => {
    const t = unsubscribeToken("Owner@Acme.example", SECRET);
    expect(verifyUnsubscribe("owner@acme.example", t, SECRET)).toBe(true);
    expect(verifyUnsubscribe("other@acme.example", t, SECRET)).toBe(false);
    expect(verifyUnsubscribe("owner@acme.example", t, "another-secret-0123456789")).toBe(false);
  });

  it("suppression is stored once and normalised", () => {
    const { db } = memoryService();
    suppress(db, " A@B.example ", "x");
    suppress(db, "a@b.example", "y");
    expect(isSuppressed(db, "a@b.EXAMPLE")).toBe(true);
  });

  it("claim invite: postal address, unsubscribe, removal option, no fee or traffic claims", () => {
    const c = claimInvite({ companyName: "Acme Shows", rideCount: 12, unsubscribeUrl: "https://x.test/u", postalAddress: "1 Test St, Austin, TX", replyTo: "claims@carnivalriderental.us" });
    expect(c.text).toMatch(/1 Test St, Austin, TX/);
    expect(c.text).toMatch(/Unsubscribe: https:\/\/x\.test\/u/);
    expect(c.text).toMatch(/removed/);
    expect(c.text).toMatch(/not visible to the public/);
    expect(c.text).not.toMatch(/%|commission|free|guarantee|bookings? (per|a) /i);
  });
});

describe("provider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("Emailit is chosen when its key is set; EMAIL_PROVIDER overrides", () => {
    expect(emailConfig({ EMAILIT_API_KEY: "k1", RESEND_API_KEY: "k2" })).toMatchObject({ provider: "emailit", apiKey: "k1" });
    expect(emailConfig({ RESEND_API_KEY: "k2" })).toMatchObject({ provider: "resend", apiKey: "k2" });
    expect(emailConfig({ EMAILIT_API_KEY: "k1", RESEND_API_KEY: "k2", EMAIL_PROVIDER: "resend" })).toMatchObject({ provider: "resend", apiKey: "k2" });
    expect(() => senderFor(emailConfig({ EMAIL_PROVIDER: "emailit" }))).toThrow(/EMAILIT_API_KEY/);
  });

  it("Emailit request: v2 endpoint, bearer key, idempotency key, no tags, tracking off", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "em_1" }), { status: 200 });
    });
    const r = await emailitSender("key")({ from: "a@b.us", to: ["c@d.us"], subject: "s", text: "t", tags: [{ name: "template", value: "x" }] }, "outbox-1");
    expect(r.id).toBe("em_1");
    expect(calls[0].url).toBe("https://api.emailit.com/v2/emails");
    const h = calls[0].init.headers as Record<string, string>;
    expect(h.Authorization).toBe("Bearer key");
    expect(h["Idempotency-Key"]).toBe("outbox-1");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.tags).toBeUndefined();
    expect(body.tracking).toBe(false);
  });

  it("Emailit errors fail the send (retried later by the outbox)", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "Validation failed" }), { status: 422 }));
    await expect(emailitSender("key")({ to: ["x@y.us"] }, "k")).rejects.toThrow(/Emailit HTTP 422/);
  });
});
