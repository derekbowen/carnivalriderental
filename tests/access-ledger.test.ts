import { beforeEach, describe, expect, it } from "vitest";
import { activeProduct, DEFAULT_PRODUCT } from "@/lib/access/config";
import { fixtureSource, type OperatorSource } from "@/lib/access/contacts";
import { memoryAccessDb, type AccessDb } from "@/lib/access/db";
import { memoryContactCache } from "@/lib/access/matching";
import { activateFromSession, activatePurchase, createCheckout, getPass, getPurchase, handleStripeEvent, issueMagicLink, redeemMagicLink, reportDeadContact, restoreUnlockCredit, startEventRequest, unlockOperator, passView } from "@/lib/access/service";
import { fakeStripe } from "@/lib/access/stripe";

const SITE = "http://test.local";
const columbus = { email: "buyer@example.com", eventDate: "2030-06-01", city: "Columbus", state: "OH", rideType: "ferris-wheel" };

async function paidPass(db: AccessDb, source: OperatorSource, stripe = fakeStripe(SITE)) {
  const { event, sellable } = await startEventRequest(db, source, columbus, { cache: memoryContactCache() });
  expect(sellable).toBe(true);
  const { purchase, url } = await createCheckout(db, stripe, event.id, SITE);
  expect(url).toContain("/api/access/dev-checkout?cs=");
  stripe.complete(purchase.stripeCheckoutSessionId!, "paid");
  const r = await activateFromSession(db, stripe, purchase.id, purchase.stripeCheckoutSessionId!, SITE);
  if (r.state !== "paid") throw new Error(`expected paid, got ${r.state}`);
  return { event, purchase, pass: r.pass, stripe };
}

describe("Event Access ledger", () => {
  let db: AccessDb;
  const source = fixtureSource();
  beforeEach(() => {
    db = memoryAccessDb();
  });

  it("pricing is configuration: the product row, not code, sets price, limit, validity and minimum", async () => {
    const p = (await activeProduct(db))!;
    expect(p).toMatchObject({ slug: "event-access", priceCents: 9900, currency: "usd", unlockLimit: 5, validityDays: 30, minimumMatches: 3 });
    await db.query(`UPDATE access_products SET price_cents = 4900, unlock_limit = 3, validity_days = 7, minimum_matches = 2 WHERE id = ?`, [DEFAULT_PRODUCT.id]);
    const changed = (await activeProduct(db))!;
    expect(changed).toMatchObject({ priceCents: 4900, unlockLimit: 3, validityDays: 7, minimumMatches: 2 });
    const { purchase, pass } = await paidPass(db, source);
    expect(purchase.amountCents).toBe(4900);
    expect(pass.unlockLimit).toBe(3);
    // Later price changes never alter an existing purchase or pass.
    await db.query(`UPDATE access_products SET price_cents = 14900, unlock_limit = 10 WHERE id = ?`, [DEFAULT_PRODUCT.id]);
    expect((await getPurchase(db, purchase.id))!.amountCents).toBe(4900);
    expect((await getPass(db, pass.id))!.unlockLimit).toBe(3);
  });

  it("refuses to sell below the minimum contactable matches, but still records the request", async () => {
    await activeProduct(db); // seeds the default row
    await db.query(`UPDATE access_products SET minimum_matches = 999 WHERE id = ?`, [DEFAULT_PRODUCT.id]);
    const { event, sellable } = await startEventRequest(db, source, columbus, { cache: memoryContactCache() });
    expect(sellable).toBe(false);
    expect(event.status).toBe("insufficient");
    const stripe = fakeStripe(SITE);
    await expect(createCheckout(db, stripe, event.id, SITE)).rejects.toThrow(/Not enough contactable operators/);
    expect(stripe.sessions.size).toBe(0);
  });

  it("validates input: past dates, bad states and bad emails never reach matching", async () => {
    await expect(startEventRequest(db, source, { ...columbus, eventDate: "2001-01-01" })).rejects.toThrow(/from today/);
    await expect(startEventRequest(db, source, { ...columbus, state: "ZZ" })).rejects.toThrow(/state/);
    await expect(startEventRequest(db, source, { ...columbus, email: "nope" })).rejects.toThrow(/email/);
  });

  it("checkout uses the server-side amount and never trusts the browser", async () => {
    const stripe = fakeStripe(SITE);
    const { event } = await startEventRequest(db, source, columbus, { cache: memoryContactCache() });
    const { purchase } = await createCheckout(db, stripe, event.id, SITE);
    const s = stripe.sessions.get(purchase.stripeCheckoutSessionId!)!;
    expect(s.amountTotal).toBe(9900);
    expect(s.purchaseId).toBe(purchase.id);
    expect(purchase.status).toBe("pending");
    expect(await getPass(db, "x")).toBeNull();
  });

  it("activation is server-verified: an unpaid session creates nothing; a paid one creates exactly one pass", async () => {
    const stripe = fakeStripe(SITE);
    const { event } = await startEventRequest(db, source, columbus, { cache: memoryContactCache() });
    const { purchase } = await createCheckout(db, stripe, event.id, SITE);
    const cs = purchase.stripeCheckoutSessionId!;
    expect((await activateFromSession(db, stripe, purchase.id, cs, SITE)).state).toBe("pending");
    expect((await db.query(`SELECT * FROM access_passes`)).length).toBe(0);
    stripe.complete(cs, "paid");
    const a = await activateFromSession(db, stripe, purchase.id, cs, SITE);
    const b = await activateFromSession(db, stripe, purchase.id, cs, SITE);
    expect(a.state).toBe("paid");
    expect(b.state).toBe("paid");
    expect((await db.query(`SELECT * FROM access_passes`)).length).toBe(1);
    expect((await getPurchase(db, purchase.id))!.status).toBe("paid");
  });

  it("a session for another purchase is rejected", async () => {
    const stripe = fakeStripe(SITE);
    const a = await startEventRequest(db, source, columbus, { cache: memoryContactCache() });
    const b = await startEventRequest(db, source, { ...columbus, email: "other@example.com" }, { cache: memoryContactCache() });
    const pa = await createCheckout(db, stripe, a.event.id, SITE);
    const pb = await createCheckout(db, stripe, b.event.id, SITE);
    stripe.complete(pb.purchase.stripeCheckoutSessionId!, "paid");
    expect((await activateFromSession(db, stripe, pa.purchase.id, pb.purchase.stripeCheckoutSessionId!, SITE)).state).toBe("mismatch");
  });

  it("webhook: completed activates once, duplicates are no-ops, expired/failed never activate", async () => {
    const stripe = fakeStripe(SITE);
    const { event } = await startEventRequest(db, source, columbus, { cache: memoryContactCache() });
    const { purchase } = await createCheckout(db, stripe, event.id, SITE);
    const cs = purchase.stripeCheckoutSessionId!;
    const completed = { id: "evt_1", type: "checkout.session.completed", data: { object: { id: cs, object: "checkout.session", client_reference_id: purchase.id, payment_status: "paid", status: "complete", payment_intent: "pi_1" } } };
    expect(await handleStripeEvent(db, completed, SITE)).toBe("pass created");
    expect(await handleStripeEvent(db, completed, SITE)).toBe("duplicate");
    expect(await handleStripeEvent(db, { ...completed, id: "evt_2" }, SITE)).toBe("already active");
    expect((await db.query(`SELECT * FROM access_passes`)).length).toBe(1);
    expect((await getPurchase(db, purchase.id))!.stripePaymentIntentId).toBe("pi_1");

    const other = await startEventRequest(db, source, { ...columbus, email: "b@example.com" }, { cache: memoryContactCache() });
    const p2 = await createCheckout(db, stripe, other.event.id, SITE);
    expect(await handleStripeEvent(db, { id: "evt_3", type: "checkout.session.expired", data: { object: { id: p2.purchase.stripeCheckoutSessionId, object: "checkout.session", client_reference_id: p2.purchase.id } } }, SITE)).toBe("expired");
    expect((await getPurchase(db, p2.purchase.id))!.status).toBe("expired");
    expect(await handleStripeEvent(db, { id: "evt_4", type: "checkout.session.completed", data: { object: { id: p2.purchase.stripeCheckoutSessionId, object: "checkout.session", client_reference_id: p2.purchase.id, payment_status: "unpaid", status: "open" } } }, SITE)).toBe("not paid yet");
    expect((await db.query(`SELECT * FROM access_passes`)).length).toBe(1);
  });

  it("unlocks: per operator, free re-open, hard limit, audit snapshot", async () => {
    const { event, pass } = await paidPass(db, source);
    const ops = event.operators;
    expect(ops.length).toBeGreaterThanOrEqual(5);
    const meta = { ipHash: "h", userAgent: "vitest" };
    const first = await unlockOperator(db, source, pass.id, ops[0].operatorId, meta);
    expect(first.consumed).toBe(true);
    expect(first.unlock.contact.companyName).toMatch(/Fixture Amusements/);
    expect(first.unlock.contact.phone || first.unlock.contact.email || first.unlock.contact.website).toBeTruthy();
    const again = await unlockOperator(db, source, pass.id, ops[0].operatorId, meta);
    expect(again.consumed).toBe(false);
    expect((await getPass(db, pass.id))!.unlockedCount).toBe(1);
    for (const op of ops.slice(1, 5)) await unlockOperator(db, source, pass.id, op.operatorId, meta);
    expect((await getPass(db, pass.id))!.unlockedCount).toBe(5);
    await expect(unlockOperator(db, source, pass.id, ops[5].operatorId, meta)).rejects.toMatchObject({ code: "limit" });
    expect((await db.query(`SELECT * FROM access_unlocks WHERE pass_id = ?`, [pass.id])).length).toBe(5);
    const view = (await passView(db, pass.id))!;
    expect(view.remaining).toBe(0);
    expect(view.unlocks[0].contact).toEqual(first.unlock.contact);
  });

  it("an operator outside the pass's match set can't be unlocked", async () => {
    const { pass } = await paidPass(db, source);
    await expect(unlockOperator(db, source, pass.id, "op-fixture-ak-0", { ipHash: null, userAgent: null })).rejects.toMatchObject({ code: "forbidden" });
  });

  it("concurrent unlock requests never exceed the limit", async () => {
    const { event, pass } = await paidPass(db, source);
    const results = await Promise.allSettled(event.operators.slice(0, 12).map((op) => unlockOperator(db, source, pass.id, op.operatorId, { ipHash: null, userAgent: null })));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    expect(ok).toBe(5);
    expect((await getPass(db, pass.id))!.unlockedCount).toBe(5);
    expect((await db.query(`SELECT * FROM access_unlocks WHERE pass_id = ?`, [pass.id])).length).toBe(5);
  });

  it("expired and revoked passes keep their unlocks visible but refuse new ones", async () => {
    const { event, pass, purchase } = await paidPass(db, source);
    await unlockOperator(db, source, pass.id, event.operators[0].operatorId, { ipHash: null, userAgent: null });
    const later = new Date(Date.now() + 40 * 864e5);
    await expect(unlockOperator(db, source, pass.id, event.operators[1].operatorId, { ipHash: null, userAgent: null }, later)).rejects.toMatchObject({ code: "expired" });
    expect((await passView(db, pass.id, later))!.usable).toBe(false);

    const refund = { id: "evt_r", type: "charge.refunded", data: { object: { object: "charge", amount: 9900, amount_refunded: 9900, payment_intent: purchase.stripePaymentIntentId ?? `pi_fake_${purchase.stripeCheckoutSessionId!.slice(-8)}` } } };
    expect(await handleStripeEvent(db, refund, SITE)).toBe("refunded, pass revoked");
    const p = (await getPurchase(db, purchase.id))!;
    expect(p.status).toBe("refunded");
    expect(p.refundCents).toBe(9900);
    const v = (await passView(db, pass.id))!;
    expect(v.pass.status).toBe("revoked");
    expect(v.unlocks.length).toBe(1);
    await expect(unlockOperator(db, source, pass.id, event.operators[2].operatorId, { ipHash: null, userAgent: null })).rejects.toMatchObject({ code: "revoked" });
  });

  it("partial refunds keep the pass; disputes revoke it", async () => {
    const { pass, purchase } = await paidPass(db, source);
    const pi = purchase.stripePaymentIntentId ?? `pi_fake_${purchase.stripeCheckoutSessionId!.slice(-8)}`;
    expect(await handleStripeEvent(db, { id: "evt_p", type: "charge.refunded", data: { object: { object: "charge", amount: 9900, amount_refunded: 2000, payment_intent: pi } } }, SITE)).toBe("partial refund");
    expect((await getPass(db, pass.id))!.status).toBe("active");
    expect(await handleStripeEvent(db, { id: "evt_d", type: "charge.dispute.created", data: { object: { object: "dispute", payment_intent: pi } } }, SITE)).toBe("disputed, pass revoked");
    expect((await getPass(db, pass.id))!.status).toBe("revoked");
    expect((await getPurchase(db, purchase.id))!.status).toBe("disputed");
  });

  it("dead-contact report keeps the audit; a restored credit gives one unlock back, once", async () => {
    const { event, pass } = await paidPass(db, source);
    const op = event.operators[0].operatorId;
    await unlockOperator(db, source, pass.id, op, { ipHash: null, userAgent: null });
    expect(await restoreUnlockCredit(db, pass.id, op)).toBe(false); // not reported yet
    expect(await reportDeadContact(db, pass.id, op)).toBe(true);
    expect(await restoreUnlockCredit(db, pass.id, op)).toBe(true);
    expect(await restoreUnlockCredit(db, pass.id, op)).toBe(false);
    expect((await getPass(db, pass.id))!.unlockedCount).toBe(0);
    expect((await db.query(`SELECT * FROM access_unlocks WHERE pass_id = ?`, [pass.id])).length).toBe(1);
  });

  it("magic links open the pass and expire", async () => {
    const { pass } = await paidPass(db, source);
    const { token } = await issueMagicLink(db, pass.id, 14);
    expect(await redeemMagicLink(db, token)).toBe(pass.id);
    expect(await redeemMagicLink(db, "not-a-token")).toBeNull();
    const old = await issueMagicLink(db, pass.id, -1);
    expect(await redeemMagicLink(db, old.token)).toBeNull();
  });

  it("direct activation without a pending purchase is refused", async () => {
    await expect(activatePurchase(db, "00000000-0000-0000-0000-000000000000", { sessionId: null, paymentIntentId: null }, { siteUrl: SITE, sendEmail: false })).rejects.toMatchObject({ code: "not_found" });
  });
});
