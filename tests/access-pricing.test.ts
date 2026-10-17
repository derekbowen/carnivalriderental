import crypto from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { activeProducts, DEFAULT_PRODUCT, FERRIS_PRODUCT, productForTier, tierOfProduct } from "@/lib/access/config";
import { fixtureSource, type OperatorSource } from "@/lib/access/contacts";
import { accessPriceCopy, bothTiersSentence } from "@/lib/access/copy";
import { memoryAccessDb, type AccessDb } from "@/lib/access/db";
import { passEmail } from "@/lib/access/email";
import { matchOperators, memoryContactCache } from "@/lib/access/matching";
import { FERRIS_RIDE_TYPES, resolveCriteria, tierForRideType } from "@/lib/access/pricing";
import { activateFromSession, createCheckout, getEventRequest, getPass, getPurchase, handleStripeEvent, passView, quoteForEvent, startEventRequest, unlockOperator } from "@/lib/access/service";
import { fakeStripe } from "@/lib/access/stripe";
import { RIDES, RIDE_TYPES } from "@/lib/inventory";

const SITE = "http://test.local";
const base = { email: "buyer@example.com", eventDate: "2030-06-01", city: "Columbus", state: "OH" };
const standard = { ...base, rideType: "carousel" };
const ferris = { ...base, rideType: "ferris-wheel" };
// The fixture operator source derives each listing's operator from a hash of its id; bucket 6 is the
// deliberately uncontactable operator, which matching (correctly) leaves out. Pick a Ferris listing in
// Ohio whose fixture operator can be contacted, so this does not depend on which ids the snapshot holds.
const fixtureBucket = (id: string) => parseInt(crypto.createHash("sha1").update(id).digest("hex").slice(0, 2), 16) % 7;
const ferrisListing = RIDES.find((r) => r.rideType === "ferris-wheel" && r.homeState === "oh" && fixtureBucket(r.id) !== 6)!;
const carouselListing = RIDES.find((r) => r.rideType === "carousel")!;
const cache = () => ({ cache: memoryContactCache() });

async function pay(db: AccessDb, stripe: ReturnType<typeof fakeStripe>, eventId: string) {
  const { purchase } = await createCheckout(db, stripe, eventId, SITE);
  stripe.complete(purchase.stripeCheckoutSessionId!, "paid");
  const r = await activateFromSession(db, stripe, purchase.id, purchase.stripeCheckoutSessionId!, SITE);
  if (r.state !== "paid") throw new Error(`expected paid, got ${r.state}`);
  return { purchase: (await getPurchase(db, purchase.id))!, pass: r.pass };
}

describe("pricing resolver (one source for matching and pricing)", () => {
  it("the Ferris tier covers exactly the canonical Ferris wheel taxonomy ids", () => {
    expect(FERRIS_RIDE_TYPES).toEqual(["ferris-wheel", "giant-ferris-wheel", "mini-ferris-wheel"]);
    for (const id of FERRIS_RIDE_TYPES) expect(RIDE_TYPES.some((t) => t.id === id), id).toBe(true);
    expect(ferrisListing).toBeTruthy();
    expect(carouselListing).toBeTruthy();
  });

  it("ride types: every Ferris variant is premium; anything else, unknown or absent is standard", () => {
    for (const t of FERRIS_RIDE_TYPES) expect(resolveCriteria({ rideType: t })).toMatchObject({ rideType: t, rideClass: null, tier: "ferris", basis: "ride-type" });
    expect(resolveCriteria({ rideType: "carousel" })).toMatchObject({ rideType: "carousel", tier: "standard" });
    expect(resolveCriteria({ rideType: "ferris-wheel-rental" })).toMatchObject({ rideType: null, tier: "standard", basis: "any" });
    expect(resolveCriteria({ rideType: "FERRIS-WHEEL" })).toMatchObject({ rideType: null, tier: "standard" });
    expect(resolveCriteria({})).toMatchObject({ rideType: null, rideClass: null, tier: "standard", basis: "any" });
    expect(resolveCriteria({ rideClass: "kiddie" })).toMatchObject({ rideType: null, rideClass: "kiddie", tier: "standard", basis: "ride-class" });
    expect(resolveCriteria({ rideClass: "not-a-class" })).toMatchObject({ rideClass: null, basis: "any" });
    // A ride type beats a class, so the class never widens a typed request.
    expect(resolveCriteria({ rideType: "carousel", rideClass: "kiddie" })).toMatchObject({ rideType: "carousel", rideClass: null });
    expect(tierForRideType("mini-ferris-wheel")).toBe("ferris");
    expect(tierForRideType(null)).toBe("standard");
  });

  it("the authoritative inventory classifies a listing: a Ferris listing is premium even when the submitted type is missing or false", () => {
    for (const submitted of [{}, { rideType: "" }, { rideType: "carousel" }, { rideType: "kiddie-jets", rideClass: "kiddie" }, { rideType: "not-real" }]) {
      const c = resolveCriteria({ listingId: ferrisListing.id, ...submitted });
      expect(c, JSON.stringify(submitted)).toMatchObject({ listingId: ferrisListing.id, rideType: "ferris-wheel", rideClass: null, tier: "ferris", basis: "listing" });
    }
    // ...and a non-Ferris listing is standard even when the client claims a Ferris type.
    expect(resolveCriteria({ listingId: carouselListing.id, rideType: "ferris-wheel" })).toMatchObject({ listingId: carouselListing.id, rideType: "carousel", tier: "standard", basis: "listing" });
    // An id that is not in the inventory is not a listing: it can't carry a classification.
    expect(resolveCriteria({ listingId: "00000000-0000-4000-8000-000000000000", rideType: "giant-ferris-wheel" })).toMatchObject({ listingId: null, listing: null, rideType: "giant-ferris-wheel", tier: "ferris", basis: "ride-type" });
  });

  it("matching reports the same resolved criteria and tier as pricing", async () => {
    const source = fixtureSource();
    const m = await matchOperators({ lat: 39.96, lng: -83.0, state: "OH", listingId: ferrisListing.id, rideType: "carousel" }, source, memoryContactCache());
    expect(m.criteria).toMatchObject({ rideType: "ferris-wheel", rideClass: null, listingId: ferrisListing.id, tier: "ferris" });
    const n = await matchOperators({ lat: 39.96, lng: -83.0, state: "OH", rideClass: "kiddie" }, source, memoryContactCache());
    expect(n.criteria).toMatchObject({ rideType: null, rideClass: "kiddie", tier: "standard" });
  });

  it("copy is built from the product rows: Ferris surfaces name the Ferris tier, general surfaces name both", () => {
    const products = { standard: { ...DEFAULT_PRODUCT, active: true }, ferris: { ...FERRIS_PRODUCT, active: true } };
    expect(bothTiersSentence(products)).toBe("Event Access is $99. Ferris Wheel Event Access is $199.");
    expect(accessPriceCopy(products, "giant-ferris-wheel").headline).toBe("Ferris Wheel Event Access — $199");
    expect(accessPriceCopy(products, "carousel").headline).toBe("Event Access — $99");
    expect(accessPriceCopy(products, null).sentence).toContain("Event Access is $99. Ferris Wheel Event Access is $199.");
    expect(accessPriceCopy(products, "ferris-wheel").terms).toBe("One event, up to 5 distinct operators, 30 days of access.");
    const priceChanged = { ...products, ferris: { ...products.ferris, priceCents: 24900 } };
    expect(accessPriceCopy(priceChanged, "mini-ferris-wheel").headline).toBe("Ferris Wheel Event Access — $249");
    const noFerris = { ...products, ferris: null };
    expect(accessPriceCopy(noFerris, "ferris-wheel").headline).toBe("Ferris Wheel Event Access");
    expect(accessPriceCopy(noFerris, "ferris-wheel").sentence).toMatch(/isn't available right now/);
    expect(bothTiersSentence(noFerris)).toBe("Event Access is $99.");
  });

  it("the pass email states the product and the amount actually paid", () => {
    const m = passEmail({ passUrl: "http://x/pass/open?t=abc", productName: "Ferris Wheel Event Access", amountLabel: "$199", unlockLimit: 5, matched: 7, expiresOn: "2030-07-01", eventSummary: "Columbus, OH on 2030-06-01" });
    expect(m.subject).toBe("Your Ferris Wheel Event Access pass");
    expect(m.text).toContain("Ferris Wheel Event Access ($199, one-time)");
    expect(m.text).toContain("operator contact access only");
    expect(m.html).toContain("$199");
  });
});

describe("two-tier Event Access ledger", () => {
  let db: AccessDb;
  let source: OperatorSource;
  let stripe: ReturnType<typeof fakeStripe>;
  beforeEach(() => {
    db = memoryAccessDb();
    source = fixtureSource();
    stripe = fakeStripe(SITE);
  });

  it("seeds both products idempotently and never resets a database-managed price", async () => {
    const p = await activeProducts(db);
    expect(p.standard).toMatchObject({ id: DEFAULT_PRODUCT.id, slug: "event-access", priceCents: 9900, unlockLimit: 5, validityDays: 30, minimumMatches: 3, active: true });
    expect(p.ferris).toMatchObject({ id: FERRIS_PRODUCT.id, slug: "ferris-wheel-access", name: "Ferris Wheel Event Access", priceCents: 19900, currency: "usd", unlockLimit: 5, validityDays: 30, minimumMatches: 3, active: true });
    await db.query(`UPDATE access_products SET price_cents = 24900 WHERE id = ?`, [FERRIS_PRODUCT.id]);
    expect((await productForTier(db, "ferris"))!.priceCents).toBe(24900); // the seed ran again inside and changed nothing
    expect((await db.query(`SELECT COUNT(*) AS n FROM access_products`))[0].n).toBe(2);
    expect(tierOfProduct(p.ferris!)).toBe("ferris");
    expect(tierOfProduct(p.standard!)).toBe("standard");
    expect(tierOfProduct({ slug: "something-else" })).toBeNull();
  });

  it("a standard request is quoted and charged at the standard product", async () => {
    const { event, product, sellable } = await startEventRequest(db, source, standard, cache());
    expect(sellable).toBe(true);
    expect(product.slug).toBe("event-access");
    expect(event).toMatchObject({ tier: "standard", productId: DEFAULT_PRODUCT.id, rideType: "carousel", rideClass: null, listingId: null });
    const { purchase } = await createCheckout(db, stripe, event.id, SITE);
    expect(purchase).toMatchObject({ productId: DEFAULT_PRODUCT.id, amountCents: 9900, currency: "usd", unlockLimit: 5, validityDays: 30 });
    const s = stripe.sessions.get(purchase.stripeCheckoutSessionId!)!;
    expect(s.amountTotal).toBe(9900);
    expect(s.productName).toBe("Event Access");
  });

  it("a Ferris request is quoted and charged at the Ferris product, with Stripe's line item named accordingly", async () => {
    const { event, product, sellable } = await startEventRequest(db, source, ferris, cache());
    expect(sellable).toBe(true);
    expect(product.slug).toBe("ferris-wheel-access");
    expect(event).toMatchObject({ tier: "ferris", productId: FERRIS_PRODUCT.id, rideType: "ferris-wheel" });
    const { purchase } = await createCheckout(db, stripe, event.id, SITE);
    expect(purchase).toMatchObject({ productId: FERRIS_PRODUCT.id, amountCents: 19900, currency: "usd", unlockLimit: 5, validityDays: 30 });
    const s = stripe.sessions.get(purchase.stripeCheckoutSessionId!)!;
    expect(s.amountTotal).toBe(19900);
    expect(s.productName).toBe("Ferris Wheel Event Access");
    expect(s.productDescription).toContain("Ferris wheel operators");
    expect(s.productDescription).toMatch(/Contact details for (all \d+ matching operators|5 of the \d+ matching operators, chosen by you), within 30 days/);
  });

  it("giant and mini Ferris variants are the Ferris tier too", async () => {
    // Fewer giant wheels near Columbus: the minimum is a product setting, lowered here so both variants reach checkout.
    await activeProducts(db);
    await db.query(`UPDATE access_products SET minimum_matches = 1 WHERE id = ?`, [FERRIS_PRODUCT.id]);
    for (const rideType of ["giant-ferris-wheel", "mini-ferris-wheel"]) {
      const { event, product, sellable } = await startEventRequest(db, source, { ...base, rideType }, cache());
      expect(sellable, rideType).toBe(true);
      expect(product.priceCents, rideType).toBe(19900);
      expect(event, rideType).toMatchObject({ tier: "ferris", productId: FERRIS_PRODUCT.id, rideType });
      const { purchase } = await createCheckout(db, stripe, event.id, SITE);
      expect(purchase.amountCents, rideType).toBe(19900);
      expect(stripe.sessions.get(purchase.stripeCheckoutSessionId!)!.productName).toBe("Ferris Wheel Event Access");
    }
  });

  it("a Ferris listing is the Ferris tier from every entry point, whatever the client says about its type", async () => {
    for (const submitted of [{}, { rideType: "carousel" }, { rideType: "", rideClass: "kiddie" }, { rideType: "kiddie-jets" }]) {
      const { event, product } = await startEventRequest(db, source, { ...base, listingId: ferrisListing.id, ...submitted }, cache());
      expect(product.priceCents, JSON.stringify(submitted)).toBe(19900);
      expect(event).toMatchObject({ tier: "ferris", rideType: "ferris-wheel", listingId: ferrisListing.id, productId: FERRIS_PRODUCT.id });
      expect(event.operators.some((o) => o.listings.some((l) => l.id === ferrisListing.id))).toBe(true);
    }
    // The reverse: a standard listing with a claimed Ferris type stays standard.
    const { product } = await startEventRequest(db, source, { ...base, listingId: carouselListing.id, rideType: "ferris-wheel" }, cache());
    expect(product.priceCents).toBe(9900);
  });

  it("client-posted price, product and amount fields are ignored", async () => {
    const { event, product } = await startEventRequest(db, source, { ...ferris, priceCents: "9900", price: "99", productId: DEFAULT_PRODUCT.id, product: "event-access", amount: "99", tier: "standard" }, cache());
    expect(product.priceCents).toBe(19900);
    const { purchase } = await createCheckout(db, stripe, event.id, SITE);
    expect(purchase.amountCents).toBe(19900);
    expect(stripe.sessions.get(purchase.stripeCheckoutSessionId!)!.amountTotal).toBe(19900);
  });

  it("a general or class search stays standard even when a matched operator also owns a Ferris wheel", async () => {
    const { event, product } = await startEventRequest(db, source, { ...base, rideClass: "kiddie" }, cache());
    expect(product.priceCents).toBe(9900);
    expect(event.tier).toBe("standard");
    const wheels = RIDES.filter((r) => r.rideType === "ferris-wheel" && r.homeState === "oh").map((r) => r.id);
    const owners = new Set((await source.authorsFor(wheels)).values());
    const overlap = event.operators.filter((o) => owners.has(o.operatorId));
    expect(overlap.length).toBeGreaterThan(0); // precondition: some matched operator does own a Ferris wheel
    const { purchase } = await createCheckout(db, stripe, event.id, SITE);
    expect(purchase.amountCents).toBe(9900);
  });

  it("when the Ferris product is missing or inactive, Ferris checkout is unavailable (never $99), standard is unaffected", async () => {
    const before = await startEventRequest(db, source, ferris, cache());
    await db.query(`UPDATE access_products SET active = 0 WHERE id = ?`, [FERRIS_PRODUCT.id]);
    await expect(startEventRequest(db, source, ferris, cache())).rejects.toMatchObject({ code: "unavailable", message: /Ferris Wheel Event Access is not available/ });
    await expect(startEventRequest(db, source, { ...base, listingId: ferrisListing.id }, cache())).rejects.toMatchObject({ code: "unavailable" });
    await expect(createCheckout(db, stripe, before.event.id, SITE)).rejects.toMatchObject({ code: "unavailable" });
    expect((await quoteForEvent(db, before.event)).product).toBeNull();
    expect((await db.query(`SELECT * FROM access_purchases`)).length).toBe(0);
    expect(stripe.sessions.size).toBe(0);
    const ok = await startEventRequest(db, source, standard, cache());
    expect((await createCheckout(db, stripe, ok.event.id, SITE)).purchase.amountCents).toBe(9900);
    // Re-running the seed (every product lookup does) never flips a deliberately inactive row back on.
    await activeProducts(db);
    expect(await productForTier(db, "ferris")).toBeNull();
  });

  it("the minimum contactable operators is enforced per tier product", async () => {
    await activeProducts(db);
    await db.query(`UPDATE access_products SET minimum_matches = 999 WHERE id = ?`, [FERRIS_PRODUCT.id]);
    const f = await startEventRequest(db, source, ferris, cache());
    expect(f.sellable).toBe(false);
    expect(f.event.status).toBe("insufficient");
    await expect(createCheckout(db, stripe, f.event.id, SITE)).rejects.toMatchObject({ code: "not_sellable" });
    const s = await startEventRequest(db, source, standard, cache());
    expect(s.sellable).toBe(true);
  });

  it("requote: an unpaid Ferris quote stored at the old standard terms is expired (ledger and Stripe) and requoted at the Ferris price", async () => {
    const { event } = await startEventRequest(db, source, ferris, cache());
    // Simulate a request created before the Ferris tier existed: stored against the standard product with a $99 pending checkout.
    await db.query(`UPDATE access_event_requests SET product_id = ? WHERE id = ?`, [DEFAULT_PRODUCT.id, event.id]);
    const oldSession = await stripe.createCheckoutSession({ purchaseId: "old", email: base.email, amountCents: 9900, currency: "usd", productName: "Event Access", productDescription: "", successUrl: "", cancelUrl: "" });
    await db.query(
      `INSERT INTO access_purchases (id, event_request_id, product_id, email, unlock_limit, validity_days, amount_cents, currency, stripe_checkout_session_id, status, created_at, updated_at) VALUES ('old', ?, ?, ?, 5, 30, 9900, 'usd', ?, 'pending', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')`,
      [event.id, DEFAULT_PRODUCT.id, base.email, oldSession.id],
    );
    const stale = (await getEventRequest(db, event.id))!;
    expect(stale.productId).toBe(DEFAULT_PRODUCT.id);
    const quote = await quoteForEvent(db, stale);
    expect(quote).toMatchObject({ tier: "ferris", requoted: true, sellable: true });
    expect(quote.product!.priceCents).toBe(19900); // what the matches page shows before payment

    const { purchase } = await createCheckout(db, stripe, event.id, SITE);
    expect(purchase).toMatchObject({ productId: FERRIS_PRODUCT.id, amountCents: 19900 });
    expect((await getPurchase(db, "old"))!.status).toBe("expired");
    expect(stripe.sessions.get(oldSession.id)!.status).toBe("expired");
    expect((await getEventRequest(db, event.id))!.productId).toBe(FERRIS_PRODUCT.id);
    expect((await quoteForEvent(db, (await getEventRequest(db, event.id))!)).requoted).toBe(false);
    // The expired $99 session can no longer be activated as paid... (it was never paid)
    expect((await activateFromSession(db, stripe, "old", oldSession.id, SITE)).state).toBe("expired");
  });

  it("a stale quote the customer already paid is honoured at its own terms, never voided by a requote", async () => {
    const { event } = await startEventRequest(db, source, ferris, cache());
    await db.query(`UPDATE access_event_requests SET product_id = ? WHERE id = ?`, [DEFAULT_PRODUCT.id, event.id]);
    const paidSession = await stripe.createCheckoutSession({ purchaseId: "paid-old", email: base.email, amountCents: 9900, currency: "usd", productName: "Event Access", productDescription: "", successUrl: "", cancelUrl: "" });
    await db.query(
      `INSERT INTO access_purchases (id, event_request_id, product_id, email, unlock_limit, validity_days, amount_cents, currency, stripe_checkout_session_id, status, created_at, updated_at) VALUES ('paid-old', ?, ?, ?, 5, 30, 9900, 'usd', ?, 'pending', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')`,
      [event.id, DEFAULT_PRODUCT.id, base.email, paidSession.id],
    );
    stripe.complete(paidSession.id, "paid"); // the customer paid in another tab before the webhook landed
    await createCheckout(db, stripe, event.id, SITE);
    expect((await getPurchase(db, "paid-old"))!.status).toBe("pending"); // left for activation, not expired
    const r = await activateFromSession(db, stripe, "paid-old", paidSession.id, SITE);
    expect(r.state).toBe("paid");
    const p = (await getPurchase(db, "paid-old"))!;
    expect(p).toMatchObject({ status: "paid", amountCents: 9900, productId: DEFAULT_PRODUCT.id });
    expect((await passView(db, (r as { pass: { id: string } }).pass.id))!.product.slug).toBe("event-access");
  });

  it("a payment Stripe verifies always yields a pass, even if the ledger had expired the quote first", async () => {
    const { event } = await startEventRequest(db, source, ferris, cache());
    const { purchase } = await createCheckout(db, stripe, event.id, SITE);
    expect(await handleStripeEvent(db, { id: "evt_exp", type: "checkout.session.expired", data: { object: { id: purchase.stripeCheckoutSessionId, object: "checkout.session", client_reference_id: purchase.id } } }, SITE)).toBe("expired");
    stripe.complete(purchase.stripeCheckoutSessionId!, "paid");
    const r = await activateFromSession(db, stripe, purchase.id, purchase.stripeCheckoutSessionId!, SITE);
    expect(r.state).toBe("paid");
    expect((await getPurchase(db, purchase.id))!).toMatchObject({ status: "paid", amountCents: 19900 });
    expect((await db.query(`SELECT * FROM access_passes`)).length).toBe(1);
  });

  it("refunds judge full vs partial by the amount actually purchased: $99 back on a $199 pass is partial, $199 revokes", async () => {
    const { event } = await startEventRequest(db, source, ferris, cache());
    const { purchase, pass } = await pay(db, stripe, event.id);
    expect(purchase.amountCents).toBe(19900);
    const pi = purchase.stripePaymentIntentId!;
    expect(await handleStripeEvent(db, { id: "evt_r1", type: "charge.refunded", data: { object: { object: "charge", amount: 19900, amount_refunded: 9900, payment_intent: pi } } }, SITE)).toBe("partial refund");
    expect((await getPass(db, pass.id))!.status).toBe("active");
    expect((await getPurchase(db, purchase.id))!).toMatchObject({ status: "partially_refunded", refundCents: 9900 });
    // Even when Stripe's payload omits the charge amount, the ledger's snapshot decides.
    expect(await handleStripeEvent(db, { id: "evt_r2", type: "charge.refunded", data: { object: { object: "charge", amount_refunded: 19900, payment_intent: pi } } }, SITE)).toBe("refunded, pass revoked");
    expect((await getPass(db, pass.id))!.status).toBe("revoked");
    expect((await getPurchase(db, purchase.id))!).toMatchObject({ status: "refunded", refundCents: 19900 });
    // Duplicate notifications: same event id → no-op.
    expect(await handleStripeEvent(db, { id: "evt_r2", type: "charge.refunded", data: { object: {} } }, SITE)).toBe("duplicate");
  });

  it("existing purchases and passes keep their price, allowance and duration when products change later", async () => {
    const { event } = await startEventRequest(db, source, ferris, cache());
    const { purchase, pass } = await pay(db, stripe, event.id);
    await db.query(`UPDATE access_products SET price_cents = 29900, unlock_limit = 2, validity_days = 7, name = 'Renamed' WHERE id = ?`, [FERRIS_PRODUCT.id]);
    expect((await getPurchase(db, purchase.id))!).toMatchObject({ amountCents: 19900, unlockLimit: 5, validityDays: 30 });
    expect((await getPass(db, pass.id))!.unlockLimit).toBe(5);
    const view = (await passView(db, pass.id))!;
    expect(view.purchase.amountCents).toBe(19900);
    expect(view.remaining).toBe(5);
    // A refund after the price change still measures against the amount actually paid.
    expect(await handleStripeEvent(db, { id: "evt_r3", type: "charge.refunded", data: { object: { object: "charge", amount: 19900, amount_refunded: 19900, payment_intent: purchase.stripePaymentIntentId } } }, SITE)).toBe("refunded, pass revoked");
  });

  it("a pass is bound to its own event and match snapshot: altered criteria never convert a standard pass into a Ferris one", async () => {
    const s = await startEventRequest(db, source, standard, cache());
    const { pass, purchase } = await pay(db, stripe, s.event.id);
    const f = await startEventRequest(db, source, ferris, cache());
    const ferrisOnly = f.event.operators.find((o) => !s.event.operators.some((x) => x.operatorId === o.operatorId))!;
    expect(ferrisOnly).toBeTruthy();
    await expect(unlockOperator(db, source, pass.id, ferrisOnly.operatorId, { ipHash: null, userAgent: null })).rejects.toMatchObject({ code: "forbidden" });
    // Rewriting the stored request's criteria afterwards changes neither the pass's terms nor its product.
    await db.query(`UPDATE access_event_requests SET ride_type = 'ferris-wheel', product_id = ? WHERE id = ?`, [FERRIS_PRODUCT.id, s.event.id]);
    const view = (await passView(db, pass.id))!;
    expect(view.product.slug).toBe("event-access");
    expect(view.purchase).toMatchObject({ id: purchase.id, amountCents: 9900 });
    expect(view.event.operators.map((o) => o.operatorId)).toEqual(s.event.operators.map((o) => o.operatorId));
    await expect(unlockOperator(db, source, pass.id, ferrisOnly.operatorId, { ipHash: null, userAgent: null })).rejects.toMatchObject({ code: "forbidden" });
    // And a new checkout for that rewritten request is a new, separately priced purchase, not a conversion of the paid one.
    const again = await createCheckout(db, stripe, s.event.id, SITE);
    expect(again.purchase.amountCents).toBe(19900);
    expect((await getPurchase(db, purchase.id))!).toMatchObject({ status: "paid", amountCents: 9900 });
  });
});
