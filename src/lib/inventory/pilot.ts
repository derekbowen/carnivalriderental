/**
 * Controlled indexing pilot for the inventory pSEO pages (docs/PSEO_INDEXING_PLAN.md).
 *
 * A named, exact-path allowlist that can stand in for the template-wide `copyApproved` flag on
 * these URLs only. It can never override the other gates: public indexing must be on for the
 * environment and the page must still meet its supply threshold on the current snapshot. A pilot
 * URL whose supply drops below the threshold stops being indexable on the next build.
 *
 * Wave 1 (2026-10-14): the first cohort below. Wave 2 (2026-10-14): `indexing-wave-2.json`, written by
 * `npm run migrate:live -- wave`, which only picks pages that already pass every gate. Each wave records
 * its authorization and its content review separately: the founder authorized both; the founder did
 * not review the pages.
 */
import WAVE_2 from "./indexing-wave-2.json";

/** First cohort (wave 1). Each is the head of its near-duplicate group in reports/pseo-duplicates.json. */
export const FIRST_COHORT_PATHS: readonly string[] = [
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
];
export const FIRST_COHORT_CORE_PATHS: readonly string[] = ["/", "/rides", "/categories/ferris-wheels"];

export const PSEO_PILOT = {
  enabled: true,
  authorization:
    "Founder instruction, 2026-10-14: production cutover with a controlled first indexing cohort of exactly the wave-1 paths. " +
    "Founder instruction, 2026-10-14 (\"lets index 1000 pages\"): widen to about 1,000 indexable URLs, chosen only from pages that already pass every gate (indexing-wave-2.json). " +
    "Each path must still pass its supply, duplicate-head and environment gates on every build.",
  contentReview:
    "Wave 1: rendered-page review on 2026-10-14 by the Claude Code session that ran the cutover, NOT by the founder (docs/PSEO_INDEXING_PLAN.md section 7). " +
    "Wave 2: automated rendered-page checks of every URL on the production domain, NOT a page-by-page review by the founder (section 8).",
  waves: [
    { wave: 1, paths: FIRST_COHORT_PATHS.length + FIRST_COHORT_CORE_PATHS.length },
    { wave: 2, paths: WAVE_2.paths.length + WAVE_2.categoryPaths.length, authorization: WAVE_2.authorization, contentReview: WAVE_2.contentReview, selection: WAVE_2.selection },
  ],
  /** Core hubs (exact `paths.*` outputs); each keeps its own supply gate (coreHubGate, categoryHubGate). */
  corePaths: [...FIRST_COHORT_CORE_PATHS, ...WAVE_2.categoryPaths] as readonly string[],
  /** City and ride + city paths, wave 1 first. Exact `paths.*` outputs, each a near-duplicate group head. */
  paths: [...FIRST_COHORT_PATHS, ...WAVE_2.paths] as readonly string[],
} as const;

const ALLOWED = new Set([...PSEO_PILOT.paths, ...PSEO_PILOT.corePaths]);

export function inPilot(path: string): boolean {
  return PSEO_PILOT.enabled && ALLOWED.has(path);
}
