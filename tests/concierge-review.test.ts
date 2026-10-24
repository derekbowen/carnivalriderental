/**
 * Fixes from the pre-launch review of the chat concierge (2026-10-14): tolerant AI extraction,
 * well-formed chat history for Claude, no duplicate requests after a chat turn, a way forward when
 * a search has no exact match, and readable contact details.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { fixtureSource } from "@/lib/access/contacts";
import { memoryAccessDb, type AccessDb } from "@/lib/access/db";
import { fakeStripe } from "@/lib/access/stripe";
import { emailConfig } from "@/lib/email/config";
import { contactRows } from "@/lib/concierge/contact-display";
import { emptyLead } from "@/lib/concierge/defaults";
import { mergeLead } from "@/lib/concierge/extract";
import { chatMessages, HISTORY_BUDGET } from "@/lib/concierge/help";
import { captureEmail, conversation, createEventRequest, saveLead } from "@/lib/concierge/service";
import type { LifecycleDeps } from "@/lib/lifecycle/engine";

const SITE = "https://carnivalriderental.us";
const EMAIL = "planner@fastmail.com";
const PREVIOUS = { ...emptyLead, eventDate: "2030-06-15", city: "Columbus", state: "OH", attendance: 8000, email: EMAIL, requestedRides: [{ rideType: "carousel", quantity: 1 }] };

describe("AI extraction merge", () => {
  it("keeps every previous fact the model drops or garbles, and takes only valid new ones", () => {
    const lead = mergeLead(PREVIOUS, {
      eventDate: "06/20/2030", // wrong format: ignored, previous kept
      city: "  Dayton ",
      state: "oh", // normalised
      zip: "45402-1234", // trimmed to 5 digits
      attendance: 2500.4, // rounded
      requestedRides: [{ rideType: "made-up-ride", quantity: 2 }, { rideType: "ferris-wheel", quantity: 1.2 }],
      email: null, // dropped by the model: kept
      budgetUsd: "a lot", // wrong type: ignored
    });
    expect(lead).toMatchObject({ eventDate: "2030-06-15", city: "Dayton", state: "OH", zip: "45402", attendance: 2500, email: EMAIL, budgetUsd: null });
    expect(lead.requestedRides).toEqual([{ rideType: "ferris-wheel", quantity: 1 }]);
  });

  it("an unknown state or an empty ride list never wipes what we had", () => {
    const lead = mergeLead(PREVIOUS, { state: "Ohio", requestedRides: [], city: "" });
    expect(lead).toMatchObject({ state: "OH", city: "Columbus", requestedRides: PREVIOUS.requestedRides });
  });

  it("a completely unusable model answer leaves the lead unchanged", () => {
    expect(mergeLead(PREVIOUS, { template: "x", intro: null } as never)).toEqual(PREVIOUS);
  });
});

describe("chat history sent to Claude", () => {
  it("starts with the customer, alternates, and ends with the new message", () => {
    const msgs = chatMessages(
      [
        { role: "assistant", content: "Hi! Tell me about your event." },
        { role: "user", content: "Ferris wheel in Columbus" },
        { role: "assistant", content: "Great." },
        { role: "assistant", content: "When is it?" },
      ],
      "June 15",
    );
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(msgs[1].content).toBe("Great.\n\nWhen is it?");
    expect(msgs.at(-1)!.content).toBe("June 15");
  });

  it("folds the new message into a trailing customer turn and stays within the budget", () => {
    const long = "x".repeat(HISTORY_BUDGET);
    const msgs = chatMessages([{ role: "user", content: long }, { role: "assistant", content: "ok" }, { role: "user", content: "and a carousel" }], "in June");
    expect(msgs.map((m) => m.role)).toEqual(["user"]); // the oversized turn is dropped, so the reply before it would lead: dropped too
    expect(msgs[0].content).toBe("and a carousel\n\nin June");
    expect(chatMessages([], "hello")).toEqual([{ role: "user", content: "hello" }]);
  });
});

describe("chat → event requests", () => {
  let db: AccessDb;
  let sent: Record<string, unknown>[];
  const rt = () => ({ db, source: fixtureSource(), gateway: fakeStripe(SITE), siteUrl: SITE });
  const env = { EMAIL_MODE: "live", EMAILIT_API_KEY: "test-key", BUSINESS_POSTAL_ADDRESS: "PO Box 1, Austin, TX 78701", EMAIL_APPROVED_CAMPAIGNS: "lifecycle-v1", ACCESS_SESSION_SECRET: "review-test-secret-review-test-secret" };
  const deps = (): LifecycleDeps => ({ cfg: emailConfig(env), send: async (body) => (sent.push(body), { id: "m" }), siteUrl: SITE, personalize: null });
  beforeEach(() => {
    db = memoryAccessDb();
    sent = [];
  });

  it("a chat turn that repeats the same details reuses the request: one request, one saved-search email", async () => {
    const { session } = await conversation(db);
    const riverside = { ...emptyLead, eventDate: "2030-06-01", city: "Riverside", state: "CA", requestedRides: [{ rideType: "kiddie-train", quantity: 1 }] };
    await saveLead(db, session, riverside);
    const first = await captureEmail(rt(), session, EMAIL, false, deps());
    // The customer keeps chatting; extraction returns the same event (what the route saves every turn).
    await saveLead(db, session, { ...session.details });
    const again = await captureEmail(rt(), session, EMAIL, false, deps());
    const offer = await createEventRequest(rt(), session, "kiddie-train"); // "See access offer"
    expect(again.eventId).toBe(first.eventId);
    expect(offer.event.id).toBe(first.eventId);
    expect(await db.query(`SELECT id FROM access_event_requests`)).toHaveLength(1);
    expect(sent).toHaveLength(1);
    // Changing the event (a different date) does make a new request.
    await saveLead(db, session, { ...session.details, eventDate: "2030-07-04" });
    expect((await createEventRequest(rt(), session, "kiddie-train")).event.id).not.toBe(first.eventId);
  });

  it("editing the ZIP, event type, attendance or budget makes a new request; details never given stay null", async () => {
    const { session } = await conversation(db);
    await saveLead(db, session, { ...emptyLead, eventDate: "2030-06-01", city: "Riverside", state: "CA", email: EMAIL, requestedRides: [{ rideType: "kiddie-train", quantity: 1 }] });
    const first = (await createEventRequest(rt(), session, "kiddie-train")).event;
    expect(first).toMatchObject({ zip: null, eventType: null, attendance: null, budgetCents: null });
    let previous = first.id;
    for (const edit of [{ zip: "92501" }, { eventType: "School carnival" }, { attendance: 3000 }, { budgetUsd: 5000 }]) {
      await saveLead(db, session, { ...session.details, ...edit });
      const edited = (await createEventRequest(rt(), session, "kiddie-train")).event;
      expect(edited.id).not.toBe(previous);
      expect((await createEventRequest(rt(), session, "kiddie-train")).event.id).toBe(edited.id); // unchanged again: reused
      previous = edited.id;
    }
    const last = (await createEventRequest(rt(), session, "kiddie-train")).event;
    expect(last).toMatchObject({ zip: "92501", eventType: "School carnival", attendance: 3000, budgetCents: 500_000 });
    expect(await db.query(`SELECT id FROM access_event_requests`)).toHaveLength(5);
  });

  it("no exact match: the chat points to the alternatives page instead of a dead end", async () => {
    const { session } = await conversation(db);
    await saveLead(db, session, { ...emptyLead, eventDate: "2030-06-01", city: "Fresno", state: "CA", requestedRides: [{ rideType: "trackless-train", quantity: 1 }] });
    const r = await captureEmail(rt(), session, EMAIL, false, deps());
    expect(r.emailed).toBe(false);
    expect(r.alternativesUrl).toBe(`/connect/${r.eventId}`);
    expect(sent).toEqual([]);
  });
});

describe("unlocked contact display", () => {
  it("labels the revealed fields, links phone, email and website, and hides internal flags", () => {
    const rows = contactRows({ companyName: "Acme Rides", contactName: null, phone: "(555) 010-0001", email: "a@acme.test", website: "acme.test", hqCity: "Austin", hqState: "TX", claimed: true });
    expect(rows).toEqual([
      { label: "Company", value: "Acme Rides" },
      { label: "Phone", value: "(555) 010-0001", href: "tel:5550100001" },
      { label: "Email", value: "a@acme.test", href: "mailto:a@acme.test" },
      { label: "Website", value: "acme.test", href: "https://acme.test" },
      { label: "Based in", value: "Austin, TX" },
    ]);
  });
});
