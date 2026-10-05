/**
 * Operator ride listings import: Carnival_Host_Import.xlsx "Sharetribe Listings" → Sharetribe listings
 * (pendingApproval, under each imported company account). Contract: contract/operator-listing-contract.json.
 *
 *   python3 scripts/company-import-extract.py <Carnival_Host_Import.xlsx>   # once per workbook version
 *   npm run import:listings                                                  # dry run (default)
 *   npm run import:listings -- --apply --company a-and-a-attractions --limit 1   # one listing, Test
 *   npm run import:listings -- --apply                                        # everything whose company exists
 *   npm run import:listings -- --apply --target live --confirm-live "<Live marketplace name>"
 *
 * Options: --company id1,id2  --only externalId1,externalId2  --limit N  --target test|live
 *
 * API (Sharetribe API reference, checked 2026-10-04): Integration POST listings/create { title, authorId,
 * state: "pendingApproval", description, geolocation, publicData, privateData, metadata }. The Integration
 * API cannot create drafts; pendingApproval listings are visible in Console only, never in public queries.
 * No images are uploaded. No transaction process is bound, so these listings cannot be booked.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { redact } from "../src/lib/imports/company-accounts";
import {
  LISTING_TYPE,
  buildListingPayload,
  planListings,
  runListingImport,
  type ListingApi,
  type ListingLedgerEntry,
  type ListingMapping,
  type RemoteListing,
} from "../src/lib/imports/operator-listings";
import { writeJsonAtomic } from "./lib/files";
import { HttpError, INTEG, TEST_MARKETPLACE, createClient } from "./lib/sharetribe-client";

const SRC = "imports/company-accounts";
const DIR = "imports/listings";

const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const list = (n: string) => opt(n)?.split(",").map((s) => s.trim()).filter(Boolean);
const apply = flag("apply");
const target = (opt("target") ?? "test") as "test" | "live";
const limit = opt("limit") ? Number(opt("limit")) : undefined;
const only = list("only");
const companies = list("company");
const workbookPath = opt("workbook") ?? `${SRC}/source/workbook.json`;

const { call, headers, marketplaceNames } = createClient(target);

type ListingDoc = { id: string; attributes: { state: string; metadata?: Record<string, unknown> } };

const api: ListingApi = {
  async listByAuthor(authorId) {
    const out: RemoteListing[] = [];
    for (let page = 1; ; page++) {
      const q = new URLSearchParams({ authorId, perPage: "100", page: String(page), states: "draft,pendingApproval,published,closed", "fields.listing": "state,metadata" });
      const res = await call<{ data: ListingDoc[]; meta: { totalPages: number } }>("query", `${INTEG}/listings/query?${q}`, { headers: await headers("integ") }, true);
      out.push(...res.data.map((l) => ({ id: l.id, state: l.attributes.state, metadata: l.attributes.metadata ?? {} })));
      if (page >= (res.meta.totalPages ?? 1)) return out;
    }
  },
  async create(payload) {
    const res = await call<{ data: { id: string } }>("command", `${INTEG}/listings/create`, { method: "POST", headers: await headers("integ", true), body: JSON.stringify(payload) }, false);
    return res.data.id;
  },
  async authorMetadata(authorId) {
    try {
      const res = await call<{ data: { attributes: { profile: { metadata?: Record<string, unknown> } } } }>("query", `${INTEG}/users/show?${new URLSearchParams({ id: authorId })}`, { headers: await headers("integ") }, true);
      return res.data.attributes.profile.metadata ?? {};
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) return null;
      throw e;
    }
  },
};

async function listingTypeConfigured(): Promise<boolean | null> {
  const id = process.env.SHARETRIBE_CLIENT_ID;
  if (!id) return null;
  const res = await fetch(`https://cdn.st-api.com/v1/assets/pub/${id}/a/latest/listings/listing-types.json`, { signal: AbortSignal.timeout(10000) }).catch(() => null);
  if (!res?.ok) return null;
  const body = (await res.json()) as { data?: { listingTypes?: { id: string }[] } };
  return (body.data?.listingTypes ?? []).some((t) => t.id === LISTING_TYPE);
}

(async () => {
  if (!fs.existsSync(workbookPath)) {
    console.error(`No extracted workbook at ${workbookPath}. Run: python3 scripts/company-import-extract.py <Carnival_Host_Import.xlsx>`);
    process.exit(1);
  }
  const plan = planListings(JSON.parse(fs.readFileSync(workbookPath, "utf8")));
  console.log(`Listings: ${plan.stats.listings} importable from ${plan.stats.authors} companies; ${plan.held.length} held for review; ${plan.issues.length} validation issues`);
  console.log(`  public dimensions (operator website) ${plan.stats.publicDimensions}; typical dimensions kept private ${plan.stats.typicalDimensionsKeptPrivate}`);
  console.log(`  manufacturer public ${plan.stats.manufacturerPublic}; kept private (unverified) ${plan.stats.manufacturerKeptPrivate}`);
  console.log(`  photos uploaded 0; source photo links kept private ${plan.stats.sourcePhotoLinkPrivate}`);
  for (const i of plan.issues.slice(0, 20)) console.log(`  ✗ ${i.externalId}: ${i.issue}`);
  for (const h of plan.held) console.log(`  ⏸ held ${h.externalId}: ${h.issue}`);
  writeJsonAtomic(`${DIR}/held-for-review.json`, { generatedAt: new Date().toISOString().slice(0, 10), held: plan.held });

  let rows = plan.rows;
  if (companies) rows = rows.filter((r) => companies.includes(r.metadata.companyId));
  if (only) rows = rows.filter((r) => only.includes(r.externalId));
  if (limit !== undefined) rows = rows.slice(0, limit);
  console.log(`Selected for this run: ${rows.length}`);

  if (!apply) {
    writeJsonAtomic(`${SRC}/source/listings-dry-run.json`, { generatedAt: new Date().toISOString(), stats: plan.stats, held: plan.held, sample: rows.slice(0, 3).map(buildListingPayload) });
    console.log(`\nDRY RUN — nothing written to Sharetribe. Sample payloads: ${SRC}/source/listings-dry-run.json`);
    if (plan.issues.length) process.exit(2);
    return;
  }

  if (plan.issues.length) throw new Error(`Refusing: ${plan.issues.length} validation issues.`);
  const names = await marketplaceNames();
  if (names.integ !== names.mkt) throw new Error(`Refusing: Integration API marketplace "${names.integ}" ≠ Marketplace API marketplace "${names.mkt}".`);
  if (target === "test" && names.integ !== TEST_MARKETPLACE) throw new Error(`Refusing: --target test but the configured marketplace is "${names.integ}".`);
  if (target === "live") {
    if (names.integ === TEST_MARKETPLACE) throw new Error("Refusing: --target live but the configured credentials are the Test marketplace.");
    if (opt("confirm-live") !== names.integ) throw new Error(`Refusing: pass --confirm-live "${names.integ}" to write to that Live marketplace.`);
  }
  const typeOk = await listingTypeConfigured();
  if (typeOk !== true) {
    const msg = `listing type "${LISTING_TYPE}" is ${typeOk === false ? "not configured" : "not verifiable"} in Console (docs/LISTING_IMPORT.md §Console)`;
    if (target === "live") throw new Error(`Refusing: ${msg}.`);
    console.log(`⚠ ${msg}. Test only: listings are created pendingApproval and stay out of public queries.`);
  }

  const slug = names.integ.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const accountsFile = `${SRC}/${slug}/mapping.json`;
  const accounts: Record<string, { userId: string }> = fs.existsSync(accountsFile) ? JSON.parse(fs.readFileSync(accountsFile, "utf8")).accounts : {};
  const mappingFile = `${DIR}/${slug}/mapping.json`;
  const ledgerFile = `${DIR}/${slug}/ledger.jsonl`;
  const mapping: ListingMapping = fs.existsSync(mappingFile) ? JSON.parse(fs.readFileSync(mappingFile, "utf8")).listings : {};
  const saveMapping = (m: ListingMapping) => writeJsonAtomic(mappingFile, { marketplace: names.integ, listingType: LISTING_TYPE, listings: m });
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomBytes(3).toString("hex")}`;
  fs.mkdirSync(path.dirname(ledgerFile), { recursive: true });

  console.log(`\nAPPLY → "${names.integ}" (${target}); run ${runId}; ${Object.keys(accounts).length} company accounts known; ${Object.keys(mapping).length} listings already mapped.`);
  const results = await runListingImport(rows, {
    api,
    mapping,
    accounts,
    saveMapping,
    now: () => new Date().toISOString(),
    runId,
    onResult(e: ListingLedgerEntry) {
      const line = { ...e, detail: e.detail ? redact(e.detail) : undefined };
      fs.appendFileSync(ledgerFile, `${JSON.stringify(line)}\n`);
      if (e.outcome !== "waiting_for_author") console.log(`  ${e.outcome.padEnd(18)} ${e.externalId.padEnd(52)} ${e.listingId ?? "-"}${e.detail ? `  ${line.detail}` : ""}`);
    },
  });

  // Read back a sample: state, images, public keys.
  const allowed = new Set(["listingType", "rideClass", "homeState", "serviceStates", "location", "manufacturer", "rideModel", "minRiderHeightIn", "riderRules", "footprintLengthFt", "footprintWidthFt", "rideHeightFt"]);
  const touched = results.filter((r) => r.listingId && (r.outcome === "created" || r.outcome === "exists"));
  const sample = touched.slice(0, 10);
  let bad = 0;
  for (const r of sample) {
    const res = await call<{ data: { attributes: { state: string; publicData: Record<string, unknown> }; relationships?: { images?: { data: unknown[] } } } }>(
      "query",
      `${INTEG}/listings/show?${new URLSearchParams({ id: r.listingId!, include: "images" })}`,
      { headers: await headers("integ") },
      true,
    );
    const a = res.data.attributes;
    const extra = Object.keys(a.publicData).filter((k) => !allowed.has(k));
    const images = res.data.relationships?.images?.data?.length ?? 0;
    const ok = ["pendingApproval", "published"].includes(a.state) && images <= 1 && extra.length === 0; // photo + Test approval: import:photos
    if (!ok) bad++;
    console.log(`  verify ${r.externalId}: state=${a.state} images=${images} extraPublicKeys=${extra.join(",") || "none"} ${ok ? "✓" : "✗"}`);
  }
  const tally: Record<string, number> = {};
  for (const r of results) tally[r.outcome] = (tally[r.outcome] ?? 0) + 1;
  console.log(`\nResult: ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(`Read-back sample: ${sample.length - bad}/${sample.length} pending or approved, at most the imported photo, approved public keys only.`);
  console.log(`Mapping: ${mappingFile}\nLedger:  ${ledgerFile}\nHeld:    ${DIR}/held-for-review.json`);
  if (bad || results.some((r) => r.outcome === "failed")) process.exit(1);
})().catch((e) => {
  console.error(redact((e as Error).message));
  process.exit(1);
});
