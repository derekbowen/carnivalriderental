import type { MetadataRoute } from "next";
import { allSeoRoutes } from "@/lib/seo/publication";
import { canonicalUrl } from "@/lib/seo/routes";

/** Only routes that pass every publication gate. Empty in development by design. */
export default function sitemap(): MetadataRoute.Sitemap {
  return allSeoRoutes()
    .filter((r) => r.gate.indexable)
    .map((r) => ({ url: canonicalUrl(r.path) }));
}
