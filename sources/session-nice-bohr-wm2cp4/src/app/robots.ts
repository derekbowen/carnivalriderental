import type { MetadataRoute } from "next";
import { publicIndexingEnabled } from "@/lib/config";
import { canonicalUrl } from "@/lib/seo/routes";

export default function robots(): MetadataRoute.Robots {
  if (!publicIndexingEnabled()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/internal", "/api", "/requests", "/request"] }],
    sitemap: canonicalUrl("/sitemap.xml"),
  };
}
