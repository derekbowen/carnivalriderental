import type { MetadataRoute } from "next";
import { buildSitemap } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  return buildSitemap().map((url) => ({ url }));
}
