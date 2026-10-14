/**
 * Public catalogue content model.
 *
 * Source of truth (session one): version-controlled fixtures in src/lib/content.
 * Planned: published ride offerings are mirrored to Sharetribe listings owned by
 * our own seller account, and synced back into this cached content layer — pages
 * never call Sharetribe per page view. See docs/ARCHITECTURE.md.
 *
 * Every factual claim carries a verification status. Unverified values render as
 * "Not yet verified", never as fact.
 */

/** demo: development fixture, never publishable. draft: real but unreviewed. published: passed review. */
export type RecordStatus = "demo" | "draft" | "published";

export interface Verification {
  status: "unverified" | "verified";
  /** Required when verified: where the fact came from (manufacturer doc, site visit, contract...). */
  source?: string;
  verifiedAt?: string;
}

export interface Spec {
  label: string;
  /** null = we do not know it. Never fill with a guess. */
  value: string | null;
  verification: Verification;
}

export interface ContentImage {
  src: string;
  alt: string;
  license: "dev-placeholder" | "owned" | "licensed";
  credit?: string;
}

export interface PlanningEstimate {
  lowUsd: number;
  highUsd: number;
  /** Why this range exists. Shown to customers. */
  basis: string;
  /** True for invented development values — rendered with an explicit DEMO label. */
  isDemoValue: boolean;
}

export interface RideCategory {
  slug: string;
  name: string;
  summary: string;
  description: string;
  recordStatus: RecordStatus;
  isDemo: boolean;
}

export interface RideOffering {
  slug: string;
  name: string;
  categorySlug: string;
  summary: string;
  description: string[];
  /** Event types this ride type typically suits. General guidance, not a guarantee. */
  suitability: string[];
  specs: Spec[];
  estimate: PlanningEstimate | null;
  images: ContentImage[];
  recordStatus: RecordStatus;
  isDemo: boolean;
}

export interface SourcedNote {
  text: string;
  source: string;
}

export interface ServiceLocation {
  stateSlug: string;
  stateName: string;
  stateCode: string;
  citySlug: string;
  cityName: string;
  /** Grounded, sourced local information (permits office, venue context...). Empty = none yet. */
  localNotes: SourcedNote[];
  recordStatus: RecordStatus;
  isDemo: boolean;
}

/**
 * A verified fact that specific equipment can serve a location. This is the ONLY
 * thing that may produce "verified equipment" language on a page. Empty in session one.
 */
export interface VerifiedCoverage {
  rideSlug: string;
  stateSlug: string;
  citySlug: string;
  verification: Verification & { status: "verified"; source: string };
  note: string;
}

export interface ContentSet {
  categories: RideCategory[];
  rides: RideOffering[];
  locations: ServiceLocation[];
  coverage: VerifiedCoverage[];
}
