import React from 'react';
import { CheckIcon } from 'lucide-react';
import type { Option } from '../../types/request';

type Props = {
  name: string;
  legend: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  columns?: 2 | 3 | 4;
};

const columnClass = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
};

export function ChoiceGroup({ name, legend, options, value, onChange, error, hint, columns = 2 }: Props) {
  return (
    <fieldset aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className={`mt-3 grid gap-2.5 ${columnClass[columns]}`}>
        {options.map((opt) => {
          const checked = value === opt.value;
          const base = checked
            ? 'border-midnight bg-midnight text-ivory'
            : opt.notSure
              ? 'border-dashed border-muted/50 bg-ivory hover:border-muted'
              : 'border-line bg-white hover:border-midnight/40';
          return (
            <label
              key={opt.value}
              className={`relative flex cursor-pointer flex-col rounded-lg border px-4 py-3 transition-colors focus-within:ring-2 focus-within:ring-gold focus-within:ring-offset-2 ${base}`}
            >
              <input
                type="radio"
                className="sr-only"
                name={name}
                value={opt.value}
                checked={checked}
                onChange={() => onChange(opt.value)}
              />
              <span className="flex items-center justify-between gap-2 text-sm font-medium">
                {opt.label}
                {checked && <CheckIcon size={16} className="shrink-0 text-gold" aria-hidden="true" />}
              </span>
              {opt.description && (
                <span className={`mt-1 text-xs leading-relaxed ${checked ? 'text-ivory/70' : 'text-muted'}`}>{opt.description}</span>
              )}
            </label>
          );
        })}
      </div>
      {error && (
        <p id={`${name}-error`} role="alert" className="mt-2 text-sm text-red-700">{error}</p>
      )}
    </fieldset>
  );
}
