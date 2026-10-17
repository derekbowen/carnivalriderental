/**
 * The chat without a working AI model (2026-10-15: AI Gateway refused the model on the free tier and
 * every message got "Automatic interpretation is unavailable"). Policy questions are answered from
 * the product rows and the published policy; the two AI steps fail independently; and extraction
 * reads plain JSON, so models without structured output (GPT-3.5) work too.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

let failExtraction = true, failReply = true, reply = "Happy to help with that.";
vi.mock("ai", () => ({
  generateText: vi.fn(async (args: { system?: string }) => {
    const extraction = String(args.system).startsWith("Extract event planning");
    if (extraction ? failExtraction : failReply) throw new Error("Free tier users do not have access to this model.");
    return { text: extraction ? '```json\n{"city":"Columbus","state":"oh","eventDate":"2030-06-15","requestedRides":[{"rideType":"ferris-wheel","quantity":1}]}\n```' : reply };
  }),
}));

import { DEFAULT_PRODUCT, FERRIS_PRODUCT } from "@/lib/access/config";
import { emptyLead } from "@/lib/concierge/defaults";
import { mergeLead, parseExtraction } from "@/lib/concierge/extract";
import { faqAnswer, NO_AI_REPLY } from "@/lib/concierge/faq";
import { emailOfferLine } from "@/lib/concierge/state";
import { POST } from "@/app/api/concierge/route";

const products = { standard: { ...DEFAULT_PRODUCT, active: true }, ferris: { ...FERRIS_PRODUCT, active: true } };
const SITE = "http://localhost:3000";
const chat = async (message: string) => {
  const r = await POST(new Request(`${SITE}/api/concierge`, { method: "POST", headers: { origin: SITE, "Content-Type": "application/json" }, body: JSON.stringify({ action: "chat", message }) }));
  expect(r.status).toBe(200);
  return (await r.json()) as { message: string; search?: { total: number } | null };
};

describe("policy answers without AI", () => {
  it("answers the questions customers asked on 2026-10-15", () => {
    expect(faqAnswer("do my credits expire", products)).toContain(`valid for ${DEFAULT_PRODUCT.validityDays} days`);
    expect(faqAnswer("do my credits expire", products)).toContain("stay on your pass");
    const noAnswer = faqAnswer("i called the contact info you gave me and they didnt answer", products)!;
    expect(noAnswer).toContain("voicemail");
    expect(noAnswer).toContain("This contact didn't work");
  });

  it("covers dead contacts, refunds, lost links, price, booking and support from the policy", () => {
    expect(faqAnswer("the number is disconnected", products)).toContain("This contact didn't work");
    expect(faqAnswer("Their email bounced", products)).toContain("give the unlock back");
    expect(faqAnswer("Can I get a refund?", products)).toContain("within 14 days");
    expect(faqAnswer("I lost my pass link", products)).toContain("/pass/recover");
    const price = faqAnswer("How much does it cost?", products)!;
    expect(price).toContain("$99");
    expect(price).toContain("$199");
    expect(faqAnswer("Can I book the carousel for Saturday?", products)).toContain("We don't book rides");
    expect(faqAnswer("I want to talk to a real person", products)).toContain("support@carnivalriderental.us");
  });

  it("leaves event descriptions to the search, not to a canned answer", () => {
    expect(faqAnswer("Do you have a Ferris wheel near Columbus, Ohio for June 15?", products)).toBeNull();
    expect(faqAnswer("We need a carousel and a train for 2,000 people", products)).toBeNull();
  });
});

describe("extraction reads plain JSON from any model", () => {
  it("takes the first JSON object, ignoring code fences and prose; anything else keeps the details", () => {
    const lead = mergeLead(emptyLead, parseExtraction('Sure!\n```json\n{"city":"Austin","state":"tx","attendance":300}\n```'));
    expect(lead).toMatchObject({ city: "Austin", state: "TX", attendance: 300 });
    expect(parseExtraction("I can't help with that.")).toEqual({});
    expect(parseExtraction("{not json}")).toEqual({});
    expect(parseExtraction("[1,2]")).toEqual({});
  });
});

describe("the chat route when AI is unavailable", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    for (const [k, v] of Object.entries({ CONCIERGE_ENABLED: "true", APP_ENV: "development", DATABASE_PATH: ":memory:", ACCESS_DATABASE_URL: "", ACCESS_SESSION_SECRET: "no-ai-test-secret-long-enough-0000", ACCESS_OPERATOR_SOURCE: "fixture", ACCESS_RATE_LIMIT: "off" })) vi.stubEnv(k, v);
    failExtraction = true;
    failReply = true;
  });

  it("answers policy questions from the policy and points everything else to the form and support", async () => {
    expect((await chat("do my credits expire")).message).toContain(`${DEFAULT_PRODUCT.validityDays} days`);
    expect((await chat("they didnt answer the phone")).message).toContain("This contact didn't work");
    const other = await chat("Do you have a Ferris wheel near Columbus, Ohio for June 15?");
    expect(other.message).toBe(NO_AI_REPLY);
    expect(other.search).toBeNull(); // clears earlier cards; nothing random when the details couldn't be read
  });

  it("a customer reporting that an operator didn't answer gets help, not the paywall refusal", async () => {
    const report = await chat("The operator didn't answer the phone");
    expect(report.message).toContain("This contact didn't work");
    expect(report.message).not.toContain("cannot bypass the paywall");
    expect((await chat("What is the operator's phone number?")).message).toContain("cannot bypass the paywall");
  });

  it("without a ledger (a preview) policy questions are still answered when the AI is down", async () => {
    vi.stubEnv("APP_ENV", "preview");
    expect((await chat("do my credits expire")).message).toContain(`${DEFAULT_PRODUCT.validityDays} days`);
    expect((await chat("Ferris wheel in Columbus on June 15")).message).toBe(NO_AI_REPLY);
  });

  it("a failed extraction still gets the AI reply, and a failed reply still keeps the search", async () => {
    failReply = false;
    expect((await chat("hello")).message).toBe("Happy to help with that.");
    failExtraction = false;
    failReply = true;
    const r = await chat("Ferris wheel in Columbus OH on June 15 2030");
    expect(r.search?.total).toBeGreaterThan(0);
    // The policy fallback, then the application's one-time email offer (first results in this session).
    expect(r.message).toBe(`${NO_AI_REPLY}\n\n${emailOfferLine([])}`);
  });
});
