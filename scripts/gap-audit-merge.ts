/**
 * Merge the national gap audit (2026-10-06) into the import workbook, then dry-run the importers'
 * own planning on the result. Docs: docs/GAP_AUDIT_IMPORT.md.
 *
 *   npm run import:gap-audit -- <path/to/carnival-gap-audit>
 *
 * Reads the audit CSVs and imports/company-accounts/source/workbook-base.json (the original extract;
 * created from workbook.json on the first run, so reruns always start from the original), writes the
 * merged imports/company-accounts/source/workbook.json (gitignored: private contacts) and a sanitized
 * report, reports/gap-audit-import-plan.json (counts only: no names, slugs, contacts or ids).
 * Writes nothing to Sharetribe.
 */
import fs from "node:fs";
import path from "node:path";
import { geocode } from "../src/lib/access/matching";
import { planImport } from "../src/lib/imports/company-accounts";
import { mergeWorkbook, parseCsv, planGapAudit, type GapWorkbook } from "../src/lib/imports/gap-audit";
import { planListings } from "../src/lib/imports/operator-listings";

const dir = process.argv[2];
if (!dir || !fs.existsSync(path.join(dir, "rides-new.csv"))) {
  console.error("usage: npm run import:gap-audit -- <path/to/carnival-gap-audit>  (the folder with rides-new.csv)");
  process.exit(1);
}
const SRC = "imports/company-accounts/source";
const base = `${SRC}/workbook-base.json`;
if (!fs.existsSync(base)) {
  if (!fs.existsSync(`${SRC}/workbook.json`)) throw new Error(`${SRC}/workbook.json is missing: extract the host workbook first (docs/COMPANY_IMPORT.md)`);
  fs.copyFileSync(`${SRC}/workbook.json`, base);
  console.log(`Saved the original workbook as ${base}`);
}
const csv = (f: string) => parseCsv(fs.readFileSync(path.join(dir, f), "utf8"));
// The operators' own ride text, fetched from each ride's source page (committed; see docs/GAP_AUDIT_IMPORT.md).
const RIDE_TEXT = "imports/gap-audit/ride-text.json";
const rideText = fs.existsSync(RIDE_TEXT) ? (JSON.parse(fs.readFileSync(RIDE_TEXT, "utf8")) as { texts: Record<string, string> }).texts : {};
const audit = { companiesNew: csv("companies-new.csv"), ridesNew: csv("rides-new.csv"), companiesUpdates: csv("companies-updates.csv"), inactive: csv("inactive-or-historical.csv"), rideText };
const wb = JSON.parse(fs.readFileSync(base, "utf8")) as GapWorkbook;

const plan = planGapAudit(audit, wb, geocode);
const merged = mergeWorkbook(wb, plan, audit.companiesUpdates);
fs.writeFileSync(`${SRC}/workbook.json`, `${JSON.stringify(merged)}\n`);

// The importers' own planning on the merged workbook: the same validation, privacy holds and tiers the
// apply runs use. Only rows added here are counted as "gap" rows.
const gapUsers = new Set(plan.users.map((u) => u.externalId));
const gapListings = new Set(plan.listings.map((l) => l.externalId));
const accounts = planImport(merged as never);
const listings = planListings(merged as never);
const before = planListings(wb as never);
// Issue text can carry ids or slugs; the committed report keeps only the kind of issue.
const kind = (issue: string) => issue.replace(/[a-z0-9-]+--[a-z0-9-]+|gap-[a-z0-9-]+|cw-\d+|companyId [a-z0-9-]+|author [a-z0-9-]+/g, "<id>");
const tally = (xs: { issue: string }[]) => xs.reduce<Record<string, number>>((a, x) => ((a[kind(x.issue)] = (a[kind(x.issue)] ?? 0) + 1), a), {});
const report = {
  generatedAt: new Date().toISOString(),
  audit: { file: "carnival-gap-audit (2026-10-06)", companiesNew: audit.companiesNew.length, ridesNew: audit.ridesNew.length },
  selection: { ...plan.stats, operatorTextAvailable: plan.listings.filter((l) => rideText[l.externalId]).length, skipped: plan.skipped },
  accounts: {
    eligibleBefore: planImport(wb as never).eligible.length,
    eligibleAfter: accounts.eligible.length,
    gapNewAccounts: accounts.eligible.filter((r) => gapUsers.has(r.externalId)).length,
    promotedFromVerifyFirst: plan.promoted.length,
    blockingIssues: accounts.issues.length,
    issues: tally(accounts.issues),
  },
  listings: {
    plannedBefore: before.rows.length,
    plannedAfter: listings.rows.length,
    gapPlanned: listings.rows.filter((r) => gapListings.has(r.externalId)).length,
    gapHeldForPrivacy: listings.held.filter((h) => gapListings.has(h.externalId)).length,
    gapHeldReasons: tally(listings.held.filter((h) => gapListings.has(h.externalId))),
    blockingIssues: listings.issues.length,
    issues: tally(listings.issues),
    gapWithSourcePhoto: listings.rows.filter((r) => gapListings.has(r.externalId) && r.privateData.sourceImageUrl).length,
    gapByClass: listings.rows.filter((r) => gapListings.has(r.externalId)).reduce<Record<string, number>>((a, r) => ((a[r.publicData.rideCategory] = (a[r.publicData.rideCategory] ?? 0) + 1), a), {}),
  },
};
fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync("reports/gap-audit-import-plan.json", `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 1));
if (accounts.issues.length || listings.issues.length) process.exitCode = 1;
