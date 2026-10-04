import type { Metadata, Viewport } from "next";
import { EnvBanner, SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { BRAND, publicIndexingEnabled, siteUrl } from "@/lib/config";
import "./globals.css";

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: `${BRAND.name} — carnival ride rentals for events`, template: `%s` },
    description: "Request a carnival ride for your event. We source the ride and operating crew and manage the booking.",
    // Default for every page; page-level gates can only tighten this, never open it outside production.
    robots: publicIndexingEnabled() ? undefined : { index: false, follow: false },
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
      </body>
    </html>
  );
}
