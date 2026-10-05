/**
 * Which Stripe account does Sharetribe TEST actually use? (No secrets printed.)
 *
 *   npm run stripe:probe
 *
 * 1. Publishable key served by the hosted Test marketplace frontend (public).
 * 2. A real PaymentIntent created by Sharetribe's backend with the Console SECRET key: the QA
 *    customer starts a booking request on the QA fixture (switched to booking for the probe and
 *    restored after). Stripe object ids embed the platform account fragment, so the PaymentIntent id
 *    shows which secret key Sharetribe used. The pending request expires on its own (no charge).
 * 3. The marketplace both API clients point at (Test vs Dev).
 */
import { AUTH, createClient, INTEG, MKT } from "./lib/sharetribe-client";

const QA_LISTING = "6ac349fd-c1ab-4ad7-afbb-fa15011f46e3";
const HOSTED = process.env.SHARETRIBE_MARKETPLACE_URL!;
const cid = () => process.env.SHARETRIBE_CLIENT_ID!;
/** Account fragment embedded in Stripe keys/ids, e.g. pk_test_51IDRRzINWe8ia… → "INWe8ia". */
const frag = (s: string) => (s.match(/^pk_(?:test|live)_51[A-Za-z0-9]{5}([A-Za-z0-9]{7})/) ?? [])[1] ?? "?";

(async () => {
  const { call, headers, marketplaceNames } = createClient("test");
  console.log("Marketplace (Integration / Marketplace API):", JSON.stringify(await marketplaceNames()));
  const html = await (await fetch(`${HOSTED}/?probe=${Date.now()}`, { headers: { "Cache-Control": "no-cache" } })).text();
  const pk = (html.match(/pk_(?:test|live)_[A-Za-z0-9]+/) ?? [""])[0];
  console.log(`Hosted Test frontend publishable key: ${pk.slice(0, 22)}… (mode ${pk.startsWith("pk_test_") ? "test" : pk ? "LIVE" : "none"}, account fragment ${frag(pk)})`);

  const login = async (u: string, p: string) => (await (await fetch(AUTH, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: cid(), grant_type: "password", scope: "user", username: u, password: p }) })).json()).access_token as string;
  const cu = await login(process.env.QA_CUSTOMER_EMAIL!, process.env.QA_CUSTOMER_PASSWORD!);
  const trusted = (await (await fetch(AUTH, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: cid(), client_secret: process.env.SHARETRIBE_CLIENT_SECRET!, grant_type: "token_exchange", scope: "trusted:user", subject_token: cu }) })).json()).access_token;
  const upd = async (pd: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
    call("command", `${INTEG}/listings/update`, { method: "POST", headers: await headers("integ", true), body: JSON.stringify({ id: QA_LISTING, publicData: pd, ...extra }) }, true);
  await upd({ listingType: "daily-booking", transactionProcessAlias: "default-booking/release-1", unitType: "day" }, { price: { amount: 10000, currency: "USD" }, availabilityPlan: { type: "availability-plan/day", entries: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((dayOfWeek) => ({ dayOfWeek, seats: 1 })) } });
  try {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() + 300 + Math.floor(Math.random() * 60));
    const end = new Date(d.getTime() + 864e5);
    const r = await fetch(`${MKT}/transactions/initiate?expand=true`, {
      method: "POST",
      headers: { Authorization: `Bearer ${trusted}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ processAlias: "default-booking/release-1", transition: "transition/request-payment", params: { listingId: QA_LISTING, bookingStart: d.toISOString(), bookingEnd: end.toISOString(), lineItems: [{ code: "line-item/day", unitPrice: { amount: 10000, currency: "USD" }, quantity: 1, includeFor: ["customer", "provider"] }] } }),
    });
    const j = await r.json();
    if (!r.ok) {
      console.log(`Booking request failed: HTTP ${r.status} ${j?.errors?.[0]?.code ?? ""} — ${j?.errors?.[0]?.title ?? ""}`);
    } else {
      const secret = String(j.data.attributes.protectedData?.stripePaymentIntents?.default?.stripePaymentIntentClientSecret ?? "");
      const piId = secret.split("_secret_")[0];
      console.log(`Sharetribe created PaymentIntent ${piId} (tx ${j.data.id}); account fragment in the id: ${piId.slice(5, 15)}`);
      console.log(piId.includes(frag(pk)) ? "MATCH: the Console secret key and the hosted publishable key are the same Stripe account." : "MISMATCH: the secret key in Console and the hosted publishable key belong to different Stripe accounts.");
    }
  } finally {
    await upd({ listingType: "operator-ride-rental", transactionProcessAlias: "default-inquiry/release-1", unitType: "inquiry" });
    console.log("QA listing restored to inquiry-only.");
  }
})().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
