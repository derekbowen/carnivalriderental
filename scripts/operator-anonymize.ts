/**
 * Make every UNCLAIMED operator anonymous on the marketplace (founder decision 2026-10-05) and make
 * every listing page render (inquiry process alias + truthful unclaimed notice). Replaces
 * listings:enable-inquiry for listings, and adds the account step.
 *
 *   npm run ops:anonymize                         # dry run: counts only
 *   npm run ops:anonymize -- --apply [--phase users|listings] [--limit N]
 *
 * Accounts: displayName/firstName/lastName/bio → "Carnival Ride Rental operator"; identifying
 * publicData (companyName, hqCity, website, otherOperations) moved to privateData; the original
 * profile kept in privateData.originalProfile for restore on claim.
 * Listings: company names, websites and emails removed from the description (original kept in
 * privateData.originalDescription), unclaimed notice on top, inquiry alias set.
 * Claimed accounts are never touched. Resumable (ledgers), idempotent, Test only unless
 * --target live --founder-go.
 */
import fs from "node:fs";
import { createClient, INTEG } from "./lib/sharetribe-client";
import { anonymizeText, IDENTITY_PUBLIC_KEYS, INQUIRY_ALIAS, OPERATOR_PLACEHOLDER, withNotice, withoutNotice } from "../src/lib/operators/claim";

const argv = process.argv.slice(2);
const opt = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const target = (opt("target") ?? "test") as "test" | "live";
const apply = argv.includes("--apply");
const phase = opt("phase");
const limit = Number(opt("limit") ?? Infinity);
const dir = target === "test" ? "carnivalrental-test" : "carnivalrental-live";

type Profile = { displayName: string; firstName?: string; lastName?: string; bio?: string; publicData?: Record<string, unknown>; privateData?: Record<string, unknown>; metadata?: Record<string, unknown> };
const ledger = (file: string) => {
  const done = new Set<string>();
  if (fs.existsSync(file)) for (const l of fs.readFileSync(file, "utf8").split("\n")) if (l) {
    const e = JSON.parse(l);
    if (e.outcome === "updated" || e.outcome === "already" || e.outcome === "skipped_claimed") done.add(e.id);
  }
  return { done, add: (e: Record<string, unknown>) => fs.appendFileSync(file, `${JSON.stringify({ at: new Date().toISOString(), ...e })}\n`) };
};
/** Name variants that could appear in text: as given, and without a trailing legal suffix. */
const variants = (names: unknown[]) =>
  names.flatMap((n) => (typeof n === "string" && n.trim() ? [n.trim(), n.trim().replace(/,?\s+(inc\.?|llc|l\.l\.c\.|co\.?|corp\.?|ltd\.?)$/i, "")] : []));

(async () => {
  if (target === "live" && !argv.includes("--founder-go")) throw new Error("Refusing Live without --founder-go");
  const { call, headers } = createClient(target);
  const accounts = Object.values(JSON.parse(fs.readFileSync(`imports/company-accounts/${dir}/mapping.json`, "utf8")).accounts as Record<string, { userId: string; companyId: string; qa?: boolean }>);
  const listings = Object.entries(JSON.parse(fs.readFileSync(`imports/listings/${dir}/mapping.json`, "utf8")).listings as Record<string, { listingId: string; companyId: string }>);
  const namesByCompany = new Map<string, string[]>();

  // ---------------------------------------------------------------- accounts
  const uL = ledger(`imports/company-accounts/${dir}/anonymize-ledger.jsonl`);
  console.log(`Accounts: ${accounts.length} (${uL.done.size} done). Listings: ${listings.length}.${apply ? "" : " DRY RUN."}`);
  if (!apply) return;
  let n = 0;
  for (const a of accounts) {
    // Names are needed for the listing phase even when the account itself is already done.
    const u = (await call<{ data: { attributes: { profile: Profile } } }>("query", `${INTEG}/users/show?id=${a.userId}`, { headers: await headers("integ") }, true)).data.attributes.profile;
    const orig = (u.privateData?.originalProfile as Profile | undefined) ?? u;
    namesByCompany.set(a.companyId, variants([orig.displayName, orig.publicData?.companyName, u.privateData?.legalEntity, u.privateData?.legalName]));
    if (phase === "listings" || uL.done.has(a.userId) || n >= limit) continue;
    if (u.metadata?.claimStatus !== "unclaimed") {
      uL.add({ id: a.userId, companyId: a.companyId, outcome: "skipped_claimed" });
      continue;
    }
    const isAnon = u.displayName === OPERATOR_PLACEHOLDER.displayName && u.lastName === OPERATOR_PLACEHOLDER.lastName && IDENTITY_PUBLIC_KEYS.every((k) => u.publicData?.[k] == null);
    if (isAnon) {
      uL.add({ id: a.userId, companyId: a.companyId, outcome: "already" });
      continue;
    }
    const moved = Object.fromEntries(IDENTITY_PUBLIC_KEYS.filter((k) => u.publicData?.[k] != null).map((k) => [k, u.publicData![k]]));
    await call("command", `${INTEG}/users/update_profile`, {
      method: "POST",
      headers: await headers("integ", true),
      body: JSON.stringify({
        id: a.userId,
        firstName: OPERATOR_PLACEHOLDER.firstName,
        lastName: OPERATOR_PLACEHOLDER.lastName,
        displayName: OPERATOR_PLACEHOLDER.displayName,
        bio: OPERATOR_PLACEHOLDER.bio,
        publicData: Object.fromEntries(IDENTITY_PUBLIC_KEYS.map((k) => [k, null])),
        // Never overwrite a saved original (a re-run sees the already-anonymised profile).
        privateData: { ...moved, originalProfile: u.privateData?.originalProfile ?? { displayName: u.displayName, firstName: u.firstName, lastName: u.lastName, bio: u.bio, publicData: moved } },
      }),
    }, true);
    uL.add({ id: a.userId, companyId: a.companyId, outcome: "updated" });
    n++;
  }
  if (phase !== "listings") console.log(`Accounts anonymised this run: ${n}`);
  if (phase === "users") return;

  // ---------------------------------------------------------------- listings
  const lL = ledger(`imports/listings/${dir}/anonymize-ledger.jsonl`);
  const tally: Record<string, number> = {};
  let m = 0;
  for (const [externalId, l] of listings) {
    if (lL.done.has(l.listingId) || m >= limit) continue;
    let outcome = "failed";
    let detail: string | undefined;
    try {
      const a = (await call<{ data: { attributes: { description: string; publicData?: Record<string, unknown>; privateData?: Record<string, unknown>; metadata?: Record<string, unknown> } } }>("query", `${INTEG}/listings/show?id=${l.listingId}`, { headers: await headers("integ") }, true)).data.attributes;
      if (a.metadata?.claimStatus !== "unclaimed") outcome = "skipped_claimed";
      else {
        const original = (a.privateData?.originalDescription as string | undefined) ?? withoutNotice(a.description);
        const description = withNotice(anonymizeText(original, namesByCompany.get(l.companyId) ?? []));
        const needs = description !== a.description || a.publicData?.transactionProcessAlias !== INQUIRY_ALIAS || a.publicData?.unitType !== "inquiry" || a.privateData?.originalDescription === undefined;
        if (!needs) outcome = "already";
        else {
          await call("command", `${INTEG}/listings/update`, {
            method: "POST",
            headers: await headers("integ", true),
            body: JSON.stringify({ id: l.listingId, description, publicData: { transactionProcessAlias: INQUIRY_ALIAS, unitType: "inquiry" }, privateData: { originalDescription: original } }),
          }, true);
          outcome = "updated";
          m++;
        }
      }
    } catch (e) {
      detail = String((e as Error).message).slice(0, 200);
    }
    tally[outcome] = (tally[outcome] ?? 0) + 1;
    lL.add({ id: l.listingId, externalId, outcome, ...(detail ? { detail } : {}) });
    if (outcome === "updated" && m % 200 === 0) console.log(`  listings ${JSON.stringify(tally)}`);
  }
  console.log(`Listings: ${JSON.stringify(tally)}`);
})().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
