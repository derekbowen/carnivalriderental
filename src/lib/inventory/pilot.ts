/**
 * Controlled indexing pilot for the inventory pSEO pages (docs/PSEO_INDEXING_PLAN.md).
 *
 * A named, exact-path allowlist that can stand in for the template-wide `copyApproved` flag on
 * these URLs only. It can never override the other gates: public indexing must be on for the
 * environment and the page must still meet its supply threshold on the current snapshot. A pilot
 * URL whose supply drops below the threshold stops being indexable on the next build.
 *
 * DISABLED. Enabling it is a founder decision, separate from payment readiness.
 */
export const PSEO_PILOT = {
  enabled: false,
  /** Reviewed by: (founder name + date when approved). Paths must be exact `paths.*` outputs. */
  // Each is the head of its near-duplicate group in reports/pseo-duplicates.json (npm run pseo:duplicates);
  // no two pilot pages show substantially the same listings.
  paths: [
    "/ohio/columbus",
    "/ohio/columbus/ferris-wheel",
    "/texas/austin",
    "/texas/austin/carousel",
    "/illinois/chicago",
    "/illinois/chicago/ferris-wheel",
    "/florida/orlando",
    "/georgia/atlanta",
    "/minnesota/minneapolis",
    "/washington/seattle",
  ] as readonly string[],
} as const;

export function inPilot(path: string): boolean {
  return PSEO_PILOT.enabled && PSEO_PILOT.paths.includes(path);
}
