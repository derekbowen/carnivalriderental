import type { ListingCardModel } from "../catalog/card";
import { BRAND, siteUrl } from "../config";
import type { Faq } from "../taxonomy";
import { canonicalUrl } from "./routes";

/**
 * schema.org JSON-LD as ONE connected @graph per page. Rules:
 * - Markup describes only what is visible on the page, in the same order.
 * - Stable @id references: `{site}/#organization`, `{page}#webpage|#breadcrumb|#itemlist|#service|#faq`.
 * - No AggregateRating/Review (we have none), no Offer/price (indicative estimates are not offers;
 *   quotes are per event), no availability claims, no addresses, no Event markup for event types.
 * - Demo/test cards are filtered out for production by the caller (structuredDataCards).
 */
export type Json = Record<string, unknown>;

export const ids = {
  organization: () => `${siteUrl()}/#organization`,
  page: (path: string) => `${canonicalUrl(path)}#webpage`,
  breadcrumb: (path: string) => `${canonicalUrl(path)}#breadcrumb`,
  itemList: (path: string) => `${canonicalUrl(path)}#itemlist`,
  service: (path: string) => `${canonicalUrl(path)}#service`,
  faq: (path: string) => `${canonicalUrl(path)}#faq`,
};
const ref = (id: string) => ({ "@id": id });

export function organizationNode(): Json {
  return { "@type": "Organization", "@id": ids.organization(), name: BRAND.name, legalName: BRAND.legalEntity, url: siteUrl() };
}

/** Breadcrumbs exactly as rendered; the last item is the current page. */
export function breadcrumbs(items: { name: string; path: string }[]): Json {
  const current = items[items.length - 1].path;
  return {
    "@type": "BreadcrumbList",
    "@id": ids.breadcrumb(current),
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: canonicalUrl(it.path) })),
  };
}

/** The page itself. `type` CollectionPage for hubs that list offerings. */
export function webPage(opts: { path: string; name: string; description: string; type?: "CollectionPage" | "WebPage"; hasItemList?: boolean; hasService?: boolean }): Json {
  return {
    "@type": opts.type ?? "CollectionPage",
    "@id": ids.page(opts.path),
    url: canonicalUrl(opts.path),
    name: opts.name,
    description: opts.description,
    inLanguage: "en-US",
    publisher: ref(ids.organization()),
    breadcrumb: ref(ids.breadcrumb(opts.path)),
    ...(opts.hasItemList ? { mainEntity: ref(ids.itemList(opts.path)) } : {}),
    ...(opts.hasService ? { about: ref(ids.service(opts.path)) } : {}),
  };
}

/** The real service: we source a ride and operating crew per event and quote it. */
export function rentalService(opts: { path: string; name: string; description: string; areaServed?: { type: "State" | "Country"; name: string }; serviceType?: string }): Json {
  return {
    "@type": "Service",
    "@id": ids.service(opts.path),
    name: opts.name,
    description: opts.description,
    serviceType: opts.serviceType ?? "Carnival ride rental",
    url: canonicalUrl(opts.path),
    provider: ref(ids.organization()),
    areaServed: opts.areaServed ? { "@type": opts.areaServed.type, name: opts.areaServed.name } : { "@type": "Country", name: "United States" },
  };
}

/** The listings shown on the page, same order, same names, same detail URLs (omitted when no link is shown). */
export function itemList(opts: { path: string; name: string; cards: ListingCardModel[] }): Json {
  return {
    "@type": "ItemList",
    "@id": ids.itemList(opts.path),
    name: opts.name,
    numberOfItems: opts.cards.length,
    itemListElement: opts.cards.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      ...(c.detail ? { url: canonicalUrl(c.detail.href) } : {}),
    })),
  };
}

/** Must mirror the visible FAQ. Valid markup; rich results are not promised. */
export function faqPage(faq: Faq[], path: string): Json {
  return {
    "@type": "FAQPage",
    "@id": ids.faq(path),
    isPartOf: ref(ids.page(path)),
    mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

/** One document per page; the Organization node is always present so every reference resolves. */
export function graph(nodes: Json[]): Json {
  return { "@context": "https://schema.org", "@graph": [organizationNode(), ...nodes] };
}

/** Safe serialisation for a <script> tag (no "</script>" breakout). */
export function serializeJsonLd(data: Json | Json[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
