/**
 * Read-only inspection of the ACTIVE Sharetribe environment.
 * - Hosted configuration via the Asset Delivery API (listing types, categories, fields, search, commission)
 * - Data counts via the Integration API (listings by state, users, transactions)
 * Writes a secret-free snapshot to contract/snapshots/<marketplace>-<date>.json and prints a summary.
 * Transaction processes and CLI search schemas are NOT readable with these credentials (Sharetribe CLI only).
 */
import fs from "node:fs";
import { integrationGet, sharetribeConnection } from "../src/lib/integrations/sharetribe";

const ASSETS = [
  "listings/listing-types.json",
  "listings/listing-categories.json",
  "listings/listing-fields.json",
  "listings/listing-search.json",
  "transactions/commission.json",
  "transactions/minimum-transaction-size.json",
  "users/user-types.json",
  "users/user-fields.json",
];

async function asset(clientId: string, path: string) {
  const res = await fetch(`https://cdn.st-api.com/v1/assets/pub/${clientId}/a/latest/${path}`, { signal: AbortSignal.timeout(10000) });
  if (res.status === 404) return { status: "not-configured" as const };
  if (!res.ok) return { status: `error-${res.status}` as const };
  const body = await res.json();
  return { status: "ok" as const, version: body?.meta?.version ?? null, data: body?.data ?? null };
}

(async () => {
  const conn = await sharetribeConnection(true);
  if (conn.state !== "connected-readonly") {
    console.error(`Not connected: ${conn.detail}`);
    process.exit(1);
  }
  const clientId = process.env.SHARETRIBE_CLIENT_ID;
  const assets: Record<string, unknown> = {};
  if (clientId) for (const p of ASSETS) assets[p] = await asset(clientId, p);

  type Page = { meta: { totalItems: number } };
  const count = async (path: string, q: Record<string, string> = {}) => (await integrationGet<Page>(path, { perPage: "1", ...q })).meta.totalItems;
  const counts = {
    listingsPublished: await count("/listings/query", { states: "published" }),
    listingsDraft: await count("/listings/query", { states: "draft" }),
    listingsClosed: await count("/listings/query", { states: "closed" }),
    listingsPendingApproval: await count("/listings/query", { states: "pendingApproval" }),
    users: await count("/users/query"),
    transactions: await count("/transactions/query"),
  };

  const snapshot = {
    capturedAt: new Date().toISOString(),
    marketplaceName: conn.marketplaceName,
    marketplaceApiClient: conn.marketplaceApi,
    counts,
    assets,
    notReadableWithTheseCredentials: ["transaction processes (Sharetribe CLI)", "CLI-defined search schemas (Sharetribe CLI)", "Stripe configuration (Console)"],
  };
  const slug = (conn.marketplaceName ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const file = `contract/snapshots/${slug}-${snapshot.capturedAt.slice(0, 10)}.json`;
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2) + "\n");

  console.log(`Marketplace: ${conn.marketplaceName}`);
  console.log(`Counts: ${JSON.stringify(counts)}`);
  for (const [p, a] of Object.entries(assets)) console.log(`  ${p}: ${(a as { status: string }).status}`);
  console.log(`Snapshot: ${file}`);
})();
