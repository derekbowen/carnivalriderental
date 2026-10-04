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

const AUTH = "https://flex-api.sharetribe.com/v1/auth/token";
const MKT = "https://flex-api.sharetribe.com/v1/api";
const INTEG = "https://flex-integ-api.sharetribe.com/v1/integration_api";
const TEST_MARKETPLACE = "CarnivalRental Test";
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

// ------------------------------------------------------------------------------------------- http
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Spacing between calls of one kind (Test: queries 1/s, commands 1/2s per IP). Live is not rate limited; stay polite. */
const spacing = target === "test" ? { query: 1050, command: 2100 } : { query: 200, command: 400 };
const nextSlot = { query: 0, command: 0 };
async function slot(kind: "query" | "command") {
  const now = Date.now();
  const at = Math.max(now, nextSlot[kind]);
  nextSlot[kind] = at + spacing[kind];
  if (at > now) await sleep(at - now);
}

/**
 * Fetch with rate-limit handling. 429 → exponential backoff with jitter (any call; nothing was processed).
 * 5xx/timeouts are retried only when `idempotent`: a create that timed out may have succeeded, so the next
 * run's email lookup decides instead of a blind retry.
 */
async function call<T>(kind: "query" | "command", url: string, init: RequestInit, idempotent: boolean): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    await slot(kind);
    let res: Response;
    try {
      res = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
    } catch (e) {
      if (idempotent && attempt < 3) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw new Error(`network error on ${new URL(url).pathname}: ${(e as Error).message}`);
    }
    if (res.status === 429 && attempt < 8) {
      await sleep(Math.min(60000, 2000 * 2 ** attempt) + Math.random() * 1000);
      continue;
    }
    if (res.status >= 500 && idempotent && attempt < 3) {
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const codes = (body?.errors ?? []).map((e: { code?: string; title?: string }) => e.code ?? e.title).join(",");
      throw new HttpError(res.status, `${init.method ?? "GET"} ${new URL(url).pathname} → HTTP ${res.status}${codes ? ` (${codes})` : ""}`);
    }
    return body as T;
  }
}

const tokens: Record<string, { value: string; exp: number }> = {};
async function token(kind: "integ" | "anon"): Promise<string> {
  const t = tokens[kind];
  if (t && t.exp > Date.now() + 60000) return t.value;
  const id = kind === "integ" ? process.env.SHARETRIBE_INTEGRATION_CLIENT_ID : process.env.SHARETRIBE_CLIENT_ID;
  const secret = kind === "integ" ? process.env.SHARETRIBE_INTEGRATION_CLIENT_SECRET : undefined;
  if (!id || (kind === "integ" && !secret)) throw new Error(`Sharetribe ${kind === "integ" ? "Integration" : "Marketplace"} API client is not configured`);
  const body = new URLSearchParams({ client_id: id, grant_type: "client_credentials", scope: kind === "integ" ? "integ" : "public-read", ...(secret ? { client_secret: secret } : {}) });
  const res = await fetch(AUTH, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`${kind} auth failed (HTTP ${res.status})`);
  const j = (await res.json()) as { access_token: string; expires_in?: number };
  tokens[kind] = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return j.access_token;
}

const headers = async (kind: "integ" | "anon", json = false) => ({
  Authorization: `Bearer ${await token(kind)}`,
  Accept: "application/json",
  ...(json ? { "Content-Type": "application/json" } : {}),
});

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

async function marketplaceNames(): Promise<{ integ: string; mkt: string }> {
  const integ = await call<{ data: { attributes: { name: string } } }>("query", `${INTEG}/marketplace/show`, { headers: await headers("integ") }, true);
  const mkt = await call<{ data: { attributes: { name: string } } }>("query", `${MKT}/marketplace/show`, { headers: await headers("anon") }, true);
  return { integ: integ.data.attributes.name, mkt: mkt.data.attributes.name };
}

// ------------------------------------------------------------------------------------------- state
function writeJsonAtomic(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

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
  const mx = await dns.resolveMx(domain.domain).catch(() => []);
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
