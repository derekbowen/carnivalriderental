/**
 * Company-account import (Carnival_Host_Import.xlsx → Sharetribe users). Scope: accounts only, no listings.
 *
 * Pure logic, no network: parsing, tier selection, payload building, privacy checks, and the
 * idempotent per-row import loop over an injected `AccountApi`. The CLI (scripts/company-import.ts)
 * supplies the real Sharetribe API, the durable mapping file and the ledger.
 *
 * Invariants (tests/company-import.test.ts):
 * - Only tiers A_ready and B_account_only are imported. C_verify_first is held; D_exclude never appears.
 * - Emails use an explicitly configured claim domain we control; the `<CLAIM_DOMAIN>` placeholder fails.
 * - Public surfaces (displayName, bio, publicData, metadata) never carry private contacts, streets or notes.
 *   Research notes and sources never leave this repo: a claiming company would see its own privateData.
 * - A row is created at most once: the mapping and a live lookup by email both run before any create.
 *   Existing accounts are never overwritten and credentials are never reset; claimed accounts are left alone.
 * - The generated password is discarded immediately. It is never stored, logged or written to the ledger.
 */
import { z } from "zod";

export const IMPORT_BATCH = "carnival-hosts-2026-10-v1";
export const ELIGIBLE_TIERS = ["A_ready", "B_account_only"] as const;
export const HELD_TIERS = ["C_verify_first"] as const;
export const EXCLUDED_TIERS = ["D_exclude"] as const;
export const PLACEHOLDER = "<CLAIM_DOMAIN>";

/** privateData keys kept out of Sharetribe entirely (internal research, visible to a claimer otherwise). */
export const PRIVATE_KEYS_NOT_UPLOADED = ["researchNotes", "sources"] as const;

const Tier = z.enum(["A_ready", "B_account_only", "C_verify_first", "D_exclude"]);
const jsonObject = (label: string) =>
  z.string().transform((s, ctx) => {
    try {
      const v = JSON.parse(s);
      if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
    } catch {
      /* fall through */
    }
    ctx.addIssue({ code: "custom", message: `${label} is not a JSON object` });
    return z.NEVER;
  });

const PublicData = z
  .object({
    companyName: z.string().min(1),
    hqCity: z.string().optional(),
    hqState: z.string().regex(/^[A-Z]{2}$/).optional(),
    statesServed: z.array(z.string().regex(/^[A-Z]{2}$/)).optional(),
    website: z.string().url().optional(),
    otherOperations: z.array(z.string()).optional(),
  })
  .strict();
const ProtectedData = z.object({ phoneNumber: z.string().min(7).optional() }).strict();
const Owner = z.object({ name: z.string(), title: z.string().optional(), source: z.string().optional() }).strict();
const PrivateData = z
  .object({
    legalEntityName: z.string().optional(),
    owners: z.array(Owner).optional(),
    contactName: z.string().optional(),
    contactEmail: z.string().optional(),
    hqStreet: z.string().optional(),
    hqZip: z.string().optional(),
    hqLat: z.number().optional(),
    hqLng: z.number().optional(),
    sources: z.array(z.string()).optional(),
    researchNotes: z.string().optional(),
    cwId: z.string().optional(),
    facebook: z.string().optional(),
    instagram: z.string().optional(),
    season: z.string().optional(),
    notableEvents: z.array(z.string()).optional(),
    routePageUrl: z.string().optional(),
    /** Set by planImport, never by the workbook: public activity notes that named a person. */
    otherOperationsNamingPeople: z.array(z.string()).optional(),
  })
  .strict();
const Metadata = z
  .object({
    claimStatus: z.literal("unclaimed"),
    importBatch: z.literal(IMPORT_BATCH),
    companyId: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    importSource: z.string(),
    researchStatus: z.string(),
  })
  .strict();

const RawUserRow = z.object({
  externalId: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  importTier: Tier,
  emailPlaceholder: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  displayName: z.string().min(1),
  bio: z.string().nullable(),
  publicData: jsonObject("publicData").pipe(PublicData),
  protectedData: jsonObject("protectedData").pipe(ProtectedData),
  privateData: jsonObject("privateData").pipe(PrivateData),
  metadata: jsonObject("metadata").pipe(Metadata),
});
export type CompanyRow = z.infer<typeof RawUserRow>;

export interface Workbook {
  source: { file: string; sha256: string };
  users: unknown[];
  companies: { companyId: string; importTier: string }[];
}

export interface RowIssue {
  externalId: string;
  issue: string;
}

export interface ImportPlan {
  source: Workbook["source"];
  eligible: CompanyRow[];
  held: CompanyRow[];
  /** Companies-sheet rows in D_exclude. They have no user row by design. */
  excludedCompanies: string[];
  tierCounts: Record<string, number>;
  issues: RowIssue[];
  /** Public text changed before upload (phone numbers moved out of public fields). */
  sanitized: RowIssue[];
}

/** Parse, validate and split the workbook. Any issue blocks --apply. */
export function planImport(wb: Workbook): ImportPlan {
  const issues: RowIssue[] = [];
  const sanitized: RowIssue[] = [];
  const rows: CompanyRow[] = [];
  wb.users.forEach((u, i) => {
    const r = RawUserRow.safeParse(u);
    const id = (u as { externalId?: string })?.externalId ?? `row ${i + 2}`;
    if (!r.success) {
      for (const e of r.error.issues) issues.push({ externalId: id, issue: `${e.path.join(".") || "row"}: ${e.message}` });
      return;
    }
    const row = r.data;
    const before = JSON.stringify([row.displayName, row.bio, row.publicData]);
    row.displayName = stripPhones(row.displayName);
    row.bio = row.bio === null ? null : stripPhones(row.bio);
    row.publicData = stripPhonesDeep(row.publicData) as typeof row.publicData;
    if (JSON.stringify([row.displayName, row.bio, row.publicData]) !== before) sanitized.push({ externalId: row.externalId, issue: "phone number removed from public text" });
    // Activity notes that name a person (an owner, the contact, "contact Jane Doe") move to privateData.
    const names = personNames(row);
    const ops = row.publicData.otherOperations ?? [];
    const naming = ops.filter((o) => CONTACT_RE.test(o) || names.some((n) => o.toLowerCase().includes(n)));
    if (naming.length) {
      row.publicData = { ...row.publicData, otherOperations: ops.filter((o) => !naming.includes(o)) };
      if (!row.publicData.otherOperations?.length) delete row.publicData.otherOperations;
      row.privateData = { ...row.privateData, otherOperationsNamingPeople: naming };
      sanitized.push({ externalId: row.externalId, issue: `${naming.length} otherOperations entr${naming.length === 1 ? "y" : "ies"} naming a person moved to privateData` });
    }
    rows.push(row);
  });

  const companyTier = new Map(wb.companies.map((c) => [c.companyId, c.importTier]));
  const seen = { ext: new Set<string>(), company: new Set<string>(), email: new Set<string>() };
  for (const r of rows) {
    const cid = r.metadata.companyId;
    if (seen.ext.has(r.externalId)) issues.push({ externalId: r.externalId, issue: "duplicate externalId" });
    if (seen.company.has(cid)) issues.push({ externalId: r.externalId, issue: `duplicate companyId ${cid}` });
    if (seen.email.has(r.emailPlaceholder)) issues.push({ externalId: r.externalId, issue: "duplicate email" });
    seen.ext.add(r.externalId);
    seen.company.add(cid);
    seen.email.add(r.emailPlaceholder);
    if (r.emailPlaceholder !== `${cid}@${PLACEHOLDER}`) issues.push({ externalId: r.externalId, issue: `email must be ${cid}@${PLACEHOLDER}` });
    const ct = companyTier.get(cid);
    if (!ct) issues.push({ externalId: r.externalId, issue: `companyId ${cid} not in Companies sheet` });
    else if (ct !== r.importTier) issues.push({ externalId: r.externalId, issue: `tier ${r.importTier} differs from Companies sheet (${ct})` });
    if (r.importTier === "D_exclude") issues.push({ externalId: r.externalId, issue: "D_exclude row present in Sharetribe Users" });
    for (const p of privacyViolations(r)) issues.push({ externalId: r.externalId, issue: p });
  }

  const tierCounts: Record<string, number> = {};
  for (const c of wb.companies) tierCounts[c.importTier] = (tierCounts[c.importTier] ?? 0) + 1;

  return {
    source: wb.source,
    eligible: rows.filter((r) => (ELIGIBLE_TIERS as readonly string[]).includes(r.importTier)),
    held: rows.filter((r) => (HELD_TIERS as readonly string[]).includes(r.importTier)),
    excludedCompanies: wb.companies.filter((c) => (EXCLUDED_TIERS as readonly string[]).includes(c.importTier)).map((c) => c.companyId),
    tierCounts,
    issues,
    sanitized,
  };
}

const PHONE_G = /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
/** Remove phone numbers from public text and tidy the punctuation they leave behind. */
export function stripPhones(text: string): string {
  return text
    .replace(PHONE_G, "")
    .replace(/,\s*\)/g, ")")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+\)/g, ")")
    .replace(/\s{2,}/g, " ")
    .trim();
}
function stripPhonesDeep(v: unknown): unknown {
  if (typeof v === "string") return stripPhones(v);
  if (Array.isArray(v)) return v.map(stripPhonesDeep);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === "website" ? x : stripPhonesDeep(x)]));
  return v;
}

// ---------------------------------------------------------------------------------------------
// Claim domain
// ---------------------------------------------------------------------------------------------

/** Consumer mailbox providers: an address there is not a domain we control. */
const PUBLIC_MAIL = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "aol.com", "icloud.com", "me.com", "proton.me", "protonmail.com", "gmx.com", "mail.com"]);
const RESERVED = /(^|\.)(example\.(com|net|org)|test|invalid|localhost|local|example)$/;

/**
 * Validate IMPORT_CLAIM_EMAIL_DOMAIN. Syntax only: proving we control the domain (MX lookup and the
 * founder's approval) happens in the CLI before --apply.
 */
export function validateClaimDomain(raw: string | undefined): { ok: true; domain: string } | { ok: false; reason: string } {
  const d = (raw ?? "").trim().toLowerCase();
  if (!d) return { ok: false, reason: "IMPORT_CLAIM_EMAIL_DOMAIN is not set" };
  if (d.includes("<") || d.includes(">") || d.includes("claim_domain")) return { ok: false, reason: `claim domain still contains the ${PLACEHOLDER} placeholder` };
  if (d.includes("@")) return { ok: false, reason: "claim domain must be a domain, not an email address" };
  if (!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(d)) return { ok: false, reason: `"${d}" is not a valid domain name` };
  if (RESERVED.test(d)) return { ok: false, reason: `"${d}" is a reserved/example domain` };
  if (PUBLIC_MAIL.has(d)) return { ok: false, reason: `"${d}" is a public mailbox provider, not a domain we control` };
  return { ok: true, domain: d };
}

export function claimEmail(row: CompanyRow, domain: string): string {
  const email = row.emailPlaceholder.replace(PLACEHOLDER, domain).toLowerCase();
  if (email.includes("<") || email.includes(">")) throw new Error(`placeholder remains in ${email}`);
  return email;
}

// ---------------------------------------------------------------------------------------------
// Payload
// ---------------------------------------------------------------------------------------------

export interface CreatePayload {
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  bio?: string;
  publicData: Record<string, unknown>;
  protectedData: Record<string, unknown>;
  privateData: Record<string, unknown>;
}

/** Marker in privateData so an account can be recognised as ours (and resumed) after a crash. */
export interface ImportMarker {
  importExternalId: string;
  importBatch: string;
}

/**
 * Body for Marketplace API `current_user/create` (password added by the caller and discarded) and the
 * operator-only metadata set afterwards with Integration API `users/update_profile`.
 * Visibility is the workbook's: publicData/metadata public, protectedData revealable in a transaction,
 * privateData owner + operator only.
 */
export function buildPayload(row: CompanyRow, domain: string): { create: CreatePayload; metadata: Record<string, unknown> } {
  const { researchNotes: _n, sources: _s, owners, ...privateRest } = row.privateData;
  const privateData: Record<string, unknown> = {
    ...privateRest,
    ...(owners ? { owners: owners.map(({ name, title }) => (title ? { name, title } : { name })) } : {}),
    importExternalId: row.externalId,
    importBatch: row.metadata.importBatch,
  } satisfies Partial<ImportMarker> & Record<string, unknown>;
  return {
    create: {
      email: claimEmail(row, domain),
      firstName: row.firstName,
      lastName: row.lastName,
      displayName: row.displayName,
      ...(row.bio ? { bio: row.bio } : {}),
      publicData: { ...row.publicData },
      protectedData: { ...row.protectedData },
      privateData,
    },
    metadata: { ...row.metadata },
  };
}

/** "contact Jane Doe", "contact: Jane Doe" */
const CONTACT_RE = /\bcontact:?\s+[A-Z][a-z]+\s+[A-Z][a-z]+/;

/**
 * Names of people in the row's private fields (contact + owners), lower-cased, at least two words or
 * 5+ characters. Names that are part of the company name ("Arnold" in "Arnold Amusements") are public
 * by definition and are left out.
 */
export function personNames(row: CompanyRow): string[] {
  const company = `${row.publicData.companyName} ${row.displayName} ${row.metadata.companyId.replace(/-/g, " ")}`.toLowerCase();
  const raw = [row.privateData.contactName, ...(row.privateData.owners ?? []).map((o) => o.name)];
  const names = raw
    .filter((n): n is string => !!n)
    .map((n) => n.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim().toLowerCase())
    .filter((n) => n.length >= 5 && !company.includes(n));
  return [...new Set(names)];
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/;

/** Private values that must not appear on any public surface of the row. */
export function privacyViolations(row: CompanyRow): string[] {
  const pub = { displayName: row.displayName, bio: row.bio ?? "", publicData: JSON.stringify(row.publicData), metadata: JSON.stringify(row.metadata) };
  const p = row.privateData;
  const secrets: [string, string | undefined][] = [
    ["contactEmail", p.contactEmail],
    ["hqStreet", p.hqStreet],
    ["phoneNumber", row.protectedData.phoneNumber],
    ...personNames(row).map((n): [string, string] => ["person name", n]),
  ];
  const out: string[] = [];
  for (const [field, text] of Object.entries(pub)) {
    const lower = text.toLowerCase();
    if (EMAIL_RE.test(text)) out.push(`${field} contains an email address`);
    if (PHONE_RE.test(text)) out.push(`${field} contains a phone number`);
    if (CONTACT_RE.test(text)) out.push(`${field} names a contact person`);
    for (const [k, v] of secrets) if (v && v.length >= 5 && lower.includes(v.toLowerCase())) out.push(`${field} contains private ${k}`);
    for (const k of ["researchNotes", "sources", "owners", "contactName", "hqStreet", "hqZip", "contactEmail"]) {
      if (field !== "bio" && field !== "displayName" && text.includes(`"${k}"`)) out.push(`${field} carries private key ${k}`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Import loop
// ---------------------------------------------------------------------------------------------

export interface RemoteUser {
  id: string;
  email: string;
  emailVerified: boolean;
  stripeConnected: boolean;
  metadata: Record<string, unknown>;
  privateData: Record<string, unknown>;
}

/** The four API calls the import needs. Real implementation in scripts/company-import.ts. */
export interface AccountApi {
  showById(id: string): Promise<RemoteUser | null>;
  showByEmail(email: string): Promise<RemoteUser | null>;
  /** current_user/create. Returns the new user id. `password` must not be retained. */
  create(payload: CreatePayload & { password: string }): Promise<string>;
  /** users/update_profile with metadata only. */
  setMetadata(id: string, metadata: Record<string, unknown>): Promise<void>;
}

export interface MappingEntry {
  userId: string;
  email: string;
  companyId: string;
  createdAt: string;
}
export type Mapping = Record<string, MappingEntry>;

export type Outcome =
  | "created"
  | "resumed" // account existed from an interrupted run; metadata completed
  | "exists" // already imported and complete
  | "skipped_claimed" // claimed or changed since import: left untouched
  | "conflict" // email belongs to an account we did not create
  | "failed";

export interface LedgerEntry {
  at: string;
  runId: string;
  externalId: string;
  companyId: string;
  outcome: Outcome;
  userId: string | null;
  email: string;
  detail?: string;
}

export interface RowDeps {
  api: AccountApi;
  mapping: Mapping;
  /** Persist the mapping (atomically) — called as soon as a user id is known. */
  saveMapping(m: Mapping): Promise<void> | void;
  newPassword(): string;
  now(): string;
}

// The marker lives in privateData (operator-readable), not public metadata: externalIds embed private directory ids.
const ours = (u: RemoteUser, externalId: string) => u.privateData?.importExternalId === externalId;
const metadataComplete = (u: RemoteUser, want: Record<string, unknown>) => Object.entries(want).every(([k, v]) => JSON.stringify(u.metadata?.[k]) === JSON.stringify(v));

/** Import one row. Idempotent: safe to call again after any failure or interruption. */
export async function importRow(row: CompanyRow, domain: string, d: RowDeps): Promise<Omit<LedgerEntry, "at" | "runId">> {
  const { create, metadata } = buildPayload(row, domain);
  const base = { externalId: row.externalId, companyId: row.metadata.companyId, email: create.email };
  const record = async (userId: string) => {
    if (d.mapping[row.externalId]?.userId === userId) return;
    d.mapping[row.externalId] = { userId, email: create.email, companyId: row.metadata.companyId, createdAt: d.now() };
    await d.saveMapping(d.mapping);
  };

  // 1. Known from the mapping, or 2. an account already holds this email.
  const mapped = d.mapping[row.externalId];
  let existing = mapped ? await d.api.showById(mapped.userId) : null;
  if (mapped && !existing) return { ...base, outcome: "failed", userId: mapped.userId, detail: "mapped user not found (deleted?) — not recreating; resolve by hand" };
  if (!existing) existing = await d.api.showByEmail(create.email);

  if (existing) {
    if (!ours(existing, row.externalId)) return { ...base, outcome: "conflict", userId: existing.id, detail: "email belongs to an account this import did not create" };
    await record(existing.id);
    const claim = existing.metadata?.claimStatus;
    if (claim !== undefined && claim !== "unclaimed") return { ...base, outcome: "skipped_claimed", userId: existing.id, detail: `claimStatus=${String(claim)}` };
    if (existing.emailVerified) return { ...base, outcome: "skipped_claimed", userId: existing.id, detail: "email verified since import" };
    if (metadataComplete(existing, metadata)) return { ...base, outcome: "exists", userId: existing.id };
    // Interrupted after create, before metadata. Only operator metadata is written; profile is never overwritten.
    await d.api.setMetadata(existing.id, metadata);
    return { ...base, outcome: "resumed", userId: existing.id };
  }

  // 3. Create. The password exists only for this call.
  let userId: string;
  {
    const password = d.newPassword();
    userId = await d.api.create({ ...create, password });
  }
  await record(userId);
  await d.api.setMetadata(userId, metadata);
  return { ...base, outcome: "created", userId };
}

/** Run rows with bounded concurrency. Never throws for a row; failures go to the ledger. */
export async function runImport(
  rows: CompanyRow[],
  domain: string,
  d: RowDeps & { runId: string; concurrency: number; onResult(e: LedgerEntry): Promise<void> | void },
): Promise<LedgerEntry[]> {
  const results: LedgerEntry[] = [];
  let next = 0;
  const worker = async () => {
    while (next < rows.length) {
      const row = rows[next++];
      let r: Omit<LedgerEntry, "at" | "runId">;
      try {
        r = await importRow(row, domain, d);
      } catch (e) {
        r = { externalId: row.externalId, companyId: row.metadata.companyId, email: claimEmail(row, domain), outcome: "failed", userId: d.mapping[row.externalId]?.userId ?? null, detail: redact((e as Error).message) };
      }
      const entry: LedgerEntry = { at: d.now(), runId: d.runId, ...r };
      results.push(entry);
      await d.onResult(entry);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(d.concurrency, 10)) }, worker));
  return results;
}

/** Strip anything credential-shaped from an error before it reaches the ledger or console. */
export function redact(msg: string): string {
  return msg
    .replace(/("?password"?\s*[:=]\s*)"[^"]*"/gi, '$1"[redacted]"')
    .replace(/(bearer\s+)[a-z0-9._~+/=-]+/gi, "$1[redacted]")
    .replace(/(client_secret|access_token|refresh_token)=([^&\s]+)/gi, "$1=[redacted]")
    .slice(0, 500);
}
