import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_PRODUCT } from "@/lib/access/config";
import { fixtureSource } from "@/lib/access/contacts";
import { memoryAccessDb, type AccessDb } from "@/lib/access/db";
import { aliasPhrases, computeFallbacks, fallbackSpecs, isAliasOf, RELATED_RIDE_TYPES } from "@/lib/access/fallback";
import { memoryContactCache } from "@/lib/access/matching";
import { createAlternativeRequest, createCheckout, ensureFallbacks, fallbackView, quoteForEvent, requestManualSearch, startEventRequest } from "@/lib/access/service";
import { fakeStripe } from "@/lib/access/stripe";
import { RIDE_TYPES } from "@/lib/inventory";

const SITE = "http://test.local";
// No trackless train within 200 miles of Riverside in the snapshot; kiddie trains 13+ miles away.
const riverside = { email: "buyer@example.com", eventDate: "2030-06-01", city: "Riverside", state: "CA", rideType: "trackless-train" };
const canonical = new Set(RIDE_TYPES.map((t) => t.id));
const funnel = (db: AccessDb) => db.query(`SELECT name, event_request_id, result_event_request_id, fallback_kind, fallback_ride_type FROM access_funnel_events ORDER BY created_at, name`);
const noSend = async () => ({ sent: true, deliveredTo: "test" });

describe("fallback chain (pure)", () => {
  it("related ride types are canonical taxonomy ids and never the type itself", () => {
    for (const [from, to] of Object.entries(RELATED_RIDE_TYPES)) {
      expect(canonical.has(from), from).toBe(true);
      for (const t of to) {
        expect(canonical.has(t), `${from} → ${t}`).toBe(true);
        expect(t).not.toBe(from);
      }
    }
    expect(RELATED_RIDE_TYPES["trackless-train"]).toEqual(["kiddie-train"]);
  });

  it("aliases are exact phrases on rides we couldn't classify, never loose single words", () => {
    const phrases = aliasPhrases("trackless-train");
    expect(phrases).toEqual(expect.arrayContaining([" trackless train ", " train ride ", " party train ", " locomotive ride ", " childrens train "]));
    expect(phrases).not.toContain(" express ");
    expect(isAliasOf({ title: "Train Ride", rideType: null }, "trackless-train")).toBe(true);
    expect(isAliasOf({ title: "Children's Train", rideType: null }, "trackless-train")).toBe(true);
    // "Orient Express" is a coaster, "Runaway Train" a coaster: not aliases.
    expect(isAliasOf({ title: "Orient Express", rideType: null }, "trackless-train")).toBe(false);
    expect(isAliasOf({ title: "Runaway Train", rideType: null }, "trackless-train")).toBe(false);
    // A ride we already classified is never re-labelled by an alias.
    expect(isAliasOf({ title: "Train Ride", rideType: "kiddie-train" }, "trackless-train")).toBe(false);
  });

  it("orders the chain exact → alias → related → category → wider radius", () => {
    const kinds = fallbackSpecs({ rideType: "trackless-train", rideClass: null }).map((s) => `${s.kind}:${s.rideType ?? s.categoryId}:${s.radiusMiles}`);
    expect(kinds).toEqual(["alias:trackless-train:200", "related:kiddie-train:200", "category:family-rides:200", "radius:trackless-train:400", "radius:trackless-train:750"]);
    // A class-only request can only widen.
    expect(fallbackSpecs({ rideType: null, rideClass: "kiddie" }).map((s) => s.kind)).toEqual(["radius", "radius"]);
  });

  it("never offers an alternative whose tier isn't for sale", async () => {
    const offers = await computeFallbacks({ lat: 33.9381, lng: -117.393, state: "CA", rideType: "trackless-train", rideClass: null }, fixtureSource(), memoryContactCache(), async () => null);
    expect(offers).toEqual([]);
  });
});

describe("zero-match fallback in the ledger", () => {
  let db: AccessDb;
  const source = fixtureSource();
  beforeEach(() => {
    db = memoryAccessDb();
  });

  it("a zero-match request records zero_exact_match and offers the closest viable alternative", async () => {
    const { event, sellable } = await startEventRequest(db, source, riverside, { cache: memoryContactCache() });
    expect(sellable).toBe(false);
    expect(event.matchedOperators).toBe(0);
    const { offers } = await fallbackView(db, event.id);
    expect(offers[0]).toMatchObject({ kind: "related", rideType: "kiddie-train", requestedRideType: "trackless-train", radiusMiles: 200, tier: "standard" });
    expect(offers[0].operators).toBeGreaterThanOrEqual(DEFAULT_PRODUCT.minimumMatches);
    expect(offers[0].nearestMiles).toBe(13);
    expect((await funnel(db)).map((r) => r.name).sort()).toEqual(["fallback_match_shown", "zero_exact_match"]);
  });

  it("offers are anonymous: counts and distances only, no operator or listing identity", async () => {
    const { event } = await startEventRequest(db, source, riverside, { cache: memoryContactCache() });
    const raw = String((await db.query(`SELECT detail_json FROM access_funnel_events WHERE name = 'fallback_match_shown' AND event_request_id = ?`, [event.id]))[0].detail_json);
    expect(raw).not.toMatch(/op-fixture|operatorId|title|photo|Fixture Amusements|@|phone|website/i);
    for (const o of (JSON.parse(raw) as { offers: Record<string, unknown>[] }).offers) expect(Object.keys(o).sort()).toEqual(["categoryId", "kind", "nearestMiles", "operators", "radiusMiles", "requestedRideType", "rideClass", "rideType", "tier"]);
  });

  it("picking an alternative creates a new request priced by its own ride requirement, once", async () => {
    const { event } = await startEventRequest(db, source, riverside, { cache: memoryContactCache() });
    const first = await createAlternativeRequest(db, source, event.id, 0, { cache: memoryContactCache() });
    expect(first.reused).toBe(false);
    expect(first.event).toMatchObject({ rideType: "kiddie-train", status: "matched", city: "Riverside", state: "CA", email: "buyer@example.com", eventDate: "2030-06-01", listingId: null, tier: "standard" });
    expect(first.event.operators.every((o) => o.listings.every((l) => l.rideType === "kiddie-train"))).toBe(true);
    const quote = await quoteForEvent(db, first.event);
    expect(quote).toMatchObject({ tier: "standard", sellable: true });
    const stripe = fakeStripe(SITE);
    const { purchase } = await createCheckout(db, stripe, first.event.id, SITE);
    expect(stripe.sessions.get(purchase.stripeCheckoutSessionId!)!.amountTotal).toBe(9900);
    // The same choice again reopens the same request; the click is counted once.
    const again = await createAlternativeRequest(db, source, event.id, 0, { cache: memoryContactCache() });
    expect(again).toMatchObject({ reused: true, event: { id: first.event.id } });
    const clicks = (await funnel(db)).filter((r) => r.name === "fallback_match_clicked");
    expect(clicks).toEqual([{ name: "fallback_match_clicked", event_request_id: event.id, result_event_request_id: first.event.id, fallback_kind: "related", fallback_ride_type: "kiddie-train" }]);
    // The new request knows what was originally asked for (the page labels it as an alternative).
    expect((await fallbackView(db, first.event.id)).origin).toMatchObject({ eventRequestId: event.id, requestedRideType: "trackless-train", offer: { kind: "related", rideType: "kiddie-train" } });
  });

  it("only offers that were shown can be picked", async () => {
    const { event } = await startEventRequest(db, source, riverside, { cache: memoryContactCache() });
    await expect(createAlternativeRequest(db, source, event.id, 9, { cache: memoryContactCache() })).rejects.toThrow(/isn't available/);
    const ok = await startEventRequest(db, source, { ...riverside, rideType: "kiddie-train" }, { cache: memoryContactCache() });
    expect(ok.sellable).toBe(true);
    await expect(createAlternativeRequest(db, source, ok.event.id, 0, { cache: memoryContactCache() })).rejects.toThrow(/isn't available/);
  });

  it("a Ferris wheel request widened to a bigger radius stays at the Ferris tier", async () => {
    const { event, sellable } = await startEventRequest(db, source, { ...riverside, city: "Billings", state: "MT", rideType: "ferris-wheel" }, { cache: memoryContactCache() });
    expect(sellable).toBe(false);
    const { offers } = await fallbackView(db, event.id);
    const wide = offers.findIndex((o) => o.kind === "radius");
    expect(wide).toBeGreaterThanOrEqual(0);
    expect(offers[wide]).toMatchObject({ rideType: "ferris-wheel", tier: "ferris" });
    const alt = await createAlternativeRequest(db, source, event.id, wide, { cache: memoryContactCache() });
    expect(alt.event).toMatchObject({ rideType: "ferris-wheel", tier: "ferris", status: "matched" });
    expect((await quoteForEvent(db, alt.event)).product?.slug).toBe("ferris-wheel-access");
    expect(Math.max(...alt.event.operators.map((o) => o.miles))).toBeLessThanOrEqual(offers[wide].radiusMiles);
  });

  it("a zero-match request saved before the chain existed gets its alternatives once, on first view", async () => {
    const { event } = await startEventRequest(db, source, riverside, { cache: memoryContactCache() });
    await db.query(`DELETE FROM access_funnel_events`);
    expect((await fallbackView(db, event.id)).offers).toEqual([]);
    await ensureFallbacks(db, source, event, memoryContactCache());
    await ensureFallbacks(db, source, event, memoryContactCache());
    expect((await fallbackView(db, event.id)).offers[0]).toMatchObject({ kind: "related", rideType: "kiddie-train" });
    expect((await funnel(db)).map((r) => r.name).sort()).toEqual(["fallback_match_shown", "zero_exact_match"]);
  });

  it("a sellable request records nothing in the funnel", async () => {
    const { sellable } = await startEventRequest(db, source, { ...riverside, rideType: "kiddie-train" }, { cache: memoryContactCache() });
    expect(sellable).toBe(true);
    expect(await funnel(db)).toEqual([]);
  });

  it("manual search is recorded once and the team is emailed the customer's own request", async () => {
    const { event } = await startEventRequest(db, source, riverside, { cache: memoryContactCache() });
    const sent: { to: string; subject: string; text: string; key: string }[] = [];
    const send = async (to: string, c: { subject: string; text: string }, key: string) => {
      sent.push({ to, subject: c.subject, text: c.text, key });
      return noSend();
    };
    expect(await requestManualSearch(db, event.id, { send })).toEqual({ created: true });
    expect(await requestManualSearch(db, event.id, { send })).toEqual({ created: false });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "support@carnivalriderental.us", subject: "Manual search: trackless train near Riverside, CA (2030-06-01)", key: `manual-search:${event.id}` });
    expect(sent[0].text).toContain("Customer email: buyer@example.com");
    expect(sent[0].text).not.toMatch(/op-fixture|Fixture Amusements/);
    expect((await fallbackView(db, event.id)).manualRequested).toBe(true);
    expect((await funnel(db)).filter((r) => r.name === "manual_search_requested")).toHaveLength(1);
  });
});
