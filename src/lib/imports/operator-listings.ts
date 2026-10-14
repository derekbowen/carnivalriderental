/**
 * Operator ride listings import (Carnival_Host_Import.xlsx "Sharetribe Listings" → Sharetribe listings).
 * Contract: contract/operator-listing-contract.json (founder-approved 2026-10-04). Docs: docs/LISTING_IMPORT.md.
 *
 * Pure logic, no network. Invariants (tests/listing-import.test.ts):
 * - Listings are created only under an imported, still-unclaimed company account, in state pendingApproval.
 * - Public data carries only the approved fields. Dimensions are public only when the operator's own
 *   website is the source; type- or model-typical values stay private. Manufacturer/model are public only
 *   when printed on the operator's site (high confidence).
 * - No photos are uploaded. Geolocation is rounded to ~11 km. No contacts, streets or names in public text.
 * - A row is created at most once: the mapping and the author's existing listings (matched on
 *   metadata.importExternalId) are checked before any create. Existing listings are never modified.
 */
import { z } from "zod";
import { IMPORT_BATCH, personNames, planImport, redact, stripPhones, type CompanyRow, type Workbook } from "./company-accounts";

export const LISTING_TYPE = "operator-ride-rental";
export const RIDE_CLASSES = ["kiddie", "family", "major", "spectacular", "coaster", "funhouse", "dark-ride", "water", "other"] as const;
export const INITIAL_STATE = "pendingApproval";

const json = (label: string) =>
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

const State2 = z.string().regex(/^[A-Z]{2}$/);
const Public = z
  .object({
    rideCategory: z.enum(RIDE_CLASSES),
    manufacturer: z.string().optional(),
    rideModel: z.string().optional(),
    footprintSource: z.enum(["unknown", "type_range", "manufacturer_spec_typical", "operator_website"]),
    footprintRange: z.string().optional(),
    footprintLengthFt: z.number().positive().optional(),
    footprintWidthFt: z.number().positive().optional(),
    rideHeightFt: z.number().positive().optional(),
    minRiderHeightIn: z.number().int().positive().optional(),
    riderRules: z.string().optional(),
    homeState: State2,
    serviceStates: z.array(State2),
    location: z.object({ address: z.string(), building: z.string() }).strict(),
  })
  .strict();
const Private = z
  .object({
    sourceRidePage: z.string().optional(),
    sourceImageUrl: z.string().optional(),
    sourceThumbUrl: z.string().optional(),
    mfrConfidence: z.enum(["high", "medium", "low"]).optional(),
    specModelKey: z.string().optional(),
    specModelName: z.string().optional(),
    specPower: z.string().optional(),
    specTransport: z.string().optional(),
    operatorDimensionText: z.string().optional(),
  })
  .strict();
const Meta = z.object({ claimStatus: z.literal("unclaimed"), importBatch: z.literal(IMPORT_BATCH), companyId: z.string() }).strict();

const RawListing = z.object({
  externalId: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  authorExternalId: z.string(),
  title: z.string().min(1).max(1000),
  description: z.string().min(1).max(5000),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  imageUrl: z.string().nullable(),
  publicData: json("publicData").pipe(Public),
  privateData: json("privateData").pipe(Private),
  metadata: json("metadata").pipe(Meta),
});
export type ListingRow = z.infer<typeof RawListing>;

export interface ListingPayload {
  title: string;
  description?: string;
  state: typeof INITIAL_STATE;
  geolocation: { lat: number; lng: number };
  publicData: Record<string, unknown>;
  privateData: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const LINK_SENTENCE = /[^.\n]*(?:https?:\/\/|www\.)\S+[^.\n]*\.?/gi;

export function cleanDescription(text: string): string {
  return stripPhones(text.replace(NAMES_SUFFIX, "").replace(LINK_SENTENCE, ""))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
const NAMES_SUFFIX = /\n*Space needed: ask the owner for this ride's footprint\.\s*$/;

/** The approved mapping. `authorId` is added by the caller. */
export function buildListingPayload(row: ListingRow): ListingPayload {
  const p = row.publicData;
  const v = row.privateData;
  const highMfr = v.mfrConfidence === "high";
  const ownDims = p.footprintSource === "operator_website";
  const lower = (s: string) => s.toLowerCase();

  const publicData: Record<string, unknown> = {
    listingType: LISTING_TYPE,
    rideClass: p.rideCategory,
    homeState: lower(p.homeState),
    serviceStates: p.serviceStates.map(lower),
    location: { address: p.location.address },
    ...(highMfr && p.manufacturer ? { manufacturer: p.manufacturer } : {}),
    ...(highMfr && p.rideModel ? { rideModel: p.rideModel } : {}),
    ...(p.minRiderHeightIn ? { minRiderHeightIn: p.minRiderHeightIn } : {}),
    ...(p.riderRules ? { riderRules: stripPhones(p.riderRules) } : {}),
    ...(ownDims && p.footprintLengthFt ? { footprintLengthFt: p.footprintLengthFt } : {}),
    ...(ownDims && p.footprintWidthFt ? { footprintWidthFt: p.footprintWidthFt } : {}),
    ...(ownDims && p.rideHeightFt ? { rideHeightFt: p.rideHeightFt } : {}),
  };

  const typical = ownDims
    ? undefined
    : {
        ...(p.footprintRange ? { range: p.footprintRange } : {}),
        ...(p.footprintLengthFt ? { lengthFt: p.footprintLengthFt } : {}),
        ...(p.footprintWidthFt ? { widthFt: p.footprintWidthFt } : {}),
        ...(p.rideHeightFt ? { heightFt: p.rideHeightFt } : {}),
        source: p.footprintSource,
      };
  const privateData: Record<string, unknown> = {
    ...v,
    ...(!highMfr && p.manufacturer ? { manufacturerUnverified: p.manufacturer } : {}),
    ...(!highMfr && p.rideModel ? { rideModelUnverified: p.rideModel } : {}),
    ...(typical && Object.keys(typical).length > 1 ? { footprintTypical: typical } : {}),
  };

  return {
    title: row.title.trim(),
    // Research additions are not the operator's text: the footprint sentence and any sentence citing a link.
    ...(cleanDescription(row.description) ? { description: cleanDescription(row.description) } : {}),
    state: INITIAL_STATE,
    geolocation: { lat: round1(row.lat), lng: round1(row.lng) },
    publicData,
    privateData,
    metadata: { ...row.metadata, importExternalId: row.externalId, footprintSource: p.footprintSource },
  };
}

export interface ListingIssue {
  externalId: string;
  issue: string;
}

export interface ListingPlan {
  /** Rows that pass every check and may be imported. */
  rows: ListingRow[];
  /** Structural problems: block --apply. */
  issues: ListingIssue[];
  /** Rows held back for human review (privacy): never imported, reported every run. */
  held: ListingIssue[];
  /** externalId → company row, for authors in the eligible import. */
  authors: Map<string, CompanyRow>;
  stats: Record<string, number>;
}

/** Parse, validate and privacy-check every listing row against its author's company row. */
export function planListings(wb: Workbook & { listings?: unknown[] }): ListingPlan {
  const company = planImport(wb);
  const authors = new Map(company.eligible.map((r) => [r.externalId, r]));
  const issues: ListingIssue[] = [];
  const held: ListingIssue[] = [];
  const rows: ListingRow[] = [];
  const seen = new Set<string>();
  for (const [i, raw] of (wb.listings ?? []).entries()) {
    const r = RawListing.safeParse(raw);
    const id = (raw as { externalId?: string })?.externalId ?? `row ${i + 2}`;
    if (!r.success) {
      for (const e of r.error.issues) issues.push({ externalId: id, issue: `${e.path.join(".") || "row"}: ${e.message}` });
      continue;
    }
    const row = r.data;
    if (seen.has(row.externalId)) issues.push({ externalId: row.externalId, issue: "duplicate externalId" });
    seen.add(row.externalId);
    const author = authors.get(row.authorExternalId);
    if (!author) {
      issues.push({ externalId: row.externalId, issue: `author ${row.authorExternalId} is not an eligible imported company` });
      continue;
    }
    if (row.metadata.companyId !== author.metadata.companyId) issues.push({ externalId: row.externalId, issue: "companyId differs from the author's" });
    const privacy = listingPrivacy(row, author);
    if (privacy.length) {
      held.push({ externalId: row.externalId, issue: [...new Set(privacy)].join("; ") });
      continue;
    }
    rows.push(row);
  }

  const payloads = rows.map(buildListingPayload);
  const stats: Record<string, number> = {
    listings: rows.length,
    heldForReview: held.length,
    authors: new Set(rows.map((r) => r.authorExternalId)).size,
    publicDimensions: payloads.filter((p) => "footprintLengthFt" in p.publicData).length,
    typicalDimensionsKeptPrivate: payloads.filter((p) => "footprintTypical" in p.privateData).length,
    manufacturerPublic: payloads.filter((p) => "manufacturer" in p.publicData).length,
    manufacturerKeptPrivate: payloads.filter((p) => "manufacturerUnverified" in p.privateData).length,
    sourcePhotoLinkPrivate: payloads.filter((p) => "sourceImageUrl" in p.privateData).length,
    photosUploaded: 0,
  };
  for (const c of RIDE_CLASSES) stats[`class:${c}`] = rows.filter((r) => r.publicData.rideCategory === c).length;
  return { rows, issues, held, authors, stats };
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

/** Public text of the built payload must not carry the author's private contacts or a street. */
export function listingPrivacy(row: ListingRow, author: CompanyRow): string[] {
  const out: string[] = [];
  const pay = buildListingPayload(row);
  const text = [pay.title, pay.description, JSON.stringify(pay.publicData), JSON.stringify(pay.metadata)].join("\n");
  const lower = text.toLowerCase();
  if (EMAIL_RE.test(text)) out.push("public text contains an email address");
  if (/https?:\/\/|www\./i.test(text.replace(/"(website|sourceRidePage)":"[^"]*"/g, ""))) out.push("public text contains a link");
  if (/©|all rights reserved|e-mail us|web site by/i.test(text)) out.push("description contains a scraped website footer");
  if (/\bnamed by\b|gazette|\(pdf\b/i.test(text)) out.push("description contains a research note");
  if (/\b[A-Z]{2}\s+\d{5}(-\d{4})?\b/.test(text)) out.push("public text contains a ZIP code");
  for (const n of personNames(author)) if (lower.includes(n)) out.push("public text names a person from the company's private contacts");
  const street = author.privateData.hqStreet;
  if (street && street.length >= 5 && lower.includes(street.toLowerCase())) out.push("public text contains the company street address");
  return out;
}

// ---------------------------------------------------------------------------------------------
// Import loop
// ---------------------------------------------------------------------------------------------

export interface RemoteListing {
  id: string;
  state: string;
  metadata: Record<string, unknown>;
}

export interface ListingApi {
  /** All listings by the author (any state), paginated by the implementation. */
  listByAuthor(authorId: string): Promise<RemoteListing[]>;
  /** Integration API listings/create. Returns the new listing id. */
  create(payload: ListingPayload & { authorId: string }): Promise<string>;
  /** The author's current metadata (claimStatus), or null when the user is gone. */
  authorMetadata(authorId: string): Promise<Record<string, unknown> | null>;
}

export interface ListingMappingEntry {
  listingId: string;
  authorId: string;
  companyId: string;
  createdAt: string;
}
export type ListingMapping = Record<string, ListingMappingEntry>;

export type ListingOutcome = "created" | "exists" | "waiting_for_author" | "skipped_claimed" | "failed";

export interface ListingLedgerEntry {
  at: string;
  runId: string;
  externalId: string;
  companyId: string;
  outcome: ListingOutcome;
  listingId: string | null;
  authorId: string | null;
  detail?: string;
}

export interface ListingDeps {
  api: ListingApi;
  mapping: ListingMapping;
  /** Company-account mapping (externalId → { userId }) from the account import. */
  accounts: Record<string, { userId: string }>;
  saveMapping(m: ListingMapping): Promise<void> | void;
  now(): string;
  runId: string;
  onResult(e: ListingLedgerEntry): Promise<void> | void;
}

/**
 * Import listings grouped by author: one author lookup and one listing scan per company, then creates.
 * Authors are processed one at a time; Sharetribe's per-IP command limit is the real bound.
 */
export async function runListingImport(rows: ListingRow[], d: ListingDeps): Promise<ListingLedgerEntry[]> {
  const results: ListingLedgerEntry[] = [];
  const emit = async (row: ListingRow, e: Omit<ListingLedgerEntry, "at" | "runId" | "externalId" | "companyId">) => {
    const entry: ListingLedgerEntry = { at: d.now(), runId: d.runId, externalId: row.externalId, companyId: row.metadata.companyId, ...e };
    results.push(entry);
    await d.onResult(entry);
  };

  const byAuthor = new Map<string, ListingRow[]>();
  for (const r of rows) byAuthor.set(r.authorExternalId, [...(byAuthor.get(r.authorExternalId) ?? []), r]);

  for (const [authorExt, group] of byAuthor) {
    const authorId = d.accounts[authorExt]?.userId ?? null;
    if (!authorId) {
      for (const row of group) await emit(row, { outcome: "waiting_for_author", listingId: null, authorId: null, detail: "company account not created yet" });
      continue;
    }
    let existing: RemoteListing[];
    try {
      const meta = await d.api.authorMetadata(authorId);
      if (!meta) {
        for (const row of group) await emit(row, { outcome: "failed", listingId: null, authorId, detail: "author account not found" });
        continue;
      }
      if (meta.claimStatus !== "unclaimed") {
        for (const row of group) await emit(row, { outcome: "skipped_claimed", listingId: null, authorId, detail: `author claimStatus=${String(meta.claimStatus)}` });
        continue;
      }
      existing = await d.api.listByAuthor(authorId);
    } catch (e) {
      for (const row of group) await emit(row, { outcome: "failed", listingId: null, authorId, detail: redact((e as Error).message) });
      continue;
    }
    const byExt = new Map(existing.filter((l) => typeof l.metadata?.importExternalId === "string").map((l) => [l.metadata.importExternalId as string, l]));

    for (const row of group) {
      try {
        const mapped = d.mapping[row.externalId];
        const found = byExt.get(row.externalId) ?? (mapped ? existing.find((l) => l.id === mapped.listingId) : undefined);
        if (found) {
          if (!mapped || mapped.listingId !== found.id) {
            d.mapping[row.externalId] = { listingId: found.id, authorId, companyId: row.metadata.companyId, createdAt: d.now() };
            await d.saveMapping(d.mapping);
          }
          await emit(row, { outcome: "exists", listingId: found.id, authorId });
          continue;
        }
        if (mapped) {
          await emit(row, { outcome: "failed", listingId: mapped.listingId, authorId, detail: "mapped listing not found under its author — not recreating; resolve by hand" });
          continue;
        }
        const listingId = await d.api.create({ ...buildListingPayload(row), authorId });
        d.mapping[row.externalId] = { listingId, authorId, companyId: row.metadata.companyId, createdAt: d.now() };
        await d.saveMapping(d.mapping);
        await emit(row, { outcome: "created", listingId, authorId });
      } catch (e) {
        await emit(row, { outcome: "failed", listingId: null, authorId, detail: redact((e as Error).message) });
      }
    }
  }
  return results;
}
