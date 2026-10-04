// Publication gates. These decide what renders, what may be indexed and what
// goes in the sitemap. They are deliberately strict:
//   * fixtures render only when SHOW_FIXTURES=on, and are never indexable;
//   * production records render and index only once reviewed and published;
//   * nothing is indexable while SITE_INDEXING is not "on".
import { fixturesVisible, indexingEnabled } from "@/lib/site";
import type { Dataset, Publication } from "./types";

type Gated = { dataset: Dataset; publication: Publication };

export function isPublishedProduction(r: Gated): boolean {
  return (
    r.dataset === "production" &&
    r.publication.status === "published" &&
    Boolean(r.publication.reviewedBy) &&
    Boolean(r.publication.reviewedAt)
  );
}

/** May this record render on a public page at all? */
export function isRenderable(r: Gated): boolean {
  if (r.dataset === "fixture") return fixturesVisible();
  return isPublishedProduction(r);
}

/** May a page built from these records be indexed by search engines? */
export function isIndexable(...records: Gated[]): boolean {
  return indexingEnabled() && records.every(isPublishedProduction);
}

/** Sitemap inclusion: the same rule as indexability. */
export const inSitemap = isIndexable;
