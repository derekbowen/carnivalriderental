/**
 * Test-mode payment proof on the Sharetribe Test marketplace with the QA operator and QA customer
 * only. Uses Sharetribe's own Stripe integration (default-booking/release-1, destination charges,
 * commission as application fee) and the Stripe TEST publishable key already configured on the
 * Test marketplace. Card data never touches our code: Stripe's test PaymentMethods are used.
 *
 *   npm run qa:payment
 *
 * Steps: QA operator payout onboarding (Custom account via Stripe test tokens) → QA listing switched
 * to the booking type with a QA test price → customer requests + pays (pm_card_visa) → operator
 * accepts (capture) → marketplace cancels (refund). Negative: declined card, same dates twice.
 * Refuses unless the Stripe key is a test key and the listing is the QA fixture.
 */
import { AUTH, createClient, INTEG, MKT } from "./lib/sharetribe-client";

const QA_LISTING = "6ac349fd-c1ab-4ad7-afbb-fa15011f46e3";
const BOOKING_ALIAS = "default-booking/release-1";
const cid = () => process.env.SHARETRIBE_CLIENT_ID!;
let PK = "";
const out = (ok: boolean, s: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${s}`);
  if (!ok) process.exitCode = 1;
};

async function tok(u: string, p: string) {
  const r = await fetch(AUTH, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: cid(), grant_type: "password", scope: "user", username: u, password: p }) });
  if (!r.ok) throw new Error(`login ${u} HTTP ${r.status}`);
  return (await r.json()).access_token as string;
}
/** Trusted token (client secret exchange): privileged transitions set line items server-side, as the hosted marketplace does. */
async function trusted(userToken: string) {
  const r = await fetch(AUTH, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: cid(), client_secret: process.env.SHARETRIBE_CLIENT_SECRET!, grant_type: "token_exchange", scope: "trusted:user", subject_token: userToken }) });
  if (!r.ok) throw new Error(`token exchange HTTP ${r.status}`);
  return (await r.json()).access_token as string;
}
/** Line items exactly as the hosted marketplace builds them from Console's commission asset. */
async function lineItems(priceAmount: number, nights: number) {
  const a = await (await fetch(`https://cdn.st-api.com/v1/assets/pub/${cid()}/a/latest/transactions/commission.json`)).json();
  const pct = Number(a?.data?.providerCommission?.percentage ?? 0);
  const items: Record<string, unknown>[] = [{ code: "line-item/day", unitPrice: { amount: priceAmount, currency: "USD", _type: "money" }, quantity: nights, includeFor: ["customer", "provider"] }];
  if (pct > 0) items.push({ code: "line-item/provider-commission", unitPrice: { amount: priceAmount * nights, currency: "USD" }, percentage: -pct, includeFor: ["provider"] });
  console.log(`      Console commission asset: provider ${pct}%`);
  return items.map((i) => ({ ...i, unitPrice: { amount: (i.unitPrice as { amount: number }).amount, currency: "USD" } }));
}
async function mkt(t: string, path: string, body?: unknown) {
  const r = await fetch(`${MKT}${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${t}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, j: await r.json().catch(() => null) };
}
async function stripe(path: string, form: Record<string, string>) {
  const r = await fetch(`https://api.stripe.com/v1${path}`, { method: "POST", headers: { Authorization: `Bearer ${PK}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form) });
  return { status: r.status, j: await r.json() };
}
const day = (offset: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString();
};

(async () => {
  // The publishable key the Test marketplace actually serves (public), so the proof always uses the
  // same Stripe account as Sharetribe's Console secret key.
  const html = await (await fetch(`${process.env.SHARETRIBE_MARKETPLACE_URL}/?k=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } })).text();
  PK = (html.match(/pk_test_[A-Za-z0-9]+/) ?? [""])[0];
  if (!PK.startsWith("pk_test_")) throw new Error("The Test marketplace does not serve a pk_test_ key; refusing (test mode only)");
  console.log(`      Stripe publishable key served by Test marketplace: ${PK.slice(0, 22)}…`);
  const { call, headers } = createClient("test");
  const op = await tok(process.env.QA_OPERATOR_EMAIL!, process.env.QA_OPERATOR_PASSWORD!);

  // 1. Operator payout onboarding (Stripe Custom account through Sharetribe).
  let me = await mkt(op, "/current_user/show");
  if (!me.j.data.attributes.stripeConnected) {
    const acct = await stripe("/tokens", {
      "account[business_type]": "individual",
      "account[individual][first_name]": "QA",
      "account[individual][last_name]": "Operator",
      "account[individual][email]": process.env.QA_OPERATOR_EMAIL!,
      "account[individual][phone]": "+15125550100",
      "account[individual][dob][day]": "1", "account[individual][dob][month]": "1", "account[individual][dob][year]": "1901",
      "account[individual][address][line1]": "address_full_match", "account[individual][address][city]": "Austin", "account[individual][address][state]": "TX", "account[individual][address][postal_code]": "78701", "account[individual][address][country]": "US",
      "account[individual][id_number]": "000000000",
      "account[tos_shown_and_accepted]": "true",
    });
    const bank = await stripe("/tokens", { "bank_account[country]": "US", "bank_account[currency]": "usd", "bank_account[routing_number]": "110000000", "bank_account[account_number]": "000123456789", "bank_account[account_holder_name]": "QA Operator", "bank_account[account_holder_type]": "individual" });
    if (!acct.j.id || !bank.j.id) throw new Error(`stripe token failed: ${acct.j.error?.message ?? bank.j.error?.message}`);
    const c = await mkt(op, "/stripe_account/create", { country: "US", accountToken: acct.j.id, bankAccountToken: bank.j.id, requestedCapabilities: ["card_payments", "transfers"], businessProfileMCC: "7999", businessProfileURL: "https://carnivalriderental.us", businessProfileProductDescription: "Carnival ride rental (QA test operator)" });
    out(c.status === 200, `QA operator onboarded to Stripe (test) through Sharetribe (HTTP ${c.status}${c.j?.errors ? ` ${JSON.stringify(c.j.errors[0]?.code)}` : ""})`);
    me = await mkt(op, "/current_user/show");
  }
  out(me.j.data.attributes.stripeConnected === true, "operator stripeConnected=true (authoritative, from Sharetribe)");
  const sa = await mkt(op, "/stripe_account/fetch");
  if (sa.status !== 200) throw new Error(`Operator's Stripe account is not readable with the current platform keys (HTTP ${sa.status}); it belongs to another Stripe account. Create a fresh QA operator.`);
  const req = sa.j?.data?.attributes?.stripeAccountData?.requirements ?? {};
  console.log(`      Stripe requirements currently_due=${JSON.stringify(req.currently_due ?? [])} charges_enabled=${sa.j?.data?.attributes?.stripeAccountData?.charges_enabled}`);

  // 2. QA listing → booking type with a QA test price and daily availability (QA fixture only).
  await call("command", `${INTEG}/listings/update`, { method: "POST", headers: await headers("integ", true), body: JSON.stringify({
    id: QA_LISTING,
    price: { amount: 10000, currency: "USD", _type: "money" },
    availabilityPlan: { type: "availability-plan/day", entries: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((dayOfWeek) => ({ dayOfWeek, seats: 1 })) },
    publicData: { listingType: "daily-booking", transactionProcessAlias: BOOKING_ALIAS, unitType: "day" },
  }) }, true).catch(async (e) => {
    // Integration API expects price as {amount, currency}; retry without the type hint.
    await call("command", `${INTEG}/listings/update`, { method: "POST", headers: await headers("integ", true), body: JSON.stringify({ id: QA_LISTING, price: { amount: 10000, currency: "USD" }, availabilityPlan: { type: "availability-plan/day", entries: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((dayOfWeek) => ({ dayOfWeek, seats: 1 })) }, publicData: { listingType: "daily-booking", transactionProcessAlias: BOOKING_ALIAS, unitType: "day" } }) }, true);
    void e;
  });

  // 3. Customer requests + pays.
  const cu = await tok(process.env.QA_CUSTOMER_EMAIL!, process.env.QA_CUSTOMER_PASSWORD!);
  const base = 40 + Math.floor(Math.random() * 200);
  const start = day(base), end = day(base + 1);
  const cuT = await trusted(cu);
  const items = await lineItems(10000, 1);
  const init = await mkt(cuT, "/transactions/initiate?expand=true&include=booking", { processAlias: BOOKING_ALIAS, transition: "transition/request-payment", params: { listingId: QA_LISTING, bookingStart: start, bookingEnd: end, lineItems: items } });
  out(init.status === 200, `customer requests a booking ${start.slice(0, 10)} (tx ${init.j?.data?.id}, HTTP ${init.status}${init.j?.errors ? ` ${init.j.errors[0]?.code}` : ""})`);
  if (init.status !== 200) return;
  const tx = init.j.data;
  if (!tx?.attributes) { console.log(JSON.stringify(init.j).slice(0, 600)); return; }
  const li = tx.attributes.lineItems as { code: string; lineTotal: { amount: number }; includeFor: string[] }[];
  console.log(`      line items: ${li.map((l) => `${l.code}=${l.lineTotal.amount}(${l.includeFor.join("+")})`).join(", ")}; payinTotal=${tx.attributes.payinTotal?.amount} payoutTotal=${tx.attributes.payoutTotal?.amount}`);
  const pi = tx.attributes.protectedData?.stripePaymentIntents?.default;
  const piId = String(pi?.stripePaymentIntentClientSecret ?? "").split("_secret_")[0];
  const conf = await stripe(`/payment_intents/${piId}/confirm`, { client_secret: pi.stripePaymentIntentClientSecret, payment_method: "pm_card_visa" });
  out(conf.j.status === "requires_capture", `Stripe test card authorised (PaymentIntent ${piId}: ${conf.j.status ?? conf.j.error?.message})`);
  const cp = await mkt(cu, "/transactions/transition", { id: tx.id, transition: "transition/confirm-payment", params: {} });
  out(cp.status === 200, `transaction moved to preauthorized (HTTP ${cp.status})`);

  // Duplicate: the same dates again cannot be booked (1 seat).
  const dup = await mkt(cuT, "/transactions/initiate", { processAlias: BOOKING_ALIAS, transition: "transition/request-payment", params: { listingId: QA_LISTING, bookingStart: start, bookingEnd: end, lineItems: items } });
  out(dup.status >= 400, `a second booking for the same dates is refused (HTTP ${dup.status} ${dup.j?.errors?.[0]?.code ?? ""})`);

  // 4. Operator accepts → capture.
  const acc = await mkt(op, "/transactions/transition", { id: tx.id, transition: "transition/accept", params: {} });
  out(acc.status === 200, `operator accepts (HTTP ${acc.status}); provider = QA operator`);
  const piAfter = await (await fetch(`https://api.stripe.com/v1/payment_intents/${piId}?client_secret=${encodeURIComponent(pi.stripePaymentIntentClientSecret)}`, { headers: { Authorization: `Bearer ${PK}` } })).json();
  out(piAfter.status === "succeeded", `Stripe PaymentIntent captured on accept (status ${piAfter.status}, amount ${piAfter.amount})`);

  // 5. Marketplace cancels → refund.
  const can = await call<{ data: { attributes: { lastTransition: string } } }>("command", `${INTEG}/transactions/transition?expand=true`, { method: "POST", headers: await headers("integ", true), body: JSON.stringify({ id: tx.id, transition: "transition/cancel", params: {} }) }, false).catch((e) => ({ error: (e as Error).message }) as never);
  out(!!(can as { data?: unknown }).data, `marketplace cancels the accepted booking → full refund (${(can as { data?: { attributes: { lastTransition: string } } }).data?.attributes.lastTransition ?? (can as unknown as { error: string }).error})`);

  // 6. Declined card never becomes a booking.
  const s2 = day(base + 2), e2 = day(base + 3);
  const i2 = await mkt(cuT, "/transactions/initiate?expand=true", { processAlias: BOOKING_ALIAS, transition: "transition/request-payment", params: { listingId: QA_LISTING, bookingStart: s2, bookingEnd: e2, lineItems: items } });
  if (i2.status === 200) {
    const p2 = i2.j.data.attributes.protectedData.stripePaymentIntents.default;
    const c2 = await stripe(`/payment_intents/${String(p2.stripePaymentIntentClientSecret).split("_secret_")[0]}/confirm`, { client_secret: p2.stripePaymentIntentClientSecret, payment_method: "pm_card_chargeDeclined" });
    const t2 = await mkt(cu, "/transactions/transition", { id: i2.j.data.id, transition: "transition/confirm-payment", params: {} });
    out(c2.j.status !== "requires_capture" && t2.status >= 400, `declined card: no authorisation (${c2.j.error?.code ?? c2.j.status}) and confirm-payment refused (HTTP ${t2.status}); tx ${i2.j.data.id} stays pending-payment and expires`);
  }

  // 7. Cancellation BEFORE capture: operator declines a preauthorized request → authorization released.
  const book = async (who: string, startOff: number, pm: string) => {
    const r = await mkt(who, "/transactions/initiate?expand=true", { processAlias: BOOKING_ALIAS, transition: "transition/request-payment", params: { listingId: QA_LISTING, bookingStart: day(startOff), bookingEnd: day(startOff + 1), lineItems: items } });
    if (r.status !== 200) return { status: r.status, code: r.j?.errors?.[0]?.code as string | undefined };
    const p = r.j.data.attributes.protectedData.stripePaymentIntents.default;
    const id = String(p.stripePaymentIntentClientSecret).split("_secret_")[0];
    const c = await stripe(`/payment_intents/${id}/confirm`, { client_secret: p.stripePaymentIntentClientSecret, payment_method: pm });
    return { status: 200, txId: r.j.data.id as string, piId: id, secret: p.stripePaymentIntentClientSecret as string, piStatus: c.j.status as string };
  };
  const piStatus = async (id: string, secret: string) => (await (await fetch(`https://api.stripe.com/v1/payment_intents/${id}?client_secret=${encodeURIComponent(secret)}`, { headers: { Authorization: `Bearer ${PK}` } })).json()).status as string;
  const b7 = await book(cuT, base + 4, "pm_card_visa");
  if (b7.txId) {
    await mkt(cu, "/transactions/transition", { id: b7.txId, transition: "transition/confirm-payment", params: {} });
    const dec = await mkt(op, "/transactions/transition", { id: b7.txId, transition: "transition/decline", params: {} });
    const st = await piStatus(b7.piId!, b7.secret!);
    out(dec.status === 200 && st === "canceled", `cancellation before capture: operator declines → authorization released (tx ${b7.txId}, ${b7.piId}: ${b7.piStatus} → ${st})`);
  } else out(false, `cancellation-before-capture setup failed (HTTP ${b7.status} ${b7.code ?? ""})`);

  // 8. Two customers, one slot: customer 1 holds the date; customer 2 is refused.
  const cu2 = await tok(process.env.QA_CUSTOMER2_EMAIL!, process.env.QA_CUSTOMER2_PASSWORD!);
  const cu2T = await trusted(cu2);
  const b8 = await book(cuT, base + 6, "pm_card_visa");
  if (b8.txId) await mkt(cu, "/transactions/transition", { id: b8.txId, transition: "transition/confirm-payment", params: {} });
  const b8b = await book(cu2T, base + 6, "pm_card_visa");
  out(!!b8.txId && b8b.status === 409, `two customers, same slot: customer 1 holds it (tx ${b8.txId}); customer 2 refused (HTTP ${b8b.status} ${b8b.code ?? ""}), no PaymentIntent created for customer 2`);
  if (b8.txId) await mkt(op, "/transactions/transition", { id: b8.txId, transition: "transition/decline", params: {} });

  // 9. Duplicate submission: the same request fired twice at once → exactly one transaction.
  const [d1, d2] = await Promise.all([book(cuT, base + 8, "pm_card_visa"), book(cuT, base + 8, "pm_card_visa")]);
  const ok = [d1, d2].filter((d) => d.status === 200);
  out(ok.length === 1, `duplicate submission (two simultaneous requests): ${ok.length} created (tx ${ok.map((d) => d.txId).join(",")}), other refused (HTTP ${[d1, d2].find((d) => d.status !== 200)?.status ?? "-"})`);
  for (const d of ok) {
    await mkt(cu, "/transactions/transition", { id: d.txId, transition: "transition/confirm-payment", params: {} });
    await mkt(op, "/transactions/transition", { id: d.txId, transition: "transition/decline", params: {} });
  }

  // Restore the QA listing to inquiry-only so nothing stays bookable.
  await call("command", `${INTEG}/listings/update`, { method: "POST", headers: await headers("integ", true), body: JSON.stringify({ id: QA_LISTING, publicData: { listingType: "operator-ride-rental", transactionProcessAlias: "default-inquiry/release-1", unitType: "inquiry" } }) }, true);
  console.log("      QA listing restored to inquiry-only.");
})().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
