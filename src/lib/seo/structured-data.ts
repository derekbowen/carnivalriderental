import type { CatalogRecord } from "../catalog/normalize";
import { BRAND, siteUrl } from "../config";
import type { Faq } from "../taxonomy";
import { canonicalUrl } from "./routes";

/**
 * schema.org JSON-LD builders. Rules:
 * - Markup describes only what is visible on the page.
 * - No AggregateRating/Review (we have none), no Offer prices (quotes are per event), no
 *   claims of availability: offerings are a managed sourcing service.
 */
type Json = Record<string, unknown>;

const org = (): Json => ({
  "@type": "Organization",
  name: BRAND.name,
  legalName: BRAND.legalEntity,
  url: siteUrl(),
});

export function breadcrumbs(items: { name: string; path: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: canonicalUrl(it.path) })),
  };
}

export function rentalService(opts: { name: string; description: string; path: string; areaServed?: { type: "State" | "Country"; name: string }; serviceType?: string }): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: opts.name,
    description: opts.description,
    serviceType: opts.serviceType ?? "Carnival ride rental",
    url: canonicalUrl(opts.path),
    provider: org(),
    areaServed: opts.areaServed
      ? { "@type": opts.areaServed.type, name: opts.areaServed.name }
      : { "@type": "Country", name: "United States" },
  };
}

/** The live offerings listed on the page, in display order. */
export function offeringList(name: string, records: CatalogRecord[], urlFor: (r: CatalogRecord) => string): Json {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: records.length,
    itemListElement: records.map((r, i) => ({ "@type": "ListItem", position: i + 1, name: r.title, url: canonicalUrl(urlFor(r)) })),
  };
}

export function faqPage(faq: Faq[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

/** Safe serialisation for a <script> tag (no "</script>" breakout). */
export function serializeJsonLd(data: Json | Json[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
