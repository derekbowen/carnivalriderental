import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import type { CatalogRecord } from "@/lib/catalog/normalize";
import type { CatalogSnapshot } from "@/lib/catalog/source";
import { CONTRACT } from "@/lib/contract";
import { paths } from "@/lib/seo/routes";
import { serializeJsonLd } from "@/lib/seo/structured-data";
import type { Faq } from "@/lib/taxonomy";
import { AvailabilityBadge, DemoBadge, EstimateLabel } from "./badges";

/** Shared building blocks for the taxonomy-driven page families (state, occasion, occasion + state). */

export function JsonLd({ data }: { data: Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
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

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(CONTRACT.categories.items.map((c) => [c.id, c.label]));
export const categoryLabel = (id: string) => CATEGORY_LABEL[id] ?? id;

/** Detail page for a live catalog offering. Public ride pages read the catalog in a later step. */
export const offeringPath = (r: CatalogRecord) => paths.previewRide(r.slug);

/**
 * Live supply: offerings from the Sharetribe catalog. Nothing here is invented — an empty list says so.
 * Every offering is "sourcing on request": we confirm an operator and unit per event.
 */
export function SupplyList({ records, emptyText, requestHref }: { records: CatalogRecord[]; emptyText: string; requestHref: string }) {
  if (records.length === 0) {
    return (
      <div data-testid="supply-empty" className="card p-6 text-sm text-ink-soft">
        <p>{emptyText}</p>
        <Link href={requestHref} className="mt-3 inline-block font-semibold text-accent-strong hover:underline">Send a request anyway →</Link>
      </div>
    );
  }
  return (
    <ul data-testid="supply-list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {records.map((r) => (
        <li key={r.offerKey} className="card relative flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <AvailabilityBadge />
            {r.isTestSample && <DemoBadge label="Test sample" />}
          </div>
          <p className="text-xs font-semibold text-muted">{categoryLabel(r.categoryId)}</p>
          <h3 className="text-xl leading-tight">
            <Link href={offeringPath(r)} className="after:absolute after:inset-0 hover:underline">{r.title}</Link>
          </h3>
          <div className="mt-auto border-t border-line pt-3">
            <EstimateLabel estimate={r.pricing.mode === "indicative-range" ? { lowUsd: r.pricing.lowUsd, highUsd: r.pricing.highUsd, basis: r.pricing.basis, isDemoValue: false } : null} />
          </div>
        </li>
      ))}
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
