import { publicIndexingEnabled } from "../config";
import { getContent, getVerifiedCoverage } from "../content";
import { OPERATOR_PROGRAM } from "../operators/program";
import type { RideCategory, RideOffering, ServiceLocation } from "../content/types";
import { paths } from "./routes";

/**
 * Publication gates. A page may RENDER (in development) without being INDEXABLE.
 * Indexable means: robots index + sitemap inclusion. All gates must pass.
 */
export interface GateResult {
  indexable: boolean;
  reasons: string[];
}

function base(record: { isDemo: boolean; recordStatus: string }): string[] {
  const reasons: string[] = [];
  if (!publicIndexingEnabled()) reasons.push("public indexing disabled in this environment");
  if (record.isDemo) reasons.push("demo fixture");
  if (record.recordStatus !== "published") reasons.push(`record status is ${record.recordStatus}`);
  return reasons;
}

const result = (reasons: string[]): GateResult => ({ indexable: reasons.length === 0, reasons });

export function rideGate(ride: RideOffering): GateResult {
  const reasons = base(ride);
  if (ride.description.join(" ").length < 400) reasons.push("description below minimum useful length");
  if (ride.images.some((i) => i.license === "dev-placeholder")) reasons.push("uses placeholder images");
  if (!ride.specs.some((s) => s.verification.status === "verified")) reasons.push("no verified specifications");
  return result(reasons);
}

export function categoryGate(category: RideCategory): GateResult {
  const reasons = base(category);
  const rides = getContent().rides.filter((r) => r.categorySlug === category.slug && rideGate(r).indexable);
  if (rides.length === 0) reasons.push("no indexable ride offerings in category");
  return result(reasons);
}

export function cityGate(location: ServiceLocation): GateResult {
  const reasons = base(location);
  // City-name substitution alone is not useful content.
  if (location.localNotes.length === 0) reasons.push("no sourced local information");
  return result(reasons);
}

/**
 * Ride + city pages are the thinnest family. They require both parents to be
 * indexable AND a verified, location-specific coverage fact.
 */
export function rideCityGate(ride: RideOffering, location: ServiceLocation): GateResult {
  const reasons = base(ride).concat(base(location).filter((r) => !r.startsWith("public indexing")));
  if (!rideGate(ride).indexable) reasons.push("parent ride page not indexable");
  if (!cityGate(location).indexable) reasons.push("parent city page not indexable");
  if (getVerifiedCoverage(ride.slug, location.stateSlug, location.citySlug).length === 0) {
    reasons.push("no verified coverage for this ride in this location");
  }
  return result([...new Set(reasons)]);
}

/** The operator program page: indexable only once the founder approves its copy. */
export function operatorPageGate(): GateResult {
  const reasons: string[] = [];
  if (!publicIndexingEnabled()) reasons.push("public indexing disabled in this environment");
  if (!OPERATOR_PROGRAM.copyApproved) reasons.push("operator page copy not approved");
  return result(reasons);
}

/** Every renderable SEO route with its gate. Used by sitemap, tests and the internal SEO view. */
export function allSeoRoutes(): { path: string; family: string; gate: GateResult }[] {
  const { rides, categories, locations } = getContent();
  const out: { path: string; family: string; gate: GateResult }[] = [];
  out.push({ path: paths.operators(), family: "operators", gate: operatorPageGate() });
  for (const c of categories) out.push({ path: paths.category(c.slug), family: "category", gate: categoryGate(c) });
  for (const r of rides) out.push({ path: paths.ride(r.slug), family: "ride", gate: rideGate(r) });
  for (const l of locations) out.push({ path: paths.city(l.stateSlug, l.citySlug), family: "city", gate: cityGate(l) });
  for (const r of rides)
    for (const l of locations)
      out.push({
        path: paths.rideCity(r.slug, l.stateSlug, l.citySlug),
        family: "ride-city",
        gate: rideCityGate(r, l),
      });
  return out;
}
