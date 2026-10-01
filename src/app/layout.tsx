import type { Metadata } from "next";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas">
        <EnvBanner />
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
