import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { BRAND, indexingEnabled } from "@/lib/site";

// Typefaces from the Magic Patterns design, self-hosted by next/font at build time.
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.tagline,
  // Second safeguard: development and preview builds are never indexable.
  robots: indexingEnabled() ? undefined : { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen font-sans">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
