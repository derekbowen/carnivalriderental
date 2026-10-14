/**
 * Seed the clearly labelled Test catalog samples (catalog/test-samples.json).
 * Dry run by default; --apply writes. Refuses unless:
 *   - the active marketplace is exactly "CarnivalRental Test";
 *   - SHARETRIBE_SELLER_USER_ID is set and that user's email equals SHARETRIBE_SELLER_APPROVED_EMAIL
 *     (an email the founder approved for the company-controlled seller account).
 * Idempotent: listings are matched by metadata.offerKey; ids are recorded in catalog/listing-map.test.json.
 */
import fs from "node:fs";
import { integrationGet, integrationPost, sharetribeConnection } from "../src/lib/integrations/sharetribe";
import { planSeed, type ExistingListing, type SeedSample } from "../src/lib/catalog/seed";

const REQUIRED_ENV_NAME = "CarnivalRental Test";
const MAP_FILE = "catalog/listing-map.test.json";
const apply = process.argv.includes("--apply");

(async () => {
  const conn = await sharetribeConnection(true);
  if (conn.marketplaceName !== REQUIRED_ENV_NAME) throw new Error(`Refusing: active marketplace is "${conn.marketplaceName}", not "${REQUIRED_ENV_NAME}".`);
  const sellerId = process.env.SHARETRIBE_SELLER_USER_ID;
  const approvedEmail = process.env.SHARETRIBE_SELLER_APPROVED_EMAIL;
  if (!sellerId || !approvedEmail) throw new Error("Refusing: SHARETRIBE_SELLER_USER_ID and SHARETRIBE_SELLER_APPROVED_EMAIL must be set (founder-approved company seller account).");
  const user = await integrationGet<{ data: { attributes: { email: string } } }>("/users/show", { id: sellerId });
  if (user.data.attributes.email.toLowerCase() !== approvedEmail.toLowerCase()) throw new Error("Refusing: seller user's email does not match the approved email.");

  type Q = { data: { id: string; attributes: { title: string; description: string; state: string; publicData: Record<string, unknown>; metadata: Record<string, unknown> } }[] };
  const res = await integrationGet<Q>("/listings/query", { authorId: sellerId, perPage: "100" });
  const existing: ExistingListing[] = res.data.map((l) => ({ id: l.id, ...l.attributes }));
  const map: Record<string, string> = fs.existsSync(MAP_FILE) ? JSON.parse(fs.readFileSync(MAP_FILE, "utf8")) : {};
  const samples = (JSON.parse(fs.readFileSync("catalog/test-samples.json", "utf8")) as { samples: SeedSample[] }).samples;

  const { actions, errors } = planSeed({ existing, map, samples });
  if (errors.length) {
    console.error("Plan rejected:\n  " + errors.join("\n  "));
    process.exit(1);
  }
  for (const a of actions) console.log(`${a.kind.padEnd(6)} ${a.offerKey}${"listingId" in a ? ` (${a.listingId})` : ""}`);
  if (!apply) return console.log("Dry run only. Re-run with --apply to write.");

  for (const a of actions) {
    if (a.kind === "create") {
      const r = await integrationPost<{ data: { id: string } }>("/listings/create", { ...a.record, authorId: sellerId, state: "published" }, { expand: "true" });
      map[a.offerKey] = r.data.id;
      console.log(`created ${a.offerKey} -> ${r.data.id}`);
    } else if (a.kind === "update") {
      await integrationPost("/listings/update", { id: a.listingId, ...a.patch });
      console.log(`updated ${a.offerKey} (${a.listingId})`);
    }
  }
  fs.writeFileSync(MAP_FILE, JSON.stringify(map, null, 2) + "\n");
})().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
