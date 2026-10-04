import React from 'react';
import { categories } from '../../data/categories';
import { budgetRanges, eventSizeOptions, settingOptions } from '../../data/filters';
import type { RideFilters } from '../../utils/rideFilters';

type Props = {
  filters: RideFilters;
  onChange: (next: RideFilters) => void;
  onReset: () => void;
  activeCount: number;
};

const legendClass = 'text-[11px] font-semibold uppercase tracking-[0.18em] text-muted';
const rowClass = 'flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-sand/60';

function toggle<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function FilterPanel({ filters, onChange, onReset, activeCount }: Props) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl">Filters</h2>
        {activeCount > 0 && (
          <button type="button" onClick={onReset} className="text-sm font-medium text-gold-deep hover:underline">
            Clear all ({activeCount})
          </button>
        )}
      </div>

      <fieldset>
        <legend className={legendClass}>Category</legend>
        <div className="mt-3 space-y-0.5">
          {[{ id: 'all', name: 'All rides' }, ...categories].map((c) => (
            <label key={c.id} className={rowClass}>
              <input
                type="radio"
                name="category"
                className="h-4 w-4 accent-midnight"
                checked={filters.category === c.id}
                onChange={() => onChange({ ...filters, category: c.id })}
              />
              {c.name}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={legendClass}>Event size</legend>
        <div className="mt-3 space-y-0.5">
          {eventSizeOptions.map((s) => (
            <label key={s.value} className={rowClass}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded accent-midnight"
                checked={filters.sizes.includes(s.value)}
                onChange={() => onChange({ ...filters, sizes: toggle(filters.sizes, s.value) })}
              />
              <span className="flex-1">{s.label}</span>
              <span className="text-xs text-muted">{s.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={legendClass}>Budget range</legend>
        <p className="mt-1 text-xs text-muted">Matched against estimates, not quotes.</p>
        <div className="mt-3 space-y-0.5">
          {budgetRanges.map((b) => (
            <label key={b.value} className={rowClass}>
              <input
                type="radio"
                name="budget"
                className="h-4 w-4 accent-midnight"
                checked={filters.budget === b.value}
                onChange={() => onChange({ ...filters, budget: b.value })}
              />
              {b.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={legendClass}>Indoor / outdoor</legend>
        <div className="mt-3 space-y-0.5">
          {settingOptions.map((s) => (
            <label key={s.value} className={rowClass}>
              <input
                type="checkbox"
                className="h-4 w-4 rounded accent-midnight"
                checked={filters.settings.includes(s.value)}
                onChange={() => onChange({ ...filters, settings: toggle(filters.settings, s.value) })}
              />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
