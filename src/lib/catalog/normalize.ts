import store from "../../../catalog/offerings.json";
import { CATEGORY_IDS, EVENT_TYPE_IDS, LISTING_TYPE_ID, US_STATE_CODES, validateOfferingRecord } from "../contract";

/**
 * Read-side normalisation: Sharetribe listing (public API shape) -> catalog record.
 *
 * Every record is re-validated here because Console edits never pass through our write
 * validator. Invalid records are REJECTED (never rendered). Valid records still have
 * unsupported claims withheld (e.g. an estimate without approved provenance).
 */

export interface SharetribeListing {
  id: string;
  attributes: {
    title: string;
    description: string;
    state?: string;
    deleted?: boolean;
    geolocation?: unknown;
    price?: unknown;
    publicData?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    privateData?: Record<string, unknown>;
  };
}

export interface EstimateProvenance {
  approvedBy: string;
  approvedAt: string;
  source: string;
}

interface StoreEntry {
  slug: string;
  isTestSample: boolean;
  estimateProvenance: EstimateProvenance | null;
}

export interface CatalogRecord {
  offerKey: string;
  listingId: string;
  slug: string;
  title: string;
  description: string;
  categoryId: string;
  requestableStates: string[];
  /** null = not reviewed. Never filled in to look complete. */
  eventTypes: string[] | null;
  pricing: { mode: "quote-required" } | { mode: "indicative-range"; lowUsd: number; highUsd: number; basis: string };
  isTestSample: boolean;
  /** Claims we received but did not show, with the reason. */
  withheld: string[];
}

export type NormalizeResult = { ok: true; record: CatalogRecord } | { ok: false; listingId: string; reasons: string[] };

type Store = { offerings: Record<string, StoreEntry> };

export function normalizeListing(l: SharetribeListing, catalog: Store = store as Store): NormalizeResult {
  const a = l.attributes;
  const reasons: string[] = [];
  if (a.deleted) reasons.push("listing deleted");
  if (a.state && a.state !== "published") reasons.push(`listing state is ${a.state}`);
  const md = a.metadata ?? {};
  const pd = a.publicData ?? {};

  // Only fields readable by the public are considered; privateData is ignored even if present.
  const structural = validateOfferingRecord({ title: a.title, description: a.description, publicData: pd, metadata: md, geolocation: a.geolocation, price: a.price });
  reasons.push(...structural);

  const offerKey = typeof md.offerKey === "string" ? md.offerKey : null;
  const entry = offerKey ? catalog.offerings[offerKey] : undefined;
  if (offerKey && !entry) reasons.push(`no catalog record for ${offerKey} (slug/publication unknown)`);
  if (reasons.length || !offerKey || !entry) return { ok: false, listingId: l.id, reasons };

  const withheld: string[] = [];
  let pricing: CatalogRecord["pricing"] = { mode: "quote-required" };
  if (md.pricingMode === "indicative-range") {
    if (entry.estimateProvenance) {
      pricing = { mode: "indicative-range", lowUsd: md.estimateLowUsd as number, highUsd: md.estimateHighUsd as number, basis: md.estimateBasis as string };
    } else {
      withheld.push("planning estimate withheld: no approved provenance in catalog store");
    }
  }

  return {
    ok: true,
    record: {
      offerKey,
      listingId: l.id,
      slug: entry.slug,
      title: a.title,
      description: a.description,
      categoryId: pd.categoryLevel1 as string,
      requestableStates: [...(md.requestableStates as string[])].filter((s) => US_STATE_CODES.includes(s)).sort(),
      eventTypes: Array.isArray(md.eventTypes) ? (md.eventTypes as string[]).filter((e) => EVENT_TYPE_IDS.includes(e)) : null,
      pricing,
      isTestSample: entry.isTestSample,
      withheld,
    },
  };
}

export function normalizeAll(listings: SharetribeListing[], catalog?: Store) {
  const records: CatalogRecord[] = [];
  const rejected: { listingId: string; reasons: string[] }[] = [];
  const seen = new Map<string, string>();
  for (const l of listings) {
    const r = normalizeListing(l, catalog);
    if (!r.ok) {
      rejected.push({ listingId: r.listingId, reasons: r.reasons });
      continue;
    }
    // Duplicate offerKeys on read (e.g. a Console copy): reject all but none silently wins.
    const prev = seen.get(r.record.offerKey);
    if (prev) {
      rejected.push({ listingId: r.record.listingId, reasons: [`duplicate offerKey ${r.record.offerKey} (also on ${prev})`] });
      const i = records.findIndex((x) => x.offerKey === r.record.offerKey);
      if (i >= 0) rejected.push({ listingId: records.splice(i, 1)[0].listingId, reasons: [`duplicate offerKey ${r.record.offerKey}`] });
      continue;
    }
    seen.set(r.record.offerKey, r.record.listingId);
    records.push(r.record);
  }
  return { records, rejected };
}

/** Is this offering eligible for an event in this state? Missing coverage never means nationwide. */
export function coversState(r: CatalogRecord, stateCode: string): boolean {
  return r.requestableStates.includes(stateCode.toLowerCase());
}

export const CATALOG_LISTING_TYPE = LISTING_TYPE_ID;
export const CATALOG_CATEGORY_IDS = CATEGORY_IDS;
