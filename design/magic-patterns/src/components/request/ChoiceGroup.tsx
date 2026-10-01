import React from 'react';
import { HelpCircleIcon } from 'lucide-react';

interface ChoiceGroupProps {
  legend: string;
  name: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  columns?: 2 | 3;
}

export function ChoiceGroup({ legend, name, options, value, onChange, error, hint, columns = 2 }: ChoiceGroupProps) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink">{legend}</legend>
      {hint && <p className="mb-2 text-xs text-ink-muted">{hint}</p>}
      <div className={`grid gap-2 sm:grid-cols-2 ${columns === 3 ? 'lg:grid-cols-3' : ''}`}>
        {options.map((option) => {
          const selected = value === option;
          const notSure = option.startsWith('Not sure') || option === 'Not set yet';
          return (
            <label
              key={option}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3.5 py-3 text-[15px] transition-[border-color,background-color] duration-150 ${
              selected ?
              'border-ink bg-surface text-ink shadow-[inset_0_0_0_1px_#14213D]' :
              'border-line-strong bg-surface text-ink-soft hover:border-ink-muted'} ${
              notSure && !selected ? 'border-dashed' : ''}`}>
              
              <input
                type="radio"
                name={name}
                value={option}
                checked={selected}
                onChange={() => onChange(option)}
                className="h-4 w-4 accent-ink" />
              
              <span className="flex-1">{option}</span>
              {notSure && <HelpCircleIcon className="h-4 w-4 text-ink-muted" aria-hidden="true" />}
            </label>);

        })}
      </div>
      {error &&
      <p role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      }
    </fieldset>);

}