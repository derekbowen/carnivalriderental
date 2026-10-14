/**
 * Controlled indexing pilot for the inventory pSEO pages (docs/PSEO_INDEXING_PLAN.md).
 *
 * A named, exact-path allowlist that can stand in for the template-wide `copyApproved` flag on
 * these URLs only. It can never override the other gates: public indexing must be on for the
 * environment and the page must still meet its supply threshold on the current snapshot. A pilot
 * URL whose supply drops below the threshold stops being indexable on the next build.
 *
 * ENABLED 2026-10-14 for the first indexing cohort. The authorization and the content review are
 * recorded separately below: the founder authorized the cohort; the founder did not review the pages.
 */
export const PSEO_PILOT = {
  enabled: true,
  authorization: "Founder instruction, 2026-10-14: production cutover with a controlled first indexing cohort of exactly these paths (each must still pass its supply, duplicate-head and environment gates).",
  contentReview: "Rendered-page review on 2026-10-14 by the Claude Code session that ran the cutover, NOT by the founder: docs/PSEO_INDEXING_PLAN.md section 7 records what was checked and the result per URL.",
  /** Core hubs in the cohort (exact `paths.*` outputs); each keeps its own supply gate (coreHubGate, categoryHubGate). */
  corePaths: ["/", "/rides", "/categories/ferris-wheels"] as readonly string[],
  /** Paths must be exact `paths.*` outputs. */
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
  return PSEO_PILOT.enabled && (PSEO_PILOT.paths.includes(path) || (PSEO_PILOT.corePaths ?? []).includes(path));
}
