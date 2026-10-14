import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node:sqlite is a Node built-in used only by server code (development store).
  serverExternalPackages: [],
  poweredByHeader: false,
  trailingSlash: false,
  // Local pages live directly off the domain (see src/lib/seo/routes.ts). Old prefixed URLs redirect permanently.
  async redirects() {
    return [
      { source: "/locations/:state/:city", destination: "/:state/:city", permanent: true },
      { source: "/locations/:state", destination: "/:state", permanent: true },
      { source: "/rides/:ride/:state/:city", destination: "/:state/:city/:ride", permanent: true },
      { source: "/events/:occasion/:state", destination: "/:state/:occasion", permanent: true },
      // 2026-10-06: the inquiry/request flow became Event Access. Query strings (listing=…) are preserved.
      { source: "/request", destination: "/connect", permanent: true },
    ];
  },
};

export default nextConfig;
