import type { CatalogRecord } from "../catalog/normalize";
import type { CatalogSnapshot } from "../catalog/source";
import { publicIndexingEnabled } from "../config";
import { CATEGORY_PAGES, type CategoryPage } from "../content/category-pages";
import { GUIDES } from "../content/guides";
import { OCCASIONS, US_STATES, type Occasion, type UsState } from "../taxonomy";
import type { GateResult } from "./publication";
import { paths } from "./routes";
import { categoryInventoryCount, ridesNear, rideTypesInCategory, stateInventoryCount } from "../inventory";
import { approvedForIndexing } from "../inventory/pilot";
import { STATE_CENTERS } from "../taxonomy/state-centers";

/**
 * Gates for the taxonomy-driven page families (state hub, occasion hub, occasion + state).
 *
 * These pages exist for every combination, but a page is INDEXABLE only when it carries real,
 * live supply from the Sharetribe catalog. Test samples never count. Thresholds are deliberate:
 * a page whose only difference from its siblings is a swapped place or occasion name is a
 * doorway page, which search engines demote — and can demote the whole site for.
 */
export const PSEO_THRESHOLDS = {
  /** Live (non-test) offerings that accept requests in the state. */
  stateMinOfferings: 3,
  /** Live offerings in the occasion's suggested categories (any state). */
  occasionMinOfferings: 3,
  /** Live offerings in the occasion's suggested categories that accept requests in the state. */
  occasionStateMinOfferings: 3,
  /** Live (non-test) offerings in the category. Theme or copy alone never qualifies a hub. */
  categoryMinOfferings: 3,
} as const;

export interface SupplyFilter {
  stateCode?: string;
  categories?: string[];
}

/** Offerings to SHOW (test samples included, they are labelled). Never filled in. */
export function supplyFor(snap: CatalogSnapshot, f: SupplyFilter = {}): CatalogRecord[] {
  return snap.records.filter(
    (r) =>
      (!f.stateCode || r.requestableStates.includes(f.stateCode.toLowerCase())) &&
      (!f.categories || f.categories.includes(r.categoryId)),
  );
}

/** Offerings that COUNT toward indexability: live source, not a test sample. */
function countable(snap: CatalogSnapshot, f: SupplyFilter): number {
  if (snap.source !== "sharetribe-marketplace-api") return 0;
  return supplyFor(snap, f).filter((r) => !r.isTestSample).length;
}

function environment(): string[] {
  return publicIndexingEnabled() ? [] : ["public indexing disabled in this environment"];
}

const result = (reasons: string[]): GateResult => ({ indexable: reasons.length === 0, reasons: [...new Set(reasons)] });

/**
 * State hub (/{state}): approved for indexing (pilot.ts) + enough real supply. Supply is what the page
 * shows: operator inventory based in or serving the state (the managed catalog is retired; its live
 * offerings still count when there are any).
 */
export function stateGate(state: UsState, snap: CatalogSnapshot): GateResult {
  const reasons = environment();
  if (!approvedForIndexing(paths.state(state.slug))) reasons.push("state page not approved for indexing");
  const n = Math.max(countable(snap, { stateCode: state.code }), stateInventoryCount(state.code));
  if (n < PSEO_THRESHOLDS.stateMinOfferings) reasons.push(`${n} live offerings accept requests in ${state.abbr} (need ${PSEO_THRESHOLDS.stateMinOfferings})`);
  return result(reasons);
}

/**
 * National event page (/events/{id}): approved copy or approved for indexing (pilot.ts) + enough real
 * supply in the suggested categories. Supply is what the page shows: the
 * operator inventory of those categories (the managed catalog is retired; its live offerings still
 * count when there are any).
 */
export function occasionGate(o: Occasion, snap: CatalogSnapshot): GateResult {
  const reasons = environment();
  if (o.reviewStatus !== "approved" && !approvedForIndexing(paths.occasion(o.id))) reasons.push("occasion copy not approved");
  const n = Math.max(countable(snap, { categories: o.suggestedCategories }), o.suggestedCategories.reduce((sum, c) => sum + categoryInventoryCount(c), 0));
  if (n < PSEO_THRESHOLDS.occasionMinOfferings) reasons.push(`${n} live offerings in suggested categories (need ${PSEO_THRESHOLDS.occasionMinOfferings})`);
  return result(reasons);
}

/** Operator rides of an occasion's suggested ride types near a state's centre: the rides /{state}/{occasion} shows. */
function occasionStateInventoryCount(o: Occasion, state: UsState): number {
  const centre = STATE_CENTERS[state.code];
  if (!centre) return 0;
  const types = new Set(o.suggestedCategories.flatMap((id) => rideTypesInCategory(id).map((t) => t.id)));
  return ridesNear(centre[0], centre[1]).filter((r) => r.rideType && types.has(r.rideType)).length;
}

/** Event + state (/{state}/{occasion}): both parents indexable + enough suggested supply near the state. */
export function occasionStateGate(o: Occasion, state: UsState, snap: CatalogSnapshot): GateResult {
  const reasons = environment();
  if (!occasionGate(o, snap).indexable) reasons.push("parent occasion page not indexable");
  if (!stateGate(state, snap).indexable) reasons.push("parent state page not indexable");
  const n = Math.max(countable(snap, { stateCode: state.code, categories: o.suggestedCategories }), occasionStateInventoryCount(o, state));
  if (n < PSEO_THRESHOLDS.occasionStateMinOfferings) reasons.push(`${n} live suggested offerings accept requests in ${state.abbr} (need ${PSEO_THRESHOLDS.occasionStateMinOfferings})`);
  return result(reasons);
}

/**
 * Category hub (/categories/{id}): approved copy or approved for indexing (pilot.ts) + enough real
 * supply. Supply is what the hub shows: the operator inventory snapshot of
 * the category (the managed catalog is retired; its live offerings still count when there are any).
 * Visual theme plays no part.
 */
export function categoryHubGate(page: CategoryPage, snap: CatalogSnapshot): GateResult {
  const reasons = environment();
  if (page.reviewStatus !== "approved" && !approvedForIndexing(paths.category(page.id))) reasons.push("category copy not approved");
  const n = Math.max(countable(snap, { categories: [page.id] }), categoryInventoryCount(page.id));
  if (n < PSEO_THRESHOLDS.categoryMinOfferings) reasons.push(`${n} live offerings in ${page.id} (need ${PSEO_THRESHOLDS.categoryMinOfferings})`);
  return result(reasons);
}

/** Buyer guide (/guides/{id}): approved for indexing (pilot.ts). No supply gate. */
export function guideGate(id: string): GateResult {
  const reasons = environment();
  if (!approvedForIndexing(paths.guide(id))) reasons.push("not in the approved indexing cohort");
  return result(reasons);
}

/** Site pages with no supply of their own: the events index, legal and contact pages. */
export const SITE_PAGES: readonly string[] = [paths.occasions(), paths.terms(), paths.privacy(), paths.accessibility(), paths.accessPolicy(), paths.contact()];

export function sitePageGate(path: string): GateResult {
  const reasons = environment();
  if (!approvedForIndexing(path)) reasons.push("not approved for indexing");
  return result(reasons);
}
export const sitePageRoutes = () => SITE_PAGES.map((path) => ({ path, family: "site", gate: sitePageGate(path) }));
/** Robots for a site page: index when its gate passes; links are always followed. */
export const sitePageRobots = (path: string) => (sitePageGate(path).indexable ? { index: true, follow: true } : { index: false, follow: true });

/** Every catalog-driven route with its gate (guides, 5 category hubs, 51 states, 75 events, 75×51 events by state). */
export function pseoRoutes(snap: CatalogSnapshot): { path: string; family: string; gate: GateResult }[] {
  const out: { path: string; family: string; gate: GateResult }[] = [];
  for (const g of GUIDES) out.push({ path: paths.guide(g.id), family: "guide", gate: guideGate(g.id) });
  for (const c of CATEGORY_PAGES) out.push({ path: paths.category(c.id), family: "category", gate: categoryHubGate(c, snap) });
  for (const s of US_STATES) out.push({ path: paths.state(s.slug), family: "state", gate: stateGate(s, snap) });
  for (const o of OCCASIONS) out.push({ path: paths.occasion(o.id), family: "occasion", gate: occasionGate(o, snap) });
  for (const o of OCCASIONS)
    for (const s of US_STATES) out.push({ path: paths.occasionState(o.id, s.slug), family: "occasion-state", gate: occasionStateGate(o, s, snap) });
  return out;
}
