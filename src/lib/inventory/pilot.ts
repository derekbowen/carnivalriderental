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

/**
 * Wave 3 (2026-10-24): pages people already reach from Google, from the Search Console review of that
 * day. Event pages and buyer guides are their own families, outside the 1,000-URL city / ride + city
 * set above. Each event page still passes its supply gate on every build (occasionGate); guides have
 * no supply gate (guideGate).
 */
export const WAVE_3 = {
  authorization:
    'Founder instruction, 2026-10-24, after the Search Console review ("Open wedding pages", "Ferris wheel content + guides"): ' +
    "open the wedding page and the event pages matching searches the site already appears for, and the buyer guides.",
  contentReview: "Automated checks (tests, the release crawl); NOT reviewed page by page by the founder.",
  // Searches seen: "rent ferris wheel for wedding", "private party ferris wheel rental", "train rental for birthday party",
  // "ferris wheel rental for corporate events".
  eventPaths: ["/events/weddings", "/events/birthday-parties", "/events/backyard-parties", "/events/company-picnics"],
  guidePaths: ["/guides/how-to-rent-carnival-rides", "/guides/ride-owner-vs-rental-broker", "/guides/ferris-wheel-rental-cost", "/guides/ferris-wheel-wedding-rental"],
} as const;

const ALLOWED = new Set([...PSEO_PILOT.paths, ...PSEO_PILOT.corePaths, ...WAVE_3.eventPaths, ...WAVE_3.guidePaths]);

export function inPilot(path: string): boolean {
  return PSEO_PILOT.enabled && ALLOWED.has(path);
}

/**
 * Open indexing (2026-10-27): every public page is approved for indexing, not only the waves above,
 * and near-duplicate city pages are no longer held back. It replaces copy approval, the allowlists
 * and the near-duplicate gate, nothing else: public indexing must still be on for the environment,
 * each page must still meet its supply floor (thin pages stay noindex), and private pages (connect,
 * pass, internal, API, search results, previews) stay noindex whatever this says.
 * Rollback: set `enabled` to false and redeploy; the waves above apply again.
 */
export const OPEN_INDEXING = {
  enabled: true,
  authorization:
    'Founder instruction, 2026-10-27, after the Search Console overview (412 indexed, 4,417 not indexed): "unleash it, undo all no index".',
  contentReview: "Automated checks (tests, privacy guards, the release crawl); NOT reviewed page by page by the founder.",
} as const;

/** The approval part of every page gate: open indexing, or the exact path in an approved wave. */
export function approvedForIndexing(path: string): boolean {
  return OPEN_INDEXING.enabled || inPilot(path);
}
