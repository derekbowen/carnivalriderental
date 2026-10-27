import type { CatalogSnapshot } from "../catalog/source";
import { coreRoutes, directoryRoutes, inventoryRoutes, listingRoutes } from "../inventory";
import { pseoRoutes, sitePageRoutes } from "./pseo";
import { allSeoRoutes } from "./publication";

/**
 * Every public page family with its gate. The sitemap lists the indexable ones and IndexNow submits
 * the same list, so the two can't disagree. Private pages (connect, pass, internal, API, search
 * results, previews) are never in it.
 */
export function sitemapRoutes(snap: CatalogSnapshot): { path: string; family: string; gate: { indexable: boolean; reasons: string[] } }[] {
  return [...coreRoutes(), ...allSeoRoutes(), ...pseoRoutes(snap), ...inventoryRoutes(), ...directoryRoutes(), ...listingRoutes(), ...sitePageRoutes()];
}
