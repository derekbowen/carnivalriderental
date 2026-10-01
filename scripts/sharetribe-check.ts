/** Read-only Sharetribe check: marketplace name and listing/user counts. Prints no secrets. */
import { integrationGet, sharetribeConnection } from "../src/lib/integrations/sharetribe";

(async () => {
  const c = await sharetribeConnection(true);
  console.log(`Sharetribe: ${c.state}${c.marketplaceName ? ` — marketplace "${c.marketplaceName}"` : ""}`);
  if (c.state !== "connected-readonly") {
    console.log(c.detail);
    process.exit(1);
  }
  type Page = { meta: { totalItems: number } };
  const listings = await integrationGet<Page>("/listings/query", { perPage: "1" });
  const users = await integrationGet<Page>("/users/query", { perPage: "1" });
  console.log(`Listings: ${listings.meta.totalItems} · Users: ${users.meta.totalItems}`);
})();
