// Read-only: verify the controlled inquiry landed on the desk with the right ride, date and location.
import { createClient, INTEG } from "../../scripts/lib/sharetribe-client";
const txId = process.argv[2];
(async () => {
  const { call, headers } = createClient("test");
  const t = await call<{ data: { attributes: { processName: string; lastTransition: string; payinTotal: unknown; protectedData: Record<string, unknown> }; relationships: { listing: { data: { id: string } }; provider: { data: { id: string } }; customer: { data: { id: string } } } }; included?: { id: string; type: string; attributes: Record<string, unknown> }[] }>(
    "query", `${INTEG}/transactions/show?id=${txId}&include=listing,provider`, { headers: await headers("integ") }, true);
  const a = t.data.attributes, r = t.data.relationships;
  const listing = t.included?.find((i) => i.type === "listing")?.attributes as { title?: string; metadata?: Record<string, unknown> } | undefined;
  const pd = a.protectedData;
  console.log(JSON.stringify({
    process: a.processName, lastTransition: a.lastTransition, payinTotal: a.payinTotal ?? null,
    txListing: r.listing.data.id, txListingTitle: listing?.title, txListingIsDesk: listing?.metadata?.requestDesk === true,
    deskListingEnv: process.env.REQUEST_DESK_LISTING_ID, matchesDesk: r.listing.data.id === process.env.REQUEST_DESK_LISTING_ID,
    providerIsHouse: r.provider.data.id === process.env.SHARETRIBE_SELLER_USER_ID,
    rideListingId: pd.rideListingId, rideTitle: pd.rideTitle, eventDate: pd.eventDate, startTime: pd.startTime, endTime: pd.endTime,
    eventCity: pd.eventCity, eventState: pd.eventState, eventZip: pd.eventZip, eventAddress: pd.eventAddress, guests: pd.guests,
  }, null, 2));
})().catch((e) => { console.error((e as Error).message); process.exit(1); });
