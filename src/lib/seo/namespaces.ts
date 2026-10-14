import { getContent } from "../content";
import { OCCASIONS, US_STATES } from "../taxonomy";

/** Top-level path segments owned by fixed routes. A state slug may never equal one of these. */
export const RESERVED_TOP_LEVEL = ["rides", "categories", "events", "operators", "request", "requests", "internal", "api", "preview", "sitemap.xml", "robots.txt", "favicon.ico", "placeholders", "_next"];

/**
 * /{state}/{x} serves both cities and occasions, so their slugs must never overlap,
 * and states must not shadow fixed routes. Returns problems; empty = safe.
 */
export function checkSlugNamespaces(citySlugs: string[] = getContent().locations.map((l) => l.citySlug)): string[] {
  const errs: string[] = [];
  const occasionIds = new Set(OCCASIONS.map((o) => o.id));
  for (const c of new Set(citySlugs)) if (occasionIds.has(c)) errs.push(`city slug "${c}" collides with occasion id`);
  for (const s of US_STATES) if (RESERVED_TOP_LEVEL.includes(s.slug)) errs.push(`state slug "${s.slug}" collides with a fixed route`);
  return errs;
}

export function assertSlugNamespaces() {
  const errs = checkSlugNamespaces();
  if (errs.length) throw new Error(`URL namespace collision:\n- ${errs.join("\n- ")}`);
}
