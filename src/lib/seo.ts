// Metadata helpers so every public page gets a canonical built from
// src/lib/urls.ts and a robots directive from the publication gates.
import type { Metadata } from "next";
import { BRAND } from "@/lib/site";
import { absolute } from "@/lib/urls";

export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  indexable: boolean;
}): Metadata {
  const url = absolute(opts.path);
  return {
    title: `${opts.title} | ${BRAND.name}`,
    description: opts.description,
    alternates: { canonical: url },
    robots: opts.indexable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { title: opts.title, description: opts.description, url, siteName: BRAND.name, type: "website" },
  };
}

/** BreadcrumbList JSON-LD. Deliberately no Product/Offer/Review markup:
 * we do not publish prices, ratings or availability as facts. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absolute(it.path),
    })),
  };
}
