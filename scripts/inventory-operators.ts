/**
 * Anonymous operator keys for the public inventory snapshot: src/lib/inventory/operators.json.
 *
 * Public pages say things like "listed by 4 operators serving this area" without ever naming an
 * operator. This map turns each listing id into an opaque key (a truncated hash of the Sharetribe
 * author id) so pages can deduplicate rides by owner. The key cannot be reversed into an account,
 * and the file holds no names, contacts or locations. Reads ONLY the public Marketplace API.
 *
 *   npm run inventory:operators
 */
import crypto from "node:crypto";
import fs from "node:fs";
import { AUTH, MKT } from "./lib/sharetribe-client";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const keyOf = (authorId: string) => crypto.createHash("sha256").update(`operator:${authorId}`).digest("hex").slice(0, 12);

(async () => {
  const tok = (await (await fetch(AUTH, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.SHARETRIBE_CLIENT_ID!, grant_type: "client_credentials", scope: "public-read" }) })).json()).access_token;
  const byListing: Record<string, string> = {};
  for (let page = 1; ; page++) {
    const qs = new URLSearchParams({ pub_listingType: "operator-ride-rental", perPage: "100", page: String(page), include: "author", "fields.listing": "state", "fields.user": "" });
    let body: { data: { id: string; attributes: { state: string }; relationships?: { author?: { data?: { id: string } } } }[]; meta: { totalPages: number } };
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(`${MKT}/listings/query?${qs}`, { headers: { Authorization: `Bearer ${tok}`, Accept: "application/json" } });
      if (res.status === 429 && attempt < 5) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`listings/query page ${page}: HTTP ${res.status}`);
      body = await res.json();
      break;
    }
    for (const l of body.data) {
      const author = l.relationships?.author?.data?.id;
      if (l.attributes.state === "published" && author) byListing[l.id] = keyOf(author);
    }
    if (page >= body.meta.totalPages) break;
    await sleep(250);
  }
  const operators = new Set(Object.values(byListing)).size;
  fs.writeFileSync("src/lib/inventory/operators.json", JSON.stringify({ generatedAt: new Date().toISOString(), listings: Object.keys(byListing).length, operators, byListing }, null, 0) + "\n");
  console.log(`operators.json: ${Object.keys(byListing).length} listings, ${operators} operators`);
})().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
