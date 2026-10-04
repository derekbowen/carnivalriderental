import React from 'react';
import { fieldClass } from '../../utils/fieldClass';

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
};

export function TextField({ id, label, error, hint, optional, className = '', ...rest }: Props) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="flex items-baseline justify-between text-sm font-semibold text-ink">
        {label}
        {optional && <span className="text-xs font-normal text-muted">Optional</span>}
      </label>
      <input id={id} aria-invalid={!!error} aria-describedby={describedBy} className={`mt-2 ${fieldClass(!!error)}`} {...rest} />
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-red-700">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
