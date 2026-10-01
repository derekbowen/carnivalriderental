import React from 'react';

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}

export function Field({ label, htmlFor, hint, error, optional, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline gap-2 text-sm font-medium text-ink">
        {label}
        {optional && <span className="text-xs font-normal text-ink-muted">Optional</span>}
      </label>
      {hint && <p className="-mt-0.5 mb-2 text-xs text-ink-muted">{hint}</p>}
      {children}
      {error &&
      <p role="alert" className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      }
    </div>);

}