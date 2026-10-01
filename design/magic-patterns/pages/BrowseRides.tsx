import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SlidersHorizontalIcon, XIcon } from 'lucide-react';
import { FilterPanel } from '../components/rides/FilterPanel';
import { RideCard } from '../components/rides/RideCard';
import { rides } from '../data/rides';
import { categories } from '../data/categories';
import { countActiveFilters, emptyFilters, filterRides } from '../utils/rideFilters';
import type { RideFilters } from '../utils/rideFilters';

export function BrowseRides() {
  const [params] = useSearchParams();
  const initialCategory = params.get('category');
  const [filters, setFilters] = useState<RideFilters>({
    ...emptyFilters,
    category: categories.some((c) => c.id === initialCategory) ? (initialCategory as string) : 'all',
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const results = useMemo(() => filterRides(rides, filters), [filters]);
  const activeCount = countActiveFilters(filters);
  const reset = () => setFilters(emptyFilters);

  return (
    <div className="bg-ivory">
      <section className="border-b border-line">
        <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:py-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-deep">Browse rides</p>
          <div className="mt-4 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <h1 className="max-w-2xl font-display text-4xl leading-tight sm:text-5xl">Carnival rides we source for events</h1>
            <p className="max-w-md text-sm leading-relaxed text-muted">
              Every ride is sourced for your date from independent operators. Ranges below are estimates — your written
              quote confirms the final scope and price.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-12 lg:py-14">
        <aside className="hidden lg:col-span-3 lg:block" aria-label="Filters">
          <div className="sticky top-24">
            <FilterPanel filters={filters} onChange={setFilters} onReset={reset} activeCount={activeCount} />
          </div>
        </aside>

        <section className="lg:col-span-9" aria-label="Results">
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm text-muted" aria-live="polite">
              {results.length} {results.length === 1 ? 'ride' : 'rides'}
            </p>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3.5 py-2 text-sm font-medium lg:hidden"
            >
              <SlidersHorizontalIcon size={16} aria-hidden="true" /> Filters{activeCount > 0 ? ` (${activeCount})` : ''}
            </button>
          </div>

          {results.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((r) => (
                <RideCard key={r.slug} ride={r} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-16 text-center">
              <h2 className="font-display text-2xl">No rides match these filters</h2>
              <p className="mx-auto mt-3 max-w-md text-sm text-muted">
                Try widening your budget or event size — or send us a request and we'll recommend options for your event.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <button type="button" onClick={reset} className="rounded-md border border-midnight px-4 py-2 text-sm font-semibold">
                  Clear filters
                </button>
                <Link to="/request" className="rounded-md bg-midnight px-4 py-2 text-sm font-semibold text-ivory">
                  Start an event request
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
          <button type="button" className="absolute inset-0 bg-midnight/60" aria-label="Close filters" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-ivory">
            <div className="flex justify-end p-3">
              <button type="button" onClick={() => setMobileOpen(false)} className="rounded p-2" aria-label="Close filters">
                <XIcon size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <FilterPanel filters={filters} onChange={setFilters} onReset={reset} activeCount={activeCount} />
            </div>
            <div className="border-t border-line p-4">
              <button type="button" onClick={() => setMobileOpen(false)} className="w-full rounded-md bg-midnight py-3 text-sm font-semibold text-ivory">
                Show {results.length} {results.length === 1 ? 'ride' : 'rides'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
