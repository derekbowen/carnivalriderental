import React from 'react';
import { fieldClass } from '../../utils/fieldClass';

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  label: string;
  hint?: string;
  optional?: boolean;
};

export function TextAreaField({ id, label, hint, optional, className = '', ...rest }: Props) {
  return (
    <div className={className}>
      <label htmlFor={id} className="flex items-baseline justify-between text-sm font-semibold text-ink">
        {label}
        {optional && <span className="text-xs font-normal text-muted">Optional</span>}
      </label>
      <textarea id={id} rows={3} aria-describedby={hint ? `${id}-hint` : undefined} className={`mt-2 resize-y ${fieldClass(false)}`} {...rest} />
      {hint && <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
