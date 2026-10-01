import React from 'react';

type Props = { tone?: 'light' | 'dark'; className?: string };

export function SourcingChip({ tone = 'light', className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        tone === 'dark' ? 'bg-gold/15 text-gold-soft ring-1 ring-gold/30' : 'bg-gold/10 text-ink ring-1 ring-gold/40'
      } ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />
      Sourcing status: Available on request
    </span>
  );
}
