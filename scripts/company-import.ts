/**
 * Company-account import: Carnival_Host_Import.xlsx → unclaimed Sharetribe user accounts.
 * Scope: accounts only. No listings, no Stripe, no email verification, no outreach.
 *
 *   python3 scripts/company-import-extract.py <Carnival_Host_Import.xlsx>   # once per workbook version
 *   npm run import:companies                                                 # dry run (default)
 *   npm run import:companies -- --apply --only cw-1241                       # one Test account
 *   npm run import:companies -- --apply                                      # all eligible (Test)
 *   npm run import:companies -- --apply --target live --confirm-live "<Live marketplace name>"
 *
 * Options: --limit N, --only id1,id2, --concurrency N (default 2, max 10), --target test|live.
 *
 * API (verified against the Sharetribe API reference, 2026-10-04):
 *   create   POST flex-api   /v1/api/current_user/create      (anonymous token; email, password, firstName,
 *            lastName, displayName, bio, publicData, protectedData, privateData. Metadata is not accepted here.)
 *   metadata POST flex-integ /v1/integration_api/users/update_profile  { id, metadata }  (operator only)
 *   lookup   GET  flex-integ /v1/integration_api/users/show?id= | ?email=
 * Creating a user sends Sharetribe's verification email to the claim address (our domain). Nothing is sent to
 * the company. The random password is discarded; claiming happens later through a password reset to the
 * claim mailbox and an email change (operator process, not part of this script).
 *
 * State (committed, credential-free): imports/company-accounts/<marketplace>/mapping.json (externalId → user id)
 * and ledger.jsonl (one line per row per run). Reruns read both and look accounts up by email before creating.
 */
import crypto from "node:crypto";
import dns from "node:dns/promises";
import fs from "node:fs";
import path from "node:path";
import {
  ELIGIBLE_TIERS,
  type AccountApi,
  type LedgerEntry,
  type Mapping,
  type RemoteUser,
  claimEmail,
  planImport,
  redact,
  runImport,
  validateClaimDomain,
} from "../src/lib/imports/company-accounts";
import { HttpError, INTEG, MKT, TEST_MARKETPLACE, createClient } from "./lib/sharetribe-client";
import { writeJsonAtomic } from "./lib/files";

const DIR = "imports/company-accounts";

// ------------------------------------------------------------------------------------------- args
const argv = process.argv.slice(2);
const flag = (n: string) => argv.includes(`--${n}`);
const opt = (n: string) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const apply = flag("apply");
const target = (opt("target") ?? "test") as "test" | "live";
const limit = opt("limit") ? Number(opt("limit")) : undefined;
const only = opt("only")?.split(",").map((s) => s.trim()).filter(Boolean);
const concurrency = Math.min(10, Math.max(1, Number(opt("concurrency") ?? 2)));
const workbookPath = opt("workbook") ?? `${DIR}/source/workbook.json`;

const { call, headers, marketplaceNames } = createClient(target);

type UserDoc = { data: { id: string; attributes: { email: string; emailVerified: boolean; stripeConnected: boolean; profile: { metadata?: Record<string, unknown>; privateData?: Record<string, unknown> } } } };
const toRemote = (d: UserDoc): RemoteUser => ({
  id: d.data.id,
  email: d.data.attributes.email,
  emailVerified: d.data.attributes.emailVerified,
  stripeConnected: d.data.attributes.stripeConnected,
  metadata: d.data.attributes.profile.metadata ?? {},
  privateData: d.data.attributes.profile.privateData ?? {},
});

async function showUser(q: { id: string } | { email: string }): Promise<RemoteUser | null> {
  try {
    return toRemote(await call<UserDoc>("query", `${INTEG}/users/show?${new URLSearchParams(q)}`, { headers: await headers("integ") }, true));
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return null;
    throw e;
  }
}

const api: AccountApi = {
  showById: (id) => showUser({ id }),
  showByEmail: (email) => showUser({ email }),
  async create(payload) {
    const res = await call<{ data: { id: string } }>("command", `${MKT}/current_user/create`, { method: "POST", headers: await headers("anon", true), body: JSON.stringify(payload) }, false);
    return res.data.id;
  },
  async setMetadata(id, metadata) {
    await call("command", `${INTEG}/users/update_profile`, { method: "POST", headers: await headers("integ", true), body: JSON.stringify({ id, metadata }) }, true);
  },
};


// ------------------------------------------------------------------------------------------- main
(async () => {
  if (!fs.existsSync(workbookPath)) {
    console.error(`No extracted workbook at ${workbookPath}. Run: python3 scripts/company-import-extract.py <Carnival_Host_Import.xlsx>`);
    process.exit(1);
  }
  const plan = planImport(JSON.parse(fs.readFileSync(workbookPath, "utf8")));
  const domain = validateClaimDomain(process.env.IMPORT_CLAIM_EMAIL_DOMAIN);

  console.log(`Workbook ${plan.source.file} (sha256 ${plan.source.sha256.slice(0, 12)}…)`);
  console.log(`Companies sheet tiers: ${Object.entries(plan.tierCounts).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  console.log(`Eligible accounts (${ELIGIBLE_TIERS.join(" + ")}): ${plan.eligible.length}`);
  console.log(`  A_ready ${plan.eligible.filter((r) => r.importTier === "A_ready").length}, B_account_only ${plan.eligible.filter((r) => r.importTier === "B_account_only").length}`);
  console.log(`Held (C_verify_first, not imported): ${plan.held.length}`);
  console.log(`Excluded (D_exclude, Companies sheet only): ${plan.excludedCompanies.length}`);
  console.log(`Validation issues: ${plan.issues.length}`);
  for (const i of plan.issues.slice(0, 20)) console.log(`  ✗ ${i.externalId}: ${i.issue}`);
  console.log(`Public-text sanitisation: ${plan.sanitized.length}`);
  for (const i of plan.sanitized) console.log(`  · ${i.externalId}: ${i.issue}`);
  console.log(`Claim domain: ${domain.ok ? domain.domain : `✗ ${domain.reason}`}`);

  let rows = plan.eligible;
  if (only) {
    const unknown = only.filter((id) => !rows.some((r) => r.externalId === id));
    if (unknown.length) throw new Error(`--only: not eligible (held, excluded or unknown): ${unknown.join(", ")}`);
    rows = rows.filter((r) => only.includes(r.externalId));
  }
  if (limit !== undefined) rows = rows.slice(0, limit);
  console.log(`Selected for this run: ${rows.length}`);

  if (!apply) {
    const report = {
      generatedAt: new Date().toISOString(),
      source: plan.source,
      counts: { eligible: plan.eligible.length, held: plan.held.length, excludedCompanies: plan.excludedCompanies.length, issues: plan.issues.length, sanitized: plan.sanitized.length },
      claimDomain: domain.ok ? domain.domain : null,
      blockers: [...(domain.ok ? [] : [domain.reason]), ...(plan.issues.length ? [`${plan.issues.length} validation issues`] : [])],
      rows: rows.map((r) => ({ externalId: r.externalId, companyId: r.metadata.companyId, tier: r.importTier, email: domain.ok ? claimEmail(r, domain.domain) : r.emailPlaceholder })),
      held: plan.held.map((r) => r.externalId),
      excludedCompanies: plan.excludedCompanies,
    };
    writeJsonAtomic(`${DIR}/source/dry-run.json`, report);
    console.log(`\nDRY RUN — nothing written to Sharetribe. Report: ${DIR}/source/dry-run.json`);
    if (report.blockers.length) {
      console.log(`Blocked for --apply: ${report.blockers.join("; ")}`);
      process.exit(2);
    }
    return;
  }

  // ---------------- apply guards
  if (!domain.ok) throw new Error(`Refusing: ${domain.reason}. Set IMPORT_CLAIM_EMAIL_DOMAIN to a domain we control (catch-all mailbox).`);
  if (plan.issues.length) throw new Error(`Refusing: ${plan.issues.length} validation issues.`);
  // Local resolvers can hold a stale "no record" answer for a fresh MX; fall back to Cloudflare DNS-over-HTTPS.
  let mx: unknown[] = await dns.resolveMx(domain.domain).catch(() => []);
  if (!mx.length) {
    const doh = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain.domain)}&type=MX`, { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(10000) })
      .then((r) => r.json() as Promise<{ Answer?: { type: number }[] }>)
      .catch(() => ({ Answer: [] }));
    mx = (doh.Answer ?? []).filter((a) => a.type === 15);
  }
  if (!mx.length) throw new Error(`Refusing: ${domain.domain} has no MX record, so claim and verification mail would be lost.`);
  const names = await marketplaceNames();
  if (names.integ !== names.mkt) throw new Error(`Refusing: Integration API marketplace "${names.integ}" ≠ Marketplace API marketplace "${names.mkt}".`);
  if (target === "test" && names.integ !== TEST_MARKETPLACE) throw new Error(`Refusing: --target test but the configured marketplace is "${names.integ}".`);
  if (target === "live") {
    // A provider-managed receiving domain (Resend's <id>.resend.app) is fine for the Test proof, but the
    // addresses vanish with that account: production needs a domain whose DNS we own.
    if (/(^|\.)resend\.app$/.test(domain.domain)) throw new Error(`Refusing: ${domain.domain} is a Resend-managed domain. Live accounts need a claim domain we own (e.g. claims.<our domain> with MX → Resend inbound).`);
    if (names.integ === TEST_MARKETPLACE) throw new Error("Refusing: --target live but the configured credentials are the Test marketplace.");
    if (opt("confirm-live") !== names.integ) throw new Error(`Refusing: pass --confirm-live "${names.integ}" to write to that Live marketplace.`);
  }

  const slug = names.integ.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const mappingFile = `${DIR}/${slug}/mapping.json`;
  const ledgerFile = `${DIR}/${slug}/ledger.jsonl`;
  const mapping: Mapping = fs.existsSync(mappingFile) ? JSON.parse(fs.readFileSync(mappingFile, "utf8")).accounts : {};
  const saveMapping = (m: Mapping) => writeJsonAtomic(mappingFile, { marketplace: names.integ, importBatch: plan.eligible[0]?.metadata.importBatch, accounts: m });
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${crypto.randomBytes(3).toString("hex")}`;
  fs.mkdirSync(path.dirname(ledgerFile), { recursive: true });

  console.log(`\nAPPLY → "${names.integ}" (${target}); run ${runId}; concurrency ${concurrency}; ${Object.keys(mapping).length} already mapped.`);
  const results = await runImport(rows, domain.domain, {
    api,
    mapping,
    saveMapping,
    newPassword: () => crypto.randomBytes(24).toString("base64url"),
    now: () => new Date().toISOString(),
    runId,
    concurrency,
    onResult(e: LedgerEntry) {
      const line = { ...e, detail: e.detail ? redact(e.detail) : undefined };
      fs.appendFileSync(ledgerFile, `${JSON.stringify(line)}\n`);
      console.log(`  ${e.outcome.padEnd(15)} ${e.externalId.padEnd(28)} ${e.userId ?? "-"}${e.detail ? `  ${line.detail}` : ""}`);
    },
  });

  // ---------------- verification evidence (read back from the API)
  const touched = results.filter((r) => r.userId && ["created", "resumed", "exists"].includes(r.outcome));
  const evidence = [];
  for (const r of touched) {
    const u = await api.showById(r.userId!);
    const listings = await call<{ meta: { totalItems: number } }>("query", `${INTEG}/listings/query?${new URLSearchParams({ authorId: r.userId!, perPage: "1" })}`, { headers: await headers("integ") }, true);
    evidence.push({
      externalId: r.externalId,
      userId: r.userId,
      found: !!u,
      email: u?.email,
      emailVerified: u?.emailVerified,
      stripeConnected: u?.stripeConnected,
      claimStatus: u?.metadata.claimStatus,
      companyId: u?.metadata.companyId,
      importBatch: u?.metadata.importBatch,
      listings: listings.meta.totalItems,
    });
  }
  const tally: Record<string, number> = {};
  for (const r of results) tally[r.outcome] = (tally[r.outcome] ?? 0) + 1;
  console.log(`\nResult: ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(", ")}`);
  const bad = evidence.filter((e) => !e.found || e.emailVerified !== false || e.stripeConnected !== false || e.claimStatus !== "unclaimed" || e.listings !== 0);
  console.log(`Verified via Integration API: ${evidence.length - bad.length}/${evidence.length} unclaimed, unverified email, no Stripe, no listings.`);
  for (const e of evidence.slice(0, 5)) console.log(`  ${JSON.stringify(e)}`);
  if (bad.length) console.log(`  ✗ ${bad.length} accounts did not match: ${bad.map((b) => b.externalId).join(", ")}`);
  console.log(`Mapping: ${mappingFile}\nLedger:  ${ledgerFile}`);
  if (bad.length || results.some((r) => r.outcome === "failed" || r.outcome === "conflict")) process.exit(1);
})().catch((e) => {
  console.error(redact((e as Error).message));
  process.exit(1);
});
