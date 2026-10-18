/**
 * The internal Leads list (founder request 2026-10-18): each search with what the customer asked
 * for, what we could offer and what happened next. Customer details only, never operator data.
 */
import { describe, expect, it } from "vitest";
import { fixtureSource } from "@/lib/access/contacts";
import { memoryAccessDb } from "@/lib/access/db";
import { memoryContactCache } from "@/lib/access/matching";
import { activateFromSession, createCheckout, requestManualSearch, startEventRequest } from "@/lib/access/service";
import { fakeStripe } from "@/lib/access/stripe";
import { recordAttribution } from "@/lib/attribution";
import { isTeamAddress, leadsReport } from "@/lib/lifecycle/leads";

const SITE = "https://carnivalriderental.us";
const EVENT = { email: "planner@fastmail.com", eventDate: "2030-06-01", city: "Riverside", state: "CA", rideType: "kiddie-train", eventType: "church-festival", attendance: 2500 };
const cache = () => ({ cache: memoryContactCache() });

describe("leads report", () => {
  it("lists each search newest first with its outcome, campaign, and nothing about operators", async () => {
    const db = memoryAccessDb();
    const stripe = fakeStripe(SITE);
    const bought = await startEventRequest(db, fixtureSource(), EVENT, cache());
    await recordAttribution(db, bought.event.id, { source: "google", medium: "cpc", campaign: "crr-search" });
    const { purchase } = await createCheckout(db, stripe, bought.event.id, SITE);
    stripe.complete(purchase.stripeCheckoutSessionId!, "paid");
    await activateFromSession(db, stripe, purchase.id, purchase.stripeCheckoutSessionId!, SITE);
    const left = await startEventRequest(db, fixtureSource(), { ...EVENT, email: "second@fastmail.com" }, cache());
    await createCheckout(db, stripe, left.event.id, SITE);
    await startEventRequest(db, fixtureSource(), { ...EVENT, email: "third@fastmail.com" }, cache());
    // A search we can't sell (no operator near this ride in the fixture), then a free hand search.
    const thin = await startEventRequest(db, fixtureSource(), { ...EVENT, email: "fourth@fastmail.com", city: "Juneau", state: "AK" }, cache());
    expect(thin.sellable).toBe(false);
    await requestManualSearch(db, thin.event.id, { send: async () => ({ sent: true, deliveredTo: null }) });
    await startEventRequest(db, fixtureSource(), { ...EVENT, email: "qa@carnivalriderental.us" }, cache());

    const leads = await leadsReport(db, 30);
    expect(leads.map((l) => l.email)).toEqual(["qa@carnivalriderental.us", "fourth@fastmail.com", "third@fastmail.com", "second@fastmail.com", "planner@fastmail.com"]);
    const by = Object.fromEntries(leads.map((l) => [l.email, l]));
    expect(by["planner@fastmail.com"]).toMatchObject({ outcome: "paid", sellable: true, liveCents: 0, campaign: { source: "google", medium: "cpc", campaign: "crr-search" }, eventType: "church or community festival", attendance: 2500, ride: "kiddie train", via: "web", team: false });
    expect(by["second@fastmail.com"]).toMatchObject({ outcome: "checkout_open", campaign: null });
    expect(by["third@fastmail.com"]).toMatchObject({ outcome: "not_bought" });
    expect(by["fourth@fastmail.com"]).toMatchObject({ outcome: "not_sellable", sellable: false, manualSearchRequested: true, city: "Juneau", state: "AK" });
    expect(by["qa@carnivalriderental.us"].team).toBe(true);
    // Operator identity never reaches this report (the fixture's operator names, phones and emails).
    expect(JSON.stringify(leads)).not.toMatch(/Fixture Amusements|555 010 00|example\.test|Pat Fixture|Operator [A-Z]\b/);
  });

  it("flags the team's own addresses", () => {
    expect(isTeamAddress("qa@carnivalriderental.us")).toBe(true);
    expect(isTeamAddress("derek@poolrentalnearme.com")).toBe(true);
    expect(isTeamAddress("buyer@example.com")).toBe(true);
    expect(isTeamAddress("pastor@life.church")).toBe(false);
  });

  it("an empty range is an empty list", async () => {
    expect(await leadsReport(memoryAccessDb(), 7)).toEqual([]);
  });
});
