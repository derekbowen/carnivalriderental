import React from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { fieldClass } from '../../utils/fieldClass';

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
};

export function SelectField({ id, label, error, hint, className = '', children, ...rest }: Props) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">{label}</label>
      <div className="relative mt-2">
        <select id={id} aria-invalid={!!error} aria-describedby={describedBy} className={`appearance-none pr-10 ${fieldClass(!!error)}`} {...rest}>
          {children}
        </select>
        <ChevronDownIcon size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-red-700">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
