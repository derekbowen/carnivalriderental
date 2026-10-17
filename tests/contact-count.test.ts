/**
 * The five-contact promise (founder decision 2026-10-17): we sell from the product's minimum (3) up,
 * so general copy says "up to" the unlock limit and every per-search surface (offer, Stripe line item,
 * pass page, pass email, lifecycle email) states the number this search can actually deliver.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { activeProducts } from "@/lib/access/config";
import { fixtureSource, type OperatorSource } from "@/lib/access/contacts";
import { contactsIncluded, contactsPhrase } from "@/lib/access/copy";
import { memoryAccessDb, type AccessDb } from "@/lib/access/db";
import { passEmail } from "@/lib/access/email";
import { geocode, matchOperators, memoryContactCache } from "@/lib/access/matching";
import { activateFromSession, createCheckout, passView, startEventRequest } from "@/lib/access/service";
import { fakeStripe } from "@/lib/access/stripe";
import { RIDE_TYPES } from "@/lib/inventory";
import { renderLifecycle, type LifecycleVars } from "@/lib/lifecycle/templates";

const SITE = "http://test.local";
const base = { email: "buyer@example.com", eventDate: "2030-06-01", city: "Columbus", state: "OH" };

describe("contactsPhrase", () => {
  it("never promises more contacts than the search matched", () => {
    expect(contactsPhrase(5, 3)).toBe("all 3 matching operators");
    expect(contactsPhrase(5, 5)).toBe("all 5 matching operators");
    expect(contactsPhrase(5, 13)).toBe("5 of the 13 matching operators, chosen by you");
    expect(contactsPhrase(5, 1)).toBe("the 1 matching operator");
    expect([contactsIncluded(5, 3), contactsIncluded(5, 13), contactsIncluded(5, 0)]).toEqual([3, 5, 0]);
  });
});

describe("per-search surfaces state the real number", () => {
  let db: AccessDb, source: OperatorSource, stripe: ReturnType<typeof fakeStripe>;
  beforeEach(() => {
    db = memoryAccessDb();
    source = fixtureSource();
    stripe = fakeStripe(SITE);
  });

  /** A standard ride type with exactly `lo`..`hi` contactable operators near Columbus in the fixture. */
  async function typeWith(lo: number, hi: number): Promise<{ rideType: string; n: number }> {
    const geo = geocode("Columbus", "OH")!;
    for (const t of RIDE_TYPES.filter((t) => !/ferris/.test(t.id))) {
      const m = await matchOperators({ lat: geo.lat, lng: geo.lng, state: "OH", rideType: t.id }, source, memoryContactCache());
      if (m.contactableCount >= lo && m.contactableCount <= hi) return { rideType: t.id, n: m.contactableCount };
    }
    throw new Error(`no fixture ride type with ${lo}-${hi} operators near Columbus`);
  }

  async function buy(eventId: string) {
    const { purchase } = await createCheckout(db, stripe, eventId, SITE);
    stripe.complete(purchase.stripeCheckoutSessionId!, "paid");
    const r = await activateFromSession(db, stripe, purchase.id, purchase.stripeCheckoutSessionId!, SITE);
    if (r.state !== "paid") throw new Error(`expected paid, got ${r.state}`);
    return { session: stripe.sessions.get(purchase.stripeCheckoutSessionId!)!, pass: r.pass };
  }

  it("3–4 matches: sold, and checkout and the pass say all of them, never five", async () => {
    await activeProducts(db);
    const { rideType, n } = await typeWith(3, 4);
    const { event, sellable } = await startEventRequest(db, source, { ...base, rideType }, { cache: memoryContactCache() });
    expect(sellable).toBe(true);
    expect(event.matchedOperators).toBe(n);
    const { session, pass } = await buy(event.id);
    expect(session.productDescription).toContain(`Contact details for all ${n} matching operators, within 30 days`);
    expect(session.productDescription).not.toMatch(/\b5\b/);
    const view = (await passView(db, pass.id))!;
    expect(view).toMatchObject({ available: n, remaining: n });
    const mail = passEmail({ passUrl: `${SITE}/pass/open?t=x`, productName: "Event Access", unlockLimit: pass.unlockLimit, matched: n, expiresOn: "2030-07-01", eventSummary: "Columbus, OH on 2030-06-01" });
    expect(mail.text).toContain(`Your pass covers all ${n} of them until 2030-07-01.`);
    expect(mail.text).not.toContain("up to 5");
  });

  it("more than five matches: five of them, chosen by the customer", async () => {
    await activeProducts(db);
    const { event } = await startEventRequest(db, source, { ...base, rideType: "ferris-wheel" }, { cache: memoryContactCache() });
    const n = event.matchedOperators;
    expect(n).toBeGreaterThan(5);
    const { session, pass } = await buy(event.id);
    expect(session.productDescription).toContain(`Contact details for 5 of the ${n} matching operators, chosen by you, within 30 days`);
    expect((await passView(db, pass.id))!).toMatchObject({ available: 5, remaining: 5 });
    const mail = passEmail({ passUrl: `${SITE}/pass/open?t=x`, productName: "Ferris Wheel Event Access", unlockLimit: 5, matched: n, expiresOn: "2030-07-01", eventSummary: "Columbus, OH on 2030-06-01" });
    expect(mail.text).toContain("You can unlock 5 of them, your choice, until 2030-07-01.");
  });

  it("fewer than the minimum: not sold", async () => {
    await activeProducts(db);
    const { rideType } = await typeWith(1, 2);
    const { sellable, event } = await startEventRequest(db, source, { ...base, rideType }, { cache: memoryContactCache() });
    expect(sellable).toBe(false);
    expect(event.status).toBe("insufficient");
    await expect(createCheckout(db, stripe, event.id, SITE)).rejects.toThrow();
  });

  it("lifecycle emails use the real number too", () => {
    const v: LifecycleVars = {
      city: "Columbus", state: "OH", eventDate: "2030-06-01", eventType: null, ride: "carousel", ridePlural: "carousels", alternativeTo: null,
      operators: 3, nearestMiles: 20, radiusMiles: 200, listings: [], nearby: [], product: { name: "Event Access", price: "$99", unlockLimit: 5, validityDays: 30 },
      pass: { unlockLimit: 5, expiresOn: "Monday, July 1, 2030" }, ctaUrl: `${SITE}/connect/x`, unsubscribeUrl: `${SITE}/u`, postalAddress: "PO Box 1, Austin, TX 78701", intro: null,
    };
    const paid = renderLifecycle("purchased_no_unlock_2h", v).text;
    expect(paid).toContain("Your pass covers all 3 matching operators for your event in Columbus");
    expect(paid).not.toContain("up to 5");
    const abandoned = renderLifecycle("checkout_abandonment_1h", v).text;
    expect(abandoned).toContain("It includes direct contact details for all 3 matching operators for 30 days.");
  });
});

