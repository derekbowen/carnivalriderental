import type { MetadataRoute } from "next";
import { indexingEnabled } from "@/lib/site";
import { absolute } from "@/lib/urls";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (!indexingEnabled()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/internal", "/api", "/requests", "/request"] }],
    sitemap: absolute("/sitemap.xml"),
  };
}
