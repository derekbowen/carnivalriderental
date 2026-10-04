import React from 'react';
import { brand } from '../data/brand';

type Props = { className?: string };

export function BrandMark({ className = '' }: Props) {
  const spokes = Array.from({ length: 8 }, (_, i) => (i * Math.PI) / 4);
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 32 32" className="h-8 w-8 text-gold" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
        <circle cx="16" cy="14" r="10" />
        <circle cx="16" cy="14" r="1.8" fill="currentColor" />
        {spokes.map((a, i) => (
          <line key={i} x1={16} y1={14} x2={16 + 10 * Math.cos(a)} y2={14 + 10 * Math.sin(a)} strokeWidth={1} />
        ))}
        <path d="M16 14 L10 29 M16 14 L22 29 M7 29 H25" />
      </svg>
      <span className="font-display text-xl font-medium tracking-tight">{brand.name}</span>
    </span>
  );
}
