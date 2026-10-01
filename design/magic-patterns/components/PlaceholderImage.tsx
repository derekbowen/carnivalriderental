import React from 'react';
import { ImageIcon } from 'lucide-react';
import { RideGlyph } from './RideGlyph';
import type { GlyphKind } from '../types/ride';

type Props = {
  glyph: GlyphKind;
  caption?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'night' | 'dusk';
};

const glyphSize = {
  sm: 'w-3/4',
  md: 'w-3/5 max-w-[280px]',
  lg: 'w-3/5 max-w-[440px]',
};

export function PlaceholderImage({ glyph, caption, className = '', size = 'md', tone = 'night' }: Props) {
  return (
    <div
      role="img"
      aria-label={`Development placeholder image${caption ? `: ${caption}` : ''}`}
      className={`relative overflow-hidden ${tone === 'night' ? 'bg-midnight-2' : 'bg-midnight-3'} ${className}`}
    >
      <div className="absolute inset-x-0 bottom-0 h-[22%] bg-midnight/40" aria-hidden="true" />
      <RideGlyph
        kind={glyph}
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-gold/45 ${glyphSize[size]}`}
      />
      {caption && size !== 'sm' && (
        <span className="absolute left-4 top-4 max-w-[80%] text-xs text-ivory/55">{caption}</span>
      )}
      <span
        className={`absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-midnight/85 font-medium uppercase text-ivory/80 ring-1 ring-ivory/15 ${
          size === 'sm' ? 'px-2 py-0.5 text-[8px] tracking-[0.08em]' : 'px-2.5 py-1 text-[10px] tracking-[0.14em]'
        }`}
      >
        <ImageIcon size={size === 'sm' ? 9 : 12} aria-hidden="true" />
        {size === 'sm' ? 'Placeholder' : 'Development placeholder image'}
      </span>
    </div>
  );
}
