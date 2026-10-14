import React from 'react';
import { twMerge } from 'tailwind-merge';
import type { PriceKind } from '../types/request';

interface PriceKindLabelProps {
  kind: PriceKind;
  className?: string;
}

export function PriceKindLabel({ kind, className }: PriceKindLabelProps) {
  return (
    <span
      className={twMerge(
        'inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        kind === 'accepted' ?
        'border-success/30 bg-success-soft text-success' :
        'border-line-strong bg-canvas text-ink-soft',
        className
      )}>
      
      {kind === 'accepted' ? 'Accepted quote' : 'Estimate'}
    </span>);

}