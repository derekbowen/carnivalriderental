/**
 * Make imported operator listings render and accept inquiries on the Sharetribe marketplace.
 *
 * Hosted listing pages need publicData.transactionProcessAlias + unitType (listing type
 * operator-ride-rental is bound to default-inquiry/release-1 in Console); without them the page
 * shows "The listing contained invalid data". Unclaimed listings also get a truthful notice at the
 * top of the description (UNCLAIMED_NOTICE); the claim script removes it.
 *
 *   npm run listings:enable-inquiry                       # dry run: counts only
 *   npm run listings:enable-inquiry -- --apply [--limit N] [--only <externalId,...>]
 *
 * Resumable (ledger), idempotent (skips listings that already have the alias and notice), Test only
 * unless --target live is given with a founder go. Respects Test rate limits via the shared client.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient, INTEG } from "./lib/sharetribe-client";
import { INQUIRY_ALIAS, UNCLAIMED_NOTICE, withNotice } from "../src/lib/operators/claim";

const argv = process.argv.slice(2);
const opt = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const target = (opt("target") ?? "test") as "test" | "live";
const apply = argv.includes("--apply");
const limit = Number(opt("limit") ?? Infinity);
const only = opt("only")?.split(",");

const dir = path.join("imports/listings", target === "test" ? "carnivalrental-test" : "carnivalrental-live");
const mapping = JSON.parse(fs.readFileSync(path.join(dir, "mapping.json"), "utf8")).listings as Record<string, { listingId: string; companyId: string }>;
const ledgerFile = path.join(dir, "inquiry-ledger.jsonl");

(async () => {
  if (target === "live" && !argv.includes("--founder-go")) throw new Error("Refusing Live without --founder-go");
  const { call, headers } = createClient(target);
  const done = new Set<string>();
  if (fs.existsSync(ledgerFile)) for (const l of fs.readFileSync(ledgerFile, "utf8").split("\n")) if (l) {
    const e = JSON.parse(l);
    if (e.outcome === "updated" || e.outcome === "already") done.add(e.externalId);
  }
  let items = Object.entries(mapping).filter(([x]) => !done.has(x) && (!only || only.includes(x)));
  console.log(`Inquiry enable: ${Object.keys(mapping).length} mapped, ${done.size} done, ${items.length} to check.${apply ? "" : " DRY RUN."}`);
  if (!apply) return;
  items = items.slice(0, limit);
  const tally: Record<string, number> = {};
  for (const [externalId, m] of items) {
    let outcome: string;
    let detail: string | undefined;
    try {
      const res = await call<{ data: { attributes: { description: string; publicData: Record<string, unknown>; metadata: Record<string, unknown> } } }>(
        "query", `${INTEG}/listings/show?id=${m.listingId}`, { headers: await headers("integ") }, true);
      const a = res.data.attributes;
      const unclaimed = a.metadata?.claimStatus === "unclaimed";
      const description = unclaimed ? withNotice(a.description) : a.description;
      const needs = a.publicData?.transactionProcessAlias !== INQUIRY_ALIAS || a.publicData?.unitType !== "inquiry" || description !== a.description;
      if (!needs) outcome = "already";
      else {
        await call("command", `${INTEG}/listings/update`, {
          method: "POST",
          headers: await headers("integ", true),
          body: JSON.stringify({ id: m.listingId, description, publicData: { transactionProcessAlias: INQUIRY_ALIAS, unitType: "inquiry" } }),
        }, true);
        outcome = "updated";
        detail = unclaimed ? "notice" : undefined;
      }
    } catch (e) {
      outcome = "failed";
      detail = String((e as Error).message).slice(0, 200);
    }
    tally[outcome] = (tally[outcome] ?? 0) + 1;
    fs.appendFileSync(ledgerFile, `${JSON.stringify({ at: new Date().toISOString(), externalId, listingId: m.listingId, outcome, ...(detail ? { detail } : {}) })}\n`);
    if ((tally.updated ?? 0) % 100 === 0 && outcome === "updated") console.log(`  ${JSON.stringify(tally)}`);
  }
  console.log(`Done: ${JSON.stringify(tally)}  (notice: ${UNCLAIMED_NOTICE.slice(0, 40)}…)`);
})().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
