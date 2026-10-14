import type { ListingCardModel } from "../catalog/card";
import { BRAND, siteUrl } from "../config";
import type { Faq } from "../taxonomy";
import { canonicalUrl, paths } from "./routes";

/**
 * schema.org JSON-LD as ONE connected @graph per page. Rules:
 * - Markup describes only what is visible on the page, in the same order.
 * - Stable @id references: `{site}/#organization`, `{page}#webpage|#breadcrumb|#itemlist|#service|#faq`.
 * - No AggregateRating/Review (we have none), no Offer/price for rentals (operators price per event),
 *   no availability claims, no addresses, no Event markup for event types. The only Offer on the site
 *   is Event Access itself, on /connect/{id}, where its price is visible.
 * - Demo/test cards are filtered out for production by the caller (structuredDataCards).
 */
export type Json = Record<string, unknown>;

export const ids = {
  organization: () => `${siteUrl()}/#organization`,
  website: () => `${siteUrl()}/#website`,
  /** The operator-side offer (list your rides). One node, referenced from every page. */
  operatorProgram: () => `${canonicalUrl(paths.operators())}#service`,
  page: (path: string) => `${canonicalUrl(path)}#webpage`,
  breadcrumb: (path: string) => `${canonicalUrl(path)}#breadcrumb`,
  itemList: (path: string) => `${canonicalUrl(path)}#itemlist`,
  service: (path: string) => `${canonicalUrl(path)}#service`,
  faq: (path: string) => `${canonicalUrl(path)}#faq`,
};
const ref = (id: string) => ({ "@id": id });

export function organizationNode(): Json {
  return {
    "@type": "Organization",
    "@id": ids.organization(),
    name: BRAND.name,
    legalName: BRAND.legalEntity,
    url: siteUrl(),
    areaServed: { "@type": "Country", name: "United States" },
  };
}

export function websiteNode(): Json {
  return { "@type": "WebSite", "@id": ids.website(), url: siteUrl(), name: BRAND.name, inLanguage: "en-US", publisher: ref(ids.organization()) };
}

/**
 * Operator side, kept deliberately small: the marketplace listing service for ride owners.
 * Visible on every page via the footer "Own a carnival ride?" strip, so it may appear in every graph.
 */
export function operatorProgramNode(): Json {
  return {
    "@type": "Service",
    "@id": ids.operatorProgram(),
    name: "List your carnival rides free",
    serviceType: "Free inventory listing for carnival ride operators",
    url: canonicalUrl(paths.operators()),
    provider: ref(ids.organization()),
    areaServed: { "@type": "Country", name: "United States" },
    audience: { "@type": "BusinessAudience", audienceType: "Carnival ride owners and operators" },
  };
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
export type PageType = "CollectionPage" | "WebPage" | "ItemPage";

export function webPage(opts: { path: string; name: string; description: string; type?: PageType; hasItemList?: boolean; hasService?: boolean; hasBreadcrumb?: boolean }): Json {
  return {
    "@type": opts.type ?? "CollectionPage",
    "@id": ids.page(opts.path),
    url: canonicalUrl(opts.path),
    name: opts.name,
    description: opts.description,
    inLanguage: "en-US",
    isPartOf: ref(ids.website()),
    publisher: ref(ids.organization()),
    ...(opts.hasBreadcrumb === false ? {} : { breadcrumb: ref(ids.breadcrumb(opts.path)) }),
    ...(opts.hasItemList ? { mainEntity: ref(ids.itemList(opts.path)) } : {}),
    ...(opts.hasService ? { about: ref(ids.service(opts.path)) } : {}),
    // The operator-side offer shown in the footer strip on every page.
    mentions: ref(ids.operatorProgram()),
  };
}

export type AreaServed = { type: "Country" | "State" | "City"; name: string };

/**
 * Customer side: what Carnival Ride Rental itself provides. We are not the ride operator and we do
 * not rent rides: we index operator inventory and sell contact access (Event Access). No Offer or
 * price for rentals, no availability, no ratings.
 */
export function rentalService(opts: { path: string; name: string; description: string; areaServed?: AreaServed; serviceType?: string }): Json {
  return {
    "@type": "Service",
    "@id": ids.service(opts.path),
    name: opts.name,
    description: opts.description,
    serviceType: opts.serviceType ?? "Carnival ride operator discovery and contact access",
    category: "Event equipment directory",
    url: canonicalUrl(opts.path),
    provider: ref(ids.organization()),
    areaServed: opts.areaServed ? { "@type": opts.areaServed.type, name: opts.areaServed.name } : { "@type": "Country", name: "United States" },
    audience: { "@type": "Audience", audienceType: "Event organizers" },
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

/**
 * The ONE way a page builds its structured data. Every public template calls this, so every page
 * carries the same skeleton: WebPage (typed) → BreadcrumbList (only when breadcrumbs are visible)
 * → customer Service → ItemList (only the cards shown) → FAQPage (only visible FAQs).
 */
export function pageGraph(opts: {
  path: string;
  name: string;
  description: string;
  type?: PageType;
  /** Exactly the visible breadcrumbs; omit when the page shows none. */
  crumbs?: { name: string; path: string }[];
  service?: { name?: string; serviceType?: string; areaServed?: AreaServed };
  list?: { name: string; cards: ListingCardModel[] };
  faq?: Faq[];
}): Json[] {
  const hasList = !!opts.list && opts.list.cards.length > 0;
  return [
    webPage({ path: opts.path, name: opts.name, description: opts.description, type: opts.type, hasItemList: hasList, hasService: !!opts.service, hasBreadcrumb: !!opts.crumbs }),
    ...(opts.crumbs ? [breadcrumbs(opts.crumbs)] : []),
    ...(opts.service
      ? [rentalService({ path: opts.path, name: opts.service.name ?? opts.name, description: opts.description, serviceType: opts.service.serviceType, areaServed: opts.service.areaServed })]
      : []),
    ...(hasList ? [itemList({ path: opts.path, name: opts.list!.name, cards: opts.list!.cards })] : []),
    ...(opts.faq && opts.faq.length ? [faqPage(opts.faq, opts.path)] : []),
  ];
}

/** One document per page. Site-wide nodes are always present so every @id reference resolves. */
export function graph(nodes: Json[]): Json {
  return { "@context": "https://schema.org", "@graph": [organizationNode(), websiteNode(), operatorProgramNode(), ...nodes] };
}

/** Safe serialisation for a <script> tag (no "</script>" breakout). */
export function serializeJsonLd(data: Json | Json[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
