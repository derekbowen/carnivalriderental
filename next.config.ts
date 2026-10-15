import type { NextConfig } from "next";
import { withBotId } from "botid/next/config";

/**
 * Security headers on every response (scan 2026-10-15, docs/SECURITY_SCAN_2026-10-15.md). Only the
 * ones that cannot break the site: framing, MIME sniffing, referrer leakage and unused browser
 * features. A script/style Content-Security-Policy needs nonces and a report-only rollout first.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // frame-ancestors: clickjacking. base-uri: an injected <base> cannot redirect relative URLs (it does not
  // inherit from default-src). object-src: no plugins. None of these touch scripts, styles or images.
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // node:sqlite is a Node built-in used only by server code (development store).
  serverExternalPackages: [],
  poweredByHeader: false,
  trailingSlash: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
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

// Vercel BotID: proxies its challenge scripts through our domain so blockers don't break it (src/lib/access/bot.ts).
export default withBotId(nextConfig);
