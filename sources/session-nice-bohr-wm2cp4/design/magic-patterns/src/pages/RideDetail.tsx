import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon } from 'lucide-react';
import { rides } from '../data/rides';
import { categories } from '../data/categories';
import { RideGallery } from '../components/ride-detail/RideGallery';
import { SpecsTable } from '../components/ride-detail/SpecsTable';
import { ListedUnitsPanel } from '../components/ride-detail/ListedUnitsPanel';
import { RequestPanel } from '../components/ride-detail/RequestPanel';
import { formatUSD } from '../utils/currency';

const fitStyles: Record<string, string> = {
  'Strong fit': 'bg-success-soft text-success',
  'Good fit': 'bg-accent-soft text-accent-ink',
  'Limited fit': 'bg-canvas text-ink-muted border border-line-strong'
};

export function RideDetail() {
  const { slug } = useParams();
  const ride = rides.find((r) => r.slug === slug);

  if (!ride) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-display text-4xl text-ink">Ride not found</h1>
        <p className="mt-3 text-ink-muted">This ride may have been renamed or removed.</p>
        <Link to="/rides" className="mt-6 inline-block font-medium text-ink underline underline-offset-4">
          Back to all rides
        </Link>
      </div>);

  }

  const category = categories.find((c) => c.id === ride.categoryId);

  return (
    <div className="mx-auto max-w-7xl px-6 pb-28 pt-8 lg:px-10 lg:pb-24">
      <Link to="/rides" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" /> All rides
      </Link>

      <div className="mt-6 grid gap-12 lg:grid-cols-12">
        <div className="space-y-16 lg:col-span-8">
          <div>
            <RideGallery rideName={ride.name} />
            <div className="mt-8">
              <p className="text-sm font-medium text-ink-muted">{category?.name}</p>
              <h1 className="mt-1 font-display text-5xl tracking-tight text-ink">{ride.name}</h1>
              <div className="mt-6 max-w-2xl space-y-4 text-[17px] leading-relaxed text-ink-soft">
                {ride.description.map((p) =>
                <p key={p.slice(0, 24)}>{p}</p>
                )}
              </div>
            </div>
          </div>

          <section aria-labelledby="suitability-heading">
            <h2 id="suitability-heading" className="font-display text-3xl text-ink">
              Event suitability
            </h2>
            <ul className="mt-6 divide-y divide-line border-y border-line">
              {ride.suitability.map((s) =>
              <li key={s.audience} className="grid gap-2 py-4 sm:grid-cols-[200px_110px_1fr] sm:items-center sm:gap-6">
                  <span className="font-medium text-ink">{s.audience}</span>
                  <span className={`w-fit whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${fitStyles[s.fit]}`}>
                    {s.fit}
                  </span>
                  <span className="text-sm text-ink-muted">{s.note}</span>
                </li>
              )}
            </ul>
          </section>

          <SpecsTable specs={ride.specs} />
          <ListedUnitsPanel ride={ride} />
        </div>

        <aside className="hidden lg:col-span-4 lg:block" aria-label="Request this ride">
          <div className="sticky top-24">
            <RequestPanel ride={ride} />
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-6 py-3 lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">
              {formatUSD(ride.estimateLow)} – {formatUSD(ride.estimateHigh)}
            </p>
            <p className="text-xs text-ink-muted">Planning estimate, not a quote</p>
          </div>
          <Link
            to={`/request?ride=${ride.slug}`}
            className="shrink-0 whitespace-nowrap rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover">
            
            Request this ride
          </Link>
        </div>
      </div>
    </div>);

}