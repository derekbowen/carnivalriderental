import { appEnv } from "../config";
import { CONTRACT } from "../contract";
import type { RideOffering } from "../content/types";
import { paths } from "../seo/routes";
import type { CatalogRecord } from "./normalize";
import type { CatalogSnapshot } from "./source";

/**
 * ONE view model for every listing card (category hubs, state hubs, occasion pages).
 *
 * It reconciles the two sources honestly:
 * - live catalog records (Sharetribe, via src/lib/catalog) — the only real supply;
 * - development fixtures (src/lib/content/demo) — rendered only outside production,
 *   always labelled, never counted as supply and never put in production structured data.
 */
export interface ListingCardModel {
  key: string;
  name: string;
  /** Short factual description. Empty string when the source has none (nothing is written for it). */
  description: string;
  categoryId: string;
  /** Owned/licensed photo with provenance. null → the card shows a labelled category illustration. */
  photo: { src: string; alt: string } | null;
  /** At most two VERIFIED specifications; unverified values never reach a card. */
  specs: { label: string; value: string }[];
  /** Approved planning estimate and its basis; null → "Request pricing". */
  estimate: { lowUsd: number; highUsd: number; basis: string } | null;
  /**
   * Where "View details" goes. kind "preview" = noindex development preview of a catalog record;
   * those links are NOT rendered in production (no public catalog detail page exists yet).
   */
  detail: { href: string; kind: "public" | "preview" } | null;
  /** Visible label for non-real records ("Test sample", "Demo record"); null for real supply. */
  sampleLabel: string | null;
  source: "catalog" | "demo-fixture";
  /** States the offering accepts requests in (catalog only), for location links. */
  states: string[];
}

const clampDescription = (s: string) => (s.length > 180 ? `${s.slice(0, 177).trimEnd()}…` : s);

/** Live catalog record → card. `snap` tells us whether the record came from the real catalog. */
export function cardFromCatalog(r: CatalogRecord, opts: { production?: boolean } = {}): ListingCardModel {
  const production = opts.production ?? appEnv() === "production";
  return {
    key: `catalog:${r.offerKey}`,
    name: r.title,
    description: clampDescription(r.description),
    categoryId: r.categoryId,
    // Listing images are not read yet: they need include=images plus provenance in catalog/offerings.json.
    photo: null,
    // Contract v1.1 has no spec fields (deferred, DATA_CONTRACT §6).
    specs: [],
    // normalizeListing already withholds estimates without approved provenance.
    estimate: r.pricing.mode === "indicative-range" ? { lowUsd: r.pricing.lowUsd, highUsd: r.pricing.highUsd, basis: r.pricing.basis } : null,
    detail: production ? null : { href: paths.previewRide(r.slug), kind: "preview" },
    sampleLabel: r.isTestSample ? "Test sample" : null,
    source: "catalog",
    states: r.requestableStates,
  };
}

/** Development fixture ride → card. Callers only pass fixtures outside production (getContent enforces it). */
export function cardFromFixture(ride: RideOffering): ListingCardModel {
  const img = ride.images.find((i) => i.license !== "dev-placeholder");
  return {
    key: `fixture:${ride.slug}`,
    name: ride.name,
    description: clampDescription(ride.summary),
    categoryId: ride.categorySlug,
    photo: img ? { src: img.src, alt: img.alt } : null,
    specs: ride.specs
      .filter((s) => s.verification.status === "verified" && s.value !== null)
      .slice(0, 2)
      .map((s) => ({ label: s.label, value: s.value! })),
    // Demo values are invented by definition: never shown as an approved estimate.
    estimate: ride.estimate && !ride.estimate.isDemoValue ? { lowUsd: ride.estimate.lowUsd, highUsd: ride.estimate.highUsd, basis: ride.estimate.basis } : null,
    detail: { href: paths.ride(ride.slug), kind: "public" },
    sampleLabel: ride.isDemo ? "Demo record" : null,
    source: "demo-fixture",
    states: [],
  };
}

/** Real supply only: live catalog source, not a test sample. Fixtures never count. */
export function isRealSupply(card: ListingCardModel, snap: Pick<CatalogSnapshot, "source">): boolean {
  return card.source === "catalog" && card.sampleLabel === null && snap.source === "sharetribe-marketplace-api";
}

/**
 * Cards allowed in structured data: everything outside production (previews show the shape),
 * real supply only in production.
 */
export function structuredDataCards(cards: ListingCardModel[], snap: Pick<CatalogSnapshot, "source">, production = appEnv() === "production"): ListingCardModel[] {
  return production ? cards.filter((c) => isRealSupply(c, snap)) : cards;
}

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CONTRACT.categories.items.map((c) => [c.id, c.label]));
export const categoryLabel = (id: string) => CATEGORY_LABEL[id] ?? id;

/** Category illustrations (original artwork in public/illustrations/categories). Never a photo of a unit. */
const ILLUSTRATED = new Set(["ferris-wheels", "carousels", "swing-rides", "thrill-rides", "kiddie-rides"]);
export function categoryIllustration(categoryId: string): { src: string; alt: string } | null {
  if (!ILLUSTRATED.has(categoryId)) return null;
  return { src: `/illustrations/categories/${categoryId}.svg`, alt: `Illustration of ${categoryLabel(categoryId).toLowerCase()} — not a photo of a specific ride` };
}
