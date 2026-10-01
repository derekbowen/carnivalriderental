import { demoContentAllowed } from "../config";
import { demoContent } from "./demo/fixtures";
import { checkContentIntegrity } from "./integrity";
import { publishedContent } from "./published/records";
import type { ContentSet, RideCategory, RideOffering, ServiceLocation } from "./types";

export type * from "./types";

function assertIntegrity(set: ContentSet, origin: "demo" | "published") {
  const errors = checkContentIntegrity(set, origin);
  if (errors.length) throw new Error(`Content integrity check failed:\n- ${errors.join("\n- ")}`);
}

/**
 * The renderable content set for this environment. Demo fixtures are merged only
 * when allowed (never in production). Bounded, in-process, no network calls.
 */
export function getContent(): ContentSet {
  assertIntegrity(publishedContent, "published");
  if (!demoContentAllowed()) return publishedContent;
  assertIntegrity(demoContent, "demo");
  return {
    categories: [...publishedContent.categories, ...demoContent.categories],
    rides: [...publishedContent.rides, ...demoContent.rides],
    locations: [...publishedContent.locations, ...demoContent.locations],
    coverage: [...publishedContent.coverage, ...demoContent.coverage],
  };
}

export function getRide(slug: string): RideOffering | undefined {
  return getContent().rides.find((r) => r.slug === slug);
}

export function getCategory(slug: string): RideCategory | undefined {
  return getContent().categories.find((c) => c.slug === slug);
}

export function getLocation(stateSlug: string, citySlug: string): ServiceLocation | undefined {
  return getContent().locations.find((l) => l.stateSlug === stateSlug && l.citySlug === citySlug);
}

export function getVerifiedCoverage(rideSlug: string, stateSlug: string, citySlug: string) {
  return getContent().coverage.filter(
    (c) => c.rideSlug === rideSlug && c.stateSlug === stateSlug && c.citySlug === citySlug,
  );
}
