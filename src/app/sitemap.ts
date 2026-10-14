import type { MetadataRoute } from "next";
import { getCatalog } from "@/lib/catalog/source";
import { pseoRoutes } from "@/lib/seo/pseo";
import { allSeoRoutes } from "@/lib/seo/publication";
import { canonicalUrl } from "@/lib/seo/routes";
import { directoryRoutes, inventoryRoutes } from "@/lib/inventory";

export const revalidate = 600;

/** Only routes that pass every publication gate. Empty in development by design. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const snap = await getCatalog();
  return [...allSeoRoutes(), ...pseoRoutes(snap), ...inventoryRoutes(), ...directoryRoutes()]
    .filter((r) => r.gate.indexable)
    .map((r) => ({ url: canonicalUrl(r.path) }));
}
