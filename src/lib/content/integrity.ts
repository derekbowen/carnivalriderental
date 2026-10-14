import type { ContentSet } from "./types";

/**
 * Structural guarantees on content. Violations throw at load time (and therefore
 * fail the build), so demo data cannot be mistaken for verified inventory.
 */
export function checkContentIntegrity(content: ContentSet, origin: "demo" | "published"): string[] {
  const errors: string[] = [];
  const label = (kind: string, slug: string) => `${origin}:${kind}:${slug}`;

  const records = [
    ...content.categories.map((r) => ({ kind: "category", slug: r.slug, r })),
    ...content.rides.map((r) => ({ kind: "ride", slug: r.slug, r })),
    ...content.locations.map((r) => ({ kind: "location", slug: `${r.stateSlug}/${r.citySlug}`, r })),
  ];

  for (const { kind, slug, r } of records) {
    if (origin === "demo" && (!r.isDemo || r.recordStatus !== "demo")) {
      errors.push(`${label(kind, slug)} demo fixture must have isDemo=true and recordStatus="demo"`);
    }
    if (origin === "published" && (r.isDemo || r.recordStatus === "demo")) {
      errors.push(`${label(kind, slug)} demo record placed in the publishable set`);
    }
  }

  for (const ride of content.rides) {
    for (const spec of ride.specs) {
      if (spec.verification.status === "verified") {
        if (origin === "demo") errors.push(`${label("ride", ride.slug)} demo spec "${spec.label}" claims verified`);
        if (!spec.verification.source) errors.push(`${label("ride", ride.slug)} verified spec "${spec.label}" has no source`);
        if (spec.value === null) errors.push(`${label("ride", ride.slug)} verified spec "${spec.label}" has no value`);
      }
    }
    if (ride.estimate) {
      if (ride.estimate.lowUsd <= 0 || ride.estimate.highUsd < ride.estimate.lowUsd) {
        errors.push(`${label("ride", ride.slug)} estimate range is invalid`);
      }
      if (origin === "published" && ride.estimate.isDemoValue) {
        errors.push(`${label("ride", ride.slug)} publishable ride uses a demo estimate`);
      }
    }
    if (origin === "published" && ride.images.some((i) => i.license === "dev-placeholder")) {
      errors.push(`${label("ride", ride.slug)} publishable ride uses development placeholder images`);
    }
    if (!content.categories.some((c) => c.slug === ride.categorySlug)) {
      errors.push(`${label("ride", ride.slug)} references unknown category ${ride.categorySlug}`);
    }
  }

  if (origin === "demo" && content.coverage.length > 0) {
    errors.push(`demo content must not contain verified coverage records`);
  }
  for (const c of content.coverage) {
    if (c.verification.status !== "verified" || !c.verification.source) {
      errors.push(`${origin}:coverage:${c.rideSlug}@${c.citySlug} lacks a verified source`);
    }
  }

  return errors;
}
