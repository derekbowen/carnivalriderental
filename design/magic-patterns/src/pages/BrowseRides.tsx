import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SlidersHorizontalIcon } from 'lucide-react';
import type { EventSizeId, RideCategoryId } from '../types/ride';
import { rides } from '../data/rides';
import { FilterSidebar } from '../components/rides/FilterSidebar';
import { RideCard } from '../components/rides/RideCard';
import { secondaryButtonClass } from '../utils/formStyles';

export function BrowseRides() {
  const [params] = useSearchParams();
  const initialCategory = params.get('category') as RideCategoryId | null;
  const [selectedCategories, setSelectedCategories] = useState<RideCategoryId[]>(
    initialCategory ? [initialCategory] : []
  );
  const [size, setSize] = useState<EventSizeId | ''>('');
  const [state, setState] = useState(params.get('state') ?? '');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(
    () =>
    rides.filter(
      (r) =>
      (selectedCategories.length === 0 || selectedCategories.includes(r.categoryId)) && (
      !size || r.eventSizes.includes(size)) && (
      !state || r.sourcingStates.includes(state))
    ),
    [selectedCategories, size, state]
  );

  const toggleCategory = (id: RideCategoryId) =>
  setSelectedCategories((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);

  const clear = () => {
    setSelectedCategories([]);
    setSize('');
    setState('');
  };

  const hasFilters = selectedCategories.length > 0 || !!size || !!state;

  const sidebar =
  <FilterSidebar
    selectedCategories={selectedCategories}
    onToggleCategory={toggleCategory}
    size={size}
    onSizeChange={setSize}
    state={state}
    onStateChange={setState}
    onClear={clear}
    hasFilters={hasFilters} />;



  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 pt-12 lg:px-10">
      <header className="max-w-2xl">
        <h1 className="font-display text-5xl tracking-tight text-ink">Every listed ride</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-ink-muted">
          Rides listed from carnival operators across the country, all in one place. Prices are estimates until an
          operator says yes to your date and you approve the final price.
        </p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[240px_1fr] lg:gap-12">
        <aside className="hidden lg:block" aria-label="Filters">
          <div className="sticky top-24">{sidebar}</div>
        </aside>

        <div>
          <div className="mb-6 flex items-center justify-between gap-4 border-b border-line pb-4">
            <p className="text-sm text-ink-muted" aria-live="polite">
              {filtered.length} {filtered.length === 1 ? 'ride' : 'rides'}
            </p>
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              className={`${secondaryButtonClass} px-3.5 py-2 text-sm lg:hidden`}>
              
              <SlidersHorizontalIcon className="h-4 w-4" aria-hidden="true" />
              Filters
            </button>
          </div>

          {filtersOpen && <div className="mb-8 rounded-2xl border border-line bg-surface p-5 lg:hidden">{sidebar}</div>}

          {filtered.length > 0 ?
          <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((ride) =>
            <li key={ride.id}>
                  <RideCard ride={ride} />
                </li>
            )}
            </ul> :

          <div className="rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
              <h2 className="font-display text-2xl text-ink">No rides match these filters</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
                We may still be able to source what you need. Clear filters, or tell us about your event and we’ll
                look for a suitable operator.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <button type="button" onClick={clear} className={`${secondaryButtonClass} py-2.5 text-sm`}>
                  Clear filters
                </button>
                <Link to="/request" className="inline-flex items-center rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-ink hover:bg-accent-hover">
                  Start an event request
                </Link>
              </div>
            </div>
          }
        </div>
      </div>
    </div>);

}