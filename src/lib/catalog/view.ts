import type { RideOffering, ServiceLocation } from "../content/types";
import { OPTION_LABELS } from "../requests/labels";
import { coversState, type CatalogRecord } from "./normalize";

/**
 * Map a normalised catalog record to the view model the shared page components render.
 * Only fields present on the record are shown; nothing is filled in.
 */
export function toRideViewModel(r: CatalogRecord): RideOffering {
  return {
    slug: r.slug,
    name: r.title,
    categorySlug: r.categoryId,
    summary: r.description,
    description: [],
    suitability: (r.eventTypes ?? []).map((e) => OPTION_LABELS.eventType[e as keyof typeof OPTION_LABELS.eventType] ?? e),
    specs: [], // no verified spec fields exist in contract v1.1
    estimate: r.pricing.mode === "indicative-range" ? { lowUsd: r.pricing.lowUsd, highUsd: r.pricing.highUsd, basis: r.pricing.basis, isDemoValue: false } : null,
    images: [{ src: "", alt: `Development placeholder image for ${r.title}`, license: "dev-placeholder" }],
    recordStatus: "draft",
    isDemo: r.isTestSample,
  };
}

/** Locations a record may be shown for: only where its state is in requestableStates. */
export function eligibleLocations(r: CatalogRecord, locations: ServiceLocation[]): ServiceLocation[] {
  return locations.filter((l) => coversState(r, l.stateCode));
}
