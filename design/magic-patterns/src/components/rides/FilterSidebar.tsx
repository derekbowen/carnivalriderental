import React from 'react';
import type { EventSizeId, RideCategoryId } from '../../types/ride';
import { categories, eventSizes } from '../../data/categories';
import { usStates } from '../../data/states';
import { inputClass } from '../../utils/formStyles';

interface FilterSidebarProps {
  selectedCategories: RideCategoryId[];
  onToggleCategory: (id: RideCategoryId) => void;
  size: EventSizeId | '';
  onSizeChange: (size: EventSizeId | '') => void;
  state: string;
  onStateChange: (state: string) => void;
  onClear: () => void;
  hasFilters: boolean;
}

export function FilterSidebar({
  selectedCategories,
  onToggleCategory,
  size,
  onSizeChange,
  state,
  onStateChange,
  onClear,
  hasFilters
}: FilterSidebarProps) {
  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Filters</h2>
        {hasFilters &&
        <button type="button" onClick={onClear} className="text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline">
            Clear all
          </button>
        }
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-ink">Category</legend>
        <ul className="mt-3 space-y-2.5">
          {categories.map((cat) =>
          <li key={cat.id}>
              <label className={`flex items-center gap-2.5 text-[15px] ${cat.comingLater ? 'text-ink-muted' : 'cursor-pointer text-ink'}`}>
                <input
                type="checkbox"
                disabled={cat.comingLater}
                checked={selectedCategories.includes(cat.id)}
                onChange={() => onToggleCategory(cat.id)}
                className="h-4 w-4 rounded border-line-strong accent-ink" />
              
                <span className="flex-1">{cat.name}</span>
                {cat.comingLater && <span className="text-xs">Coming later</span>}
              </label>
            </li>
          )}
        </ul>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-ink">Event size</legend>
        <ul className="mt-3 space-y-2.5">
          <li>
            <label className="flex cursor-pointer items-center gap-2.5 text-[15px] text-ink">
              <input type="radio" name="size" checked={size === ''} onChange={() => onSizeChange('')} className="h-4 w-4 accent-ink" />
              Any size
            </label>
          </li>
          {eventSizes.map((s) =>
          <li key={s.id}>
              <label className="flex cursor-pointer items-center gap-2.5 text-[15px] text-ink">
                <input
                type="radio"
                name="size"
                checked={size === s.id}
                onChange={() => onSizeChange(s.id)}
                className="h-4 w-4 accent-ink" />
              
                {s.label}
              </label>
            </li>
          )}
        </ul>
      </fieldset>

      <div>
        <label htmlFor="state-filter" className="text-sm font-medium text-ink">
          Event state
        </label>
        <select id="state-filter" value={state} onChange={(e) => onStateChange(e.target.value)} className={`${inputClass} mt-3`}>
          <option value="">Any state</option>
          {usStates.map((s) =>
          <option key={s.code} value={s.code}>
              {s.name}
            </option>
          )}
        </select>
        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          Shows rides with operators we can approach in that state. It doesn’t mean a unit is reserved.
        </p>
      </div>
    </div>);

}