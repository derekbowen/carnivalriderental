import React from 'react';
import { CheckIcon } from 'lucide-react';

type Props = {
  kind: 'estimate' | 'accepted';
  tone?: 'light' | 'dark';
  className?: string;
};

export function PriceKindLabel({ kind, tone = 'light', className = '' }: Props) {
  if (kind === 'accepted') {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold ${
          tone === 'dark' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
        } ${className}`}
      >
        <CheckIcon size={12} aria-hidden="true" />
        Accepted quote
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-sm border border-dashed px-1.5 py-0.5 text-[11px] font-medium ${
        tone === 'dark' ? 'border-ivory/30 text-ivory/70' : 'border-muted/50 text-muted'
      } ${className}`}
    >
      Estimate — final quote after sourcing
    </span>
  );
}
