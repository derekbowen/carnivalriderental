import type { CatalogRecord } from "../catalog/normalize";
import type { CatalogSnapshot } from "../catalog/source";
import { publicIndexingEnabled } from "../config";
import { CATEGORY_PAGES, type CategoryPage } from "../content/category-pages";
import { OCCASIONS, US_STATES, type Occasion, type UsState } from "../taxonomy";
import type { GateResult } from "./publication";
import { paths } from "./routes";

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

function common(snap: CatalogSnapshot): string[] {
  const reasons: string[] = [];
  if (!publicIndexingEnabled()) reasons.push("public indexing disabled in this environment");
  if (snap.source !== "sharetribe-marketplace-api") reasons.push(`supply source is ${snap.source}, not the live catalog`);
  return reasons;
}

const result = (reasons: string[]): GateResult => ({ indexable: reasons.length === 0, reasons: [...new Set(reasons)] });

export function stateGate(state: UsState, snap: CatalogSnapshot): GateResult {
  const reasons = common(snap);
  const n = countable(snap, { stateCode: state.code });
  if (n < PSEO_THRESHOLDS.stateMinOfferings) reasons.push(`${n} live offerings accept requests in ${state.abbr} (need ${PSEO_THRESHOLDS.stateMinOfferings})`);
  return result(reasons);
}

export function occasionGate(o: Occasion, snap: CatalogSnapshot): GateResult {
  const reasons = common(snap);
  if (o.reviewStatus !== "approved") reasons.push("occasion copy not approved");
  const n = countable(snap, { categories: o.suggestedCategories });
  if (n < PSEO_THRESHOLDS.occasionMinOfferings) reasons.push(`${n} live offerings in suggested categories (need ${PSEO_THRESHOLDS.occasionMinOfferings})`);
  return result(reasons);
}

export function occasionStateGate(o: Occasion, state: UsState, snap: CatalogSnapshot): GateResult {
  const reasons = common(snap);
  if (!occasionGate(o, snap).indexable) reasons.push("parent occasion page not indexable");
  if (!stateGate(state, snap).indexable) reasons.push("parent state page not indexable");
  const n = countable(snap, { stateCode: state.code, categories: o.suggestedCategories });
  if (n < PSEO_THRESHOLDS.occasionStateMinOfferings) reasons.push(`${n} live suggested offerings accept requests in ${state.abbr} (need ${PSEO_THRESHOLDS.occasionStateMinOfferings})`);
  return result(reasons);
}

/** Category hub (/categories/{id}): approved copy + enough real supply. Visual theme plays no part. */
export function categoryHubGate(page: CategoryPage, snap: CatalogSnapshot): GateResult {
  const reasons = common(snap);
  if (page.reviewStatus !== "approved") reasons.push("category copy not approved");
  const n = countable(snap, { categories: [page.id] });
  if (n < PSEO_THRESHOLDS.categoryMinOfferings) reasons.push(`${n} live offerings in ${page.id} (need ${PSEO_THRESHOLDS.categoryMinOfferings})`);
  return result(reasons);
}

/** Every catalog-driven route with its gate (5 category hubs + 51 + 75 + 75×51 today). */
export function pseoRoutes(snap: CatalogSnapshot): { path: string; family: string; gate: GateResult }[] {
  const out: { path: string; family: string; gate: GateResult }[] = [];
  for (const c of CATEGORY_PAGES) out.push({ path: paths.category(c.id), family: "category", gate: categoryHubGate(c, snap) });
  for (const s of US_STATES) out.push({ path: paths.state(s.slug), family: "state", gate: stateGate(s, snap) });
  for (const o of OCCASIONS) out.push({ path: paths.occasion(o.id), family: "occasion", gate: occasionGate(o, snap) });
  for (const o of OCCASIONS)
    for (const s of US_STATES) out.push({ path: paths.occasionState(o.id, s.slug), family: "occasion-state", gate: occasionStateGate(o, s, snap) });
  return out;
}
