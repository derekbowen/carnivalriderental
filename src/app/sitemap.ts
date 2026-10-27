import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/catalog/source";
import { canonicalUrl } from "@/lib/seo/routes";
import { sitemapRoutes } from "@/lib/seo/sitemap-routes";

export const revalidate = 600;

/**
 * Only routes that pass every publication gate: the same gate objects decide each page's robots
 * metadata and canonical, so the sitemap can't disagree with the pages. Empty in development by
 * design. No lastmod: the pages change with the inventory snapshot, and a build or export timestamp
 * stamped on every URL would say nothing true about any one page.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const snap = await getCatalog();
  const urls = sitemapRoutes(snap)
    .filter((r) => r.gate.indexable)
    .map((r) => canonicalUrl(r.path));
  return [...new Set(urls)].map((url) => ({ url }));
}
