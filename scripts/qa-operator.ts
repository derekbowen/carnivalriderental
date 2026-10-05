/**
 * Controlled QA operator for the Test marketplace: a placeholder company account on our domain
 * (exactly like an imported one) with one clearly labelled QA ride, so the claim → inventory →
 * inquiry → payout-readiness flow can be proven without touching any real operator's account.
 *
 *   npm run qa:operator            # idempotent: creates or reuses, prints ids
 *
 * The QA listing carries metadata.qa=true and never appears in /s. Test only.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { AUTH, createClient, INTEG, MKT } from "./lib/sharetribe-client";
import { INQUIRY_ALIAS, withNotice } from "../src/lib/operators/claim";

const COMPANY_ID = "qa-test-operator";
const CLAIM_EMAIL = "qa-test-operator@carnivalriderental.us";
const MAP = "imports/company-accounts/carnivalrental-test/mapping.json";

(async () => {
  const { call, headers } = createClient("test");
  const mapping = JSON.parse(fs.readFileSync(MAP, "utf8"));
  let entry = mapping.accounts[COMPANY_ID] as { userId: string } | undefined;
  if (!entry) {
    const anon = (await (await fetch(AUTH, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.SHARETRIBE_CLIENT_ID!, grant_type: "client_credentials", scope: "public-read" }) })).json()).access_token;
    const res = await fetch(`${MKT}/current_user/create`, {
      method: "POST",
      headers: { Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: CLAIM_EMAIL, password: crypto.randomBytes(24).toString("base64url"), firstName: "QA", lastName: "Operator", displayName: "QA Test Operator (not a real company)", publicData: { website: "https://carnivalriderental.us", companyName: "QA Test Operator" } }),
    });
    if (!res.ok) throw new Error(`create user HTTP ${res.status}`);
    const userId = (await res.json()).data.id as string;
    await call("command", `${INTEG}/users/update_profile`, { method: "POST", headers: await headers("integ", true), body: JSON.stringify({ id: userId, metadata: { claimStatus: "unclaimed", companyId: COMPANY_ID, qa: true } }) }, true);
    entry = { userId };
    mapping.accounts[COMPANY_ID] = { userId, email: CLAIM_EMAIL, companyId: COMPANY_ID, createdAt: new Date().toISOString(), qa: true };
    fs.writeFileSync(MAP, `${JSON.stringify(mapping, null, 2)}\n`);
  }
  const own = await call<{ data: { id: string }[] }>("query", `${INTEG}/listings/query?authorId=${entry.userId}&perPage=10`, { headers: await headers("integ") }, true);
  let listingId = own.data[0]?.id;
  if (!listingId) {
    const r = await call<{ data: { id: string } }>("command", `${INTEG}/listings/create`, {
      method: "POST",
      headers: await headers("integ", true),
      body: JSON.stringify({
        authorId: entry.userId,
        state: "published",
        title: "QA test ride (not a real ride)",
        description: withNotice("Test listing used to verify the operator claim and request flow. Not a real ride; never bookable."),
        geolocation: { lat: 30.3, lng: -97.7 },
        publicData: { listingType: "operator-ride-rental", transactionProcessAlias: INQUIRY_ALIAS, unitType: "inquiry", homeState: "tx", serviceStates: ["tx"], location: { address: "Austin, TX" } },
        metadata: { claimStatus: "unclaimed", companyId: COMPANY_ID, qa: true },
      }),
    }, false);
    listingId = r.data.id;
  }
  console.log(`QA operator user ${entry.userId}, listing ${listingId}`);
})().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
