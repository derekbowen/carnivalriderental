import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import type { ListingCardModel } from "@/lib/catalog/card";
import type { CatalogSnapshot } from "@/lib/catalog/source";
import { graph, serializeJsonLd, type Json } from "@/lib/seo/structured-data";
import type { Faq } from "@/lib/taxonomy";
import { ListingCard } from "./ListingCard";

/** Shared building blocks for the taxonomy-driven page families (state, occasion, occasion + state). */

/** One connected @graph per page (Organization node added automatically). */
export function JsonLd({ nodes }: { nodes: Json[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(graph(nodes)) }} />;
}

export function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((it, i) => (
          <li key={it.path} className="flex items-center gap-1">
            {i > 0 && <ChevronRightIcon className="h-3.5 w-3.5" aria-hidden="true" />}
            {i === items.length - 1 ? <span aria-current="page">{it.name}</span> : <Link href={it.path} className="hover:underline">{it.name}</Link>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export { categoryLabel } from "@/lib/catalog/card";

/**
 * Supply grid: the shared ListingCard for every card. Nothing here is invented — an empty list says so.
 * Availability is confirmed by the operator; nothing here is a booking.
 */
export function SupplyList({ cards, emptyText, requestHref }: { cards: ListingCardModel[]; emptyText: string; requestHref: string }) {
  if (cards.length === 0) {
    return (
      <div data-testid="supply-empty" className="card p-6 text-sm text-ink-soft">
        <p>{emptyText}</p>
        <Link href={requestHref} className="mt-3 inline-block font-semibold text-accent-strong hover:underline">Connect with operators anyway →</Link>
      </div>
    );
  }
  return (
    <ul data-testid="supply-list" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => <li key={c.key}><ListingCard card={c} /></li>)}
    </ul>
  );
}

export function SupplySource({ snap }: { snap: CatalogSnapshot }) {
  if (snap.source === "sharetribe-marketplace-api") return null;
  return (
    <p data-testid="supply-source" className="mt-3 text-xs text-muted">
      Development note — supply source: <strong>{snap.source}</strong>
      {snap.error ? ` (${snap.error})` : ""}. This page cannot be indexed until live listings exist.
    </p>
  );
}

export function FaqSection({ faq }: { faq: Faq[] }) {
  return (
    <section className="mt-12">
      <h2 className="text-2xl">Frequently asked questions</h2>
      <dl className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
        {faq.map((f) => (
          <div key={f.q} className="p-5">
            <dt className="font-semibold">{f.q}</dt>
            <dd className="mt-1 text-sm text-ink-soft">{f.a}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function LinkGrid({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  if (links.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="text-2xl">{title}</h2>
      <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <li key={l.href}><Link href={l.href} className="text-accent-strong hover:underline">{l.label}</Link></li>
        ))}
      </ul>
    </section>
  );
}
