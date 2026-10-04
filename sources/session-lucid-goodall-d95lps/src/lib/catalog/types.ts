// Structured catalog content that drives the public pages and the sitemap.
//
// Two datasets, kept in separate folders so they can never be confused:
//   * src/data/fixtures/   — development demo records ("fixture"). They may
//     render in development (SHOW_FIXTURES=on) but are never indexable and
//     never appear in the sitemap, whatever their publication status says.
//   * src/data/production/ — records intended for the live site. A record is
//     public only after a person has reviewed it (publication.status
//     "published" plus reviewer and date).
//
// A ride TYPE is what customers browse ("Ferris wheel rental"). It is not a
// physical ride unit and it is not a promise that any unit is available.

export type Dataset = "fixture" | "production";

export type Publication =
  | { status: "draft" }
  | { status: "published"; reviewedBy: string; reviewedAt: string };

export type ImageRef =
  /** Rendered as a labelled illustration; never a photo. */
  | { kind: "placeholder"; glyph: "ferris" | "carousel" | "swing" | "family" | "package"; alt: string }
  /** Only owned or licensed photos may ship to production; record the credit. */
  | { kind: "owned" | "licensed"; src: string; alt: string; credit: string };

/** A specification row. Unverified rows must not show a value. */
export type Spec =
  | { label: string; verified: true; value: string; source: string }
  | { label: string; verified: false; note: string };

/** An indicative price range shown before sourcing. Never a quote. */
export type Estimate = {
  lowCents: number;
  highCents: number;
  basis: string;
  /** True for invented development numbers. Rendered with a warning. */
  placeholder: boolean;
};

export type RideCategory = {
  slug: string;
  name: string;
  summary: string;
  dataset: Dataset;
  publication: Publication;
};

export type RideType = {
  slug: string;
  name: string;
  category: string;
  summary: string;
  description: string[];
  suitability: string[];
  specs: Spec[];
  estimate: Estimate | null;
  image: ImageRef;
  dataset: Dataset;
  publication: Publication;
};

/** A city we accept sourcing requests for. Not a claim of local inventory. */
export type ServiceCity = {
  state: string; // two-letter, lowercase in URLs
  stateName: string;
  slug: string;
  name: string;
  /** Verified, sourced local facts only. Empty is fine. */
  localNotes: { text: string; source: string }[];
  dataset: Dataset;
  publication: Publication;
};

/** An explicitly approved ride + city page. Pairs are never auto-generated. */
export type CityRidePage = {
  state: string;
  city: string;
  ride: string;
  localNotes: { text: string; source: string }[];
  dataset: Dataset;
  publication: Publication;
};
