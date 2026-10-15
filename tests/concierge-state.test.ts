/**
 * The chat knows where the conversation stands (founder test 2026-10-15): no ride cards until there is
 * a place or a ride to search by, the model and the no-AI answers get the application's own record of
 * what was saved, emailed and requested, and every "I need more" message names exactly what.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

let extraction: Record<string, unknown> = {}, failReply = false, reply = "Happy to help.";
const systems: string[] = [];
vi.mock("ai", () => ({
  generateText: vi.fn(async (args: { system?: string }) => {
    if (String(args.system).startsWith("Extract event planning")) return { text: JSON.stringify(extraction) };
    systems.push(String(args.system));
    if (failReply) throw new Error("model unavailable");
    return { text: reply };
  }),
}));

import { DEFAULT_PRODUCT, FERRIS_PRODUCT } from "@/lib/access/config";
import { emptyLead } from "@/lib/concierge/defaults";
import { emailStatusAnswer, faqAnswer } from "@/lib/concierge/faq";
import { leadState, listOf, needDetails } from "@/lib/concierge/state";
import { POST } from "@/app/api/concierge/route";

const SITE = "http://localhost:3000";
const EMAIL = "planner@fastmail.com";
const products = { standard: { ...DEFAULT_PRODUCT, active: true }, ferris: { ...FERRIS_PRODUCT, active: true } };
const COLUMBUS = { ...emptyLead, eventDate: "2030-06-15", city: "Columbus", state: "OH", requestedRides: [{ rideType: "ferris-wheel", quantity: 1 }] };

/** One browser: the session cookie from the first reply is sent with the next requests. */
function browser() {
  let cookie = "";
  return async (body: unknown) => {
    const r = await POST(new Request(`${SITE}/api/concierge`, { method: "POST", headers: { origin: SITE, "Content-Type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) }));
    const set = r.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: r.status, data: (await r.json()) as Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
  };
}

describe("what the lead still needs", () => {
  it("nothing to search by until there is a place or a ride", () => {
    expect(leadState(emptyLead)).toMatchObject({ searchable: false, missingForEmail: ["event date", "city and state"], missingForAvailability: ["event date", "city and state", "email"] });
    expect(leadState({ ...emptyLead, city: "Austin", state: "TX" })).toMatchObject({ searchable: true, hasLocation: true, missingForEmail: ["event date"] });
    expect(leadState({ ...emptyLead, requestedRides: [{ rideType: "carousel", quantity: 1 }] })).toMatchObject({ searchable: true, hasLocation: false });
    expect(leadState({ ...COLUMBUS, email: EMAIL })).toMatchObject({ missingForEmail: [], missingForAvailability: [] });
  });

  it("lists what is missing in plain words", () => {
    expect(listOf(["event date"])).toBe("event date");
    expect(listOf(["event date", "email"])).toBe("event date and email");
    expect(needDetails(["event date", "city and state", "email"])).toContain("your event date, city and state, and email");
  });
});

describe("\"did you send me the email?\" is answered from the record", () => {
  it("never a guess: not yet (and what is missing), or yes", () => {
    const notYet = { emailOnFile: false, savedSearchEmailSent: false, missingForEmail: ["event date"] };
    expect(emailStatusAnswer("did you send me the email", notYet)).toMatch(/^Not yet\. I still need your event date/);
    expect(emailStatusAnswer("I never got the email", { ...notYet, missingForEmail: [] })).toContain('Press "Email me these options"');
    expect(emailStatusAnswer("where's my email?", { emailOnFile: true, savedSearchEmailSent: true, missingForEmail: [] })).toMatch(/^Yes\./);
    expect(emailStatusAnswer("Do you have a Ferris wheel?", notYet)).toBeNull();
    expect(faqAnswer("did you send me the email", products, notYet)).toMatch(/^Not yet/);
    expect(faqAnswer("did you send me the email", products)).toBeNull(); // no record, no claim
  });
});

describe("the chat route with a conversation", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    for (const [k, v] of Object.entries({ CONCIERGE_ENABLED: "true", APP_ENV: "development", DATABASE_PATH: ":memory:", ACCESS_DATABASE_URL: "", ACCESS_SESSION_SECRET: "state-test-secret-long-enough-000000", ACCESS_OPERATOR_SOURCE: "fixture", ACCESS_RATE_LIMIT: "off" })) vi.stubEnv(k, v);
    extraction = {};
    failReply = false;
    systems.length = 0;
  });

  it("\"hello\" gets a question, not the four rides nearest the middle of the country", async () => {
    const post = browser();
    const hello = await post({ action: "chat", message: "hello" });
    expect(hello.status).toBe(200);
    expect(hello.data.search).toBeNull();
    expect(systems.at(-1)).toContain('"searchable":false');
    expect(systems.at(-1)).toContain("No search yet");
    // Once there is a place and a ride, the search runs and the model is told what is known.
    extraction = { eventDate: "2030-06-15", city: "Columbus", state: "OH", requestedRides: [{ rideType: "ferris-wheel", quantity: 1 }] };
    const ferris = await post({ action: "chat", message: "Ferris wheel in Columbus OH on June 15 2030" });
    expect(ferris.data.search.total).toBeGreaterThan(0);
    expect(ferris.data.search.locationPrecision).toBe("city");
    expect(systems.at(-1)).toContain('"city":"Columbus"');
    expect(systems.at(-1)).toContain('"savedSearchEmailSent":false');
  });

  it("the model is told an email is on file, never the address; the no-AI answer is truthful too", async () => {
    const post = browser();
    extraction = { city: "Columbus", state: "OH", requestedRides: [{ rideType: "ferris-wheel", quantity: 1 }] }; // no date yet
    await post({ action: "chat", message: "Ferris wheel in Columbus" });
    const captured = await post({ action: "capture", email: EMAIL, followupConsent: false });
    expect(captured.data.captured.emailed).toBe(false);
    expect(captured.data.message).toContain(EMAIL); // the customer sees the address they typed
    expect(captured.data.message).toContain("event date");
    extraction = {};
    await post({ action: "chat", message: "did you send me the email" });
    expect(systems.at(-1)).toContain('"emailOnFile":true');
    expect(systems.at(-1)).not.toContain(EMAIL);
    failReply = true;
    const noAi = await post({ action: "chat", message: "did you send me the email" });
    expect(noAi.data.message).toMatch(/^Not yet\. I still need your event date/);
  });

  it("buttons pressed too early say exactly what is needed", async () => {
    const post = browser();
    await post({ action: "status" });
    const availability = await post({ action: "availability", listingId: null });
    expect(availability.status).toBe(400);
    expect(availability.data.error).toBe(needDetails(["event date", "city and state", "email"]));
    const offer = await post({ action: "checkout", rideType: null });
    expect(offer.status).toBe(400);
    expect(offer.data.error).toContain("event date, city and state, and email");
    // With the details in, the same request goes through.
    await post({ action: "save", details: { ...COLUMBUS, email: EMAIL } });
    expect((await post({ action: "checkout", rideType: "ferris-wheel" })).status).toBe(200);
  });

  it("\"Start over\" resets the saved event", async () => {
    const post = browser();
    await post({ action: "save", details: { ...COLUMBUS, email: EMAIL } });
    const reset = await post({ action: "save", details: emptyLead });
    expect(reset.status).toBe(200);
    expect(reset.data.details).toEqual(emptyLead);
  });
});
