import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { EnvBanner, SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { appEnv, BRAND, publicIndexingEnabled, SITE_DESCRIPTION, siteUrl } from "@/lib/config";
import "./globals.css";
import { ChatWidget } from "@/components/concierge/ChatWidget";
import { SiteAnalytics } from "@/components/SiteAnalytics";
import { conciergeEnabled } from "@/lib/concierge/flags";

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: `Carnival Ride Rentals Nationwide | ${BRAND.name}`, template: `%s` },
    description: SITE_DESCRIPTION,
    applicationName: BRAND.name,
    openGraph: { type: "website", siteName: BRAND.name, locale: "en_US", url: siteUrl(), title: `Carnival Ride Rentals Nationwide | ${BRAND.name}`, description: SITE_DESCRIPTION, images: [{ url: "/brand/carnival-ride-rental-logo.png", alt: BRAND.name }] },
    twitter: { card: "summary", title: `Carnival Ride Rentals Nationwide | ${BRAND.name}`, description: SITE_DESCRIPTION, images: ["/brand/carnival-ride-rental-logo.png"] },
    // Default for every page: noindex. Only a page whose own publication gate passes (seoMetadata,
    // inventoryMetadata, coreHubGate) sets index; with indexing on, everything else stays crawlable
    // (follow) so crawlers can read its noindex.
    robots: publicIndexingEnabled() ? { index: false, follow: true } : { index: false, follow: false },
  };
}

/**
 * Mobile + app-shell ready (iOS/Android via Capacitor, see docs/MOBILE_APP.md):
 * viewport-fit=cover lets the page draw under the notch; safe-area padding lives in globals.css.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b1b3f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-dvh bg-canvas">
        <EnvBanner />
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
        <SpeedInsights />
        {/* Production only: previews and local runs are never counted (and load no third-party script). */}
        {appEnv() === "production" && <SiteAnalytics />}
        {conciergeEnabled() && <ChatWidget />}
      </body>
    </html>
  );
}
