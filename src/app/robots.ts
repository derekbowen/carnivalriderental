import type { MetadataRoute } from "next";
import { publicIndexingEnabled } from "@/lib/config";
import { canonicalUrl } from "@/lib/seo/routes";

export default function robots(): MetadataRoute.Robots {
  if (!publicIndexingEnabled()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    // /connect (the public request form) stays crawlable so crawlers can read its noindex; robots.txt is
    // not access control. Its private result pages (/connect/{id}), passes, APIs and the internal
    // console stay disallowed AND are noindex, no-store and entitlement- or auth-checked on their own.
    rules: [{ userAgent: "*", allow: "/", disallow: ["/internal", "/api", "/requests", "/request", "/connect/", "/pass"] }],
    sitemap: canonicalUrl("/sitemap.xml"),
  };
}
