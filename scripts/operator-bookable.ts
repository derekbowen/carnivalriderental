/**
 * Decide, server-side, whether an operator's listings may take bookings, and record the result in
 * listing metadata.bookable (the only flag /s trusts for "Book this ride").
 *
 *   npm run ops:bookable -- --company <companyId>            # report only
 *   npm run ops:bookable -- --company <companyId> --apply    # write metadata.bookable per listing
 *
 * Authoritative inputs: Integration API users/show (claimStatus metadata, stripeConnected),
 * listing metadata.rideApproved and price, and the commission decision in
 * src/lib/operators/program.ts. A browser redirect or a client-side flag is never an input.
 * Stripe payouts-enabled needs the Carnival Ride Rental Stripe platform key (STRIPE_SECRET_KEY,
 * test mode); without it, payout readiness is treated as NOT proven.
 */
import fs from "node:fs";
import { createClient, INTEG } from "./lib/sharetribe-client";
import { bookingBlockers } from "../src/lib/operators/claim";
import { OPERATOR_PROGRAM } from "../src/lib/operators/program";

const argv = process.argv.slice(2);
const opt = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const target = (opt("target") ?? "test") as "test" | "live";
const apply = argv.includes("--apply");

async function stripePayoutsEnabled(stripeAccountId: string | undefined): Promise<boolean> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!stripeAccountId || !key) return false;
  if (target === "test" && !key.startsWith("sk_test_")) throw new Error("Refusing: STRIPE_SECRET_KEY is not a test key");
  const r = await fetch(`https://api.stripe.com/v1/accounts/${stripeAccountId}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!r.ok) return false;
  const a = await r.json();
  return a.payouts_enabled === true && a.charges_enabled === true;
}

(async () => {
  const companyId = opt("company");
  if (!companyId) throw new Error("Usage: --company <companyId> [--apply]");
  const dir = target === "test" ? "carnivalrental-test" : "carnivalrental-live";
  const acct = Object.values(JSON.parse(fs.readFileSync(`imports/company-accounts/${dir}/mapping.json`, "utf8")).accounts as Record<string, { userId: string; companyId: string }>).find((a) => a.companyId === companyId);
  if (!acct) throw new Error(`No account for ${companyId}`);
  const { call, headers } = createClient(target);
  const u = await call<{ data: { attributes: { stripeConnected: boolean; profile: { metadata?: Record<string, unknown> } } }; included?: { type: string; attributes: { stripeAccountId?: string } }[] }>(
    "query", `${INTEG}/users/show?id=${acct.userId}&include=stripeAccount`, { headers: await headers("integ") }, true);
  const stripeAccountId = u.included?.find((i) => i.type === "stripeAccount")?.attributes.stripeAccountId;
  const payouts = u.data.attributes.stripeConnected ? await stripePayoutsEnabled(stripeAccountId) : false;
  const commissionDecided = OPERATOR_PROGRAM.customerServiceFeePct !== null;
  const listings = (await call<{ data: { id: string; attributes: { title: string; price?: { amount: number } | null; metadata?: Record<string, unknown> } }[] }>("query", `${INTEG}/listings/query?authorId=${acct.userId}&perPage=100`, { headers: await headers("integ") }, true)).data;
  console.log(`${companyId}: claim=${String(u.data.attributes.profile.metadata?.claimStatus)} stripeConnected=${u.data.attributes.stripeConnected} payoutsEnabled=${payouts} commissionDecided=${commissionDecided}`);
  for (const l of listings) {
    const blockers = bookingBlockers({
      claimStatus: u.data.attributes.profile.metadata?.claimStatus,
      stripeConnected: u.data.attributes.stripeConnected,
      stripePayoutsEnabled: payouts,
      rideApproved: l.attributes.metadata?.rideApproved,
      priceAmount: l.attributes.price?.amount ?? null,
      commissionDecided,
    });
    const bookable = blockers.length === 0;
    console.log(`  ${l.id} ${l.attributes.title}: ${bookable ? "BOOKABLE" : `not bookable — ${blockers.join("; ")}`}`);
    if (apply && l.attributes.metadata?.bookable !== bookable) {
      await call("command", `${INTEG}/listings/update`, { method: "POST", headers: await headers("integ", true), body: JSON.stringify({ id: l.id, metadata: { bookable } }) }, true);
    }
  }
})().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
