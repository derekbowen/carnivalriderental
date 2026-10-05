/**
 * The Carnival Ride Rental request desk: ONE inquiry listing owned by the house account
 * (SHARETRIBE_SELLER_USER_ID, support@). Requests for rides whose operator has not claimed their
 * account are sent as inquiries on this listing, so they land in one monitored inbox (the house
 * account's) and are never presented as received by the operator.
 *
 *   npm run desk:setup              # find or create the desk listing (idempotent), print its id
 *   npm run desk:list [-- --days 30] # the queue: recent desk inquiries + unclaimed-listing inquiries
 *   npm run desk:show -- <txId>      # one request: details + message thread (as the house account)
 *   npm run desk:reply -- <txId> "message"   # reply as Carnival Ride Rental (house account)
 *
 * The house account's password (HOUSE_ACCOUNT_PASSWORD, .env.local) is the same login the team uses
 * on the marketplace to work the desk inbox in the browser.
 *
 * Test only unless --target live --founder-go.
 */
import { AUTH, createClient, INTEG, MKT } from "./lib/sharetribe-client";

async function houseToken(): Promise<string> {
  const email = process.env.SHARETRIBE_SELLER_APPROVED_EMAIL;
  const password = process.env.HOUSE_ACCOUNT_PASSWORD;
  if (!email || !password || !process.env.SHARETRIBE_CLIENT_ID) throw new Error("House account login (SHARETRIBE_SELLER_APPROVED_EMAIL / HOUSE_ACCOUNT_PASSWORD) is not configured");
  const res = await fetch(AUTH, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.SHARETRIBE_CLIENT_ID, grant_type: "password", scope: "user", username: email, password }) });
  if (!res.ok) throw new Error(`house login failed (HTTP ${res.status})`);
  return (await res.json()).access_token;
}
import { INQUIRY_ALIAS } from "../src/lib/operators/claim";

const argv = process.argv.slice(2);
const opt = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const target = (opt("target") ?? "test") as "test" | "live";
const cmd = argv[0];

const TITLE = "Carnival Ride Rental request desk";
const DESCRIPTION =
  "Ask the Carnival Ride Rental team about any ride from an operator who has not joined the marketplace yet. Tell us the ride, your event date and location; we contact the operator and reply here. Sending a request takes no payment and is not a booking.";

type L = { id: string; attributes: { title: string; state: string; metadata?: Record<string, unknown>; publicData?: Record<string, unknown> } };

(async () => {
  if (target === "live" && !argv.includes("--founder-go")) throw new Error("Refusing Live without --founder-go");
  const house = process.env.SHARETRIBE_SELLER_USER_ID;
  if (!house) throw new Error("SHARETRIBE_SELLER_USER_ID is not set");
  const { call, headers } = createClient(target);

  if (cmd === "setup") {
    const own = await call<{ data: L[] }>("query", `${INTEG}/listings/query?authorId=${house}&perPage=100`, { headers: await headers("integ") }, true);
    const found = own.data.find((l) => l.attributes.metadata?.requestDesk === true);
    if (found) {
      console.log(`Desk exists: ${found.id} (${found.attributes.state}). Set REQUEST_DESK_LISTING_ID=${found.id}`);
      return;
    }
    const res = await call<{ data: L }>("command", `${INTEG}/listings/create`, {
      method: "POST",
      headers: await headers("integ", true),
      body: JSON.stringify({
        authorId: house,
        state: "published",
        title: TITLE,
        description: DESCRIPTION,
        publicData: { listingType: "operator-ride-rental", transactionProcessAlias: INQUIRY_ALIAS, unitType: "inquiry" },
        metadata: { requestDesk: true },
      }),
    }, false);
    console.log(`Desk created: ${res.data.id}. Set REQUEST_DESK_LISTING_ID=${res.data.id}`);
    return;
  }

  if (cmd === "list") {
    const days = Number(opt("days") ?? 30);
    const since = new Date(Date.now() - days * 864e5).toISOString();
    const q = await call<{ data: { id: string; attributes: { createdAt: string; lastTransition: string; protectedData?: Record<string, unknown> }; relationships: { listing: { data: { id: string } }; provider: { data: { id: string } } } }[]; included?: { id: string; type: string; attributes: Record<string, unknown> }[] }>(
      "query", `${INTEG}/transactions/query?createdAtStart=${since}&include=listing,provider&perPage=100`, { headers: await headers("integ") }, true);
    const inc = new Map((q.included ?? []).map((i) => [`${i.type}/${i.id}`, i.attributes]));
    for (const t of q.data) {
      const listing = inc.get(`listing/${t.relationships.listing.data.id}`) as { title?: string; metadata?: Record<string, unknown> } | undefined;
      const provider = inc.get(`user/${t.relationships.provider.data.id}`) as { metadata?: Record<string, unknown>; profile?: { displayName?: string } } | undefined;
      const desk = listing?.metadata?.requestDesk === true;
      const unclaimed = provider?.metadata?.claimStatus === "unclaimed";
      if (!desk && !unclaimed) continue;
      const pd = t.attributes.protectedData ?? {};
      console.log(`${t.attributes.createdAt}  ${t.id}  ${desk ? "DESK" : `UNCLAIMED:${provider?.profile?.displayName}`}  ${String(pd.rideTitle ?? listing?.title ?? "")}  ${String(pd.eventDate ?? "")}  ${String(pd.eventCity ?? "")}`);
    }
    return;
  }
  if (cmd === "show" || cmd === "reply") {
    const txId = argv[1];
    if (!/^[0-9a-f-]{36}$/.test(txId ?? "")) throw new Error("Give a transaction id");
    const tok = await houseToken();
    const h = { Authorization: `Bearer ${tok}`, Accept: "application/json", "Content-Type": "application/json" };
    if (cmd === "reply") {
      const text = argv.slice(2).join(" ").trim();
      if (!text) throw new Error("Give the reply text");
      const r = await fetch(`${MKT}/messages/send`, { method: "POST", headers: h, body: JSON.stringify({ transactionId: txId, content: text }) });
      if (!r.ok) throw new Error(`reply failed (HTTP ${r.status})`);
      console.log(`Replied on ${txId} as Carnival Ride Rental.`);
    }
    const t = await (await fetch(`${MKT}/transactions/show?id=${txId}`, { headers: h })).json();
    const m = await (await fetch(`${MKT}/messages/query?transaction_id=${txId}&include=sender&perPage=100`, { headers: h })).json();
    const pd = (t.data?.attributes?.protectedData ?? {}) as Record<string, unknown>;
    console.log(JSON.stringify(pd, null, 2));
    // Team-only: which operator owns the requested ride (never shown to the customer).
    if (typeof pd.rideListingId === "string" && pd.rideListingId) {
      // The public profile is anonymised; the operator's real details live in the user's privateData
      // (Integration API only). Printed to the desk owner's terminal, never stored or sent anywhere.
      type U = { attributes: { profile: { displayName: string; privateData?: Record<string, unknown>; metadata?: Record<string, unknown> } } };
      const l = await call<{ data: { attributes: { title: string }; relationships: { author: { data: { id: string } } } }; included?: U[] }>("query", `${INTEG}/listings/show?id=${pd.rideListingId}&include=author`, { headers: await headers("integ") }, true);
      const p = l.included?.[0]?.attributes.profile;
      const priv = p?.privateData ?? {};
      const orig = (priv.originalProfile ?? {}) as { displayName?: string };
      const pick = (...k: string[]) => k.map((x) => priv[x]).find((v) => typeof v === "string" && v) as string | undefined;
      console.log("Operator record (team only, do not forward to the customer):");
      console.log(`  ride listing   ${pd.rideListingId}  ${l.data.attributes.title}`);
      console.log(`  operator user  ${l.data.relationships.author.data.id}  claim: ${String(p?.metadata?.claimStatus ?? "?")}`);
      console.log(`  company        ${pick("companyName", "legalName") ?? orig.displayName ?? "(not on file)"}`);
      console.log(`  contact        ${pick("contactName", "ownerName") ?? "(not on file)"}`);
      console.log(`  email          ${pick("contactEmail", "email") ?? "(not on file)"}`);
      console.log(`  phone          ${pick("contactPhone", "phone") ?? "(not on file)"}`);
      console.log(`  website        ${pick("website") ?? "(not on file)"}   base: ${pick("hqCity", "companyCity") ?? "?"}`);
    }
    const names = new Map((m.included ?? []).map((u: { id: string; attributes: { profile: { displayName: string } } }) => [u.id, u.attributes.profile.displayName]));
    for (const x of [...(m.data ?? [])].reverse()) console.log(`--- ${x.attributes.createdAt} ${names.get(x.relationships.sender.data.id) ?? "?"}\n${x.attributes.content}`);
    return;
  }
  console.log("Usage: npm run desk:setup | desk:list [-- --days N] | desk:show -- <txId> | desk:reply -- <txId> <text>");
})().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
