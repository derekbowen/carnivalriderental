import React, { useState } from 'react';
import { PlaceholderImage } from '../PlaceholderImage';
import type { GlyphKind } from '../../types/ride';

type Props = { glyph: GlyphKind; captions: string[] };

export function RideGallery({ glyph, captions }: Props) {
  const [active, setActive] = useState(0);
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_180px]">
      <PlaceholderImage
        glyph={glyph}
        size="lg"
        caption={captions[active]}
        tone={active % 2 === 0 ? 'night' : 'dusk'}
        className="aspect-[16/10] rounded-2xl"
      />
      <div className="grid grid-cols-4 gap-3 lg:grid-cols-1 lg:grid-rows-4" role="group" aria-label="Gallery images">
        {captions.map((caption, i) => (
          <button
            key={caption}
            type="button"
            onClick={() => setActive(i)}
            aria-pressed={active === i}
            aria-label={`Show image ${i + 1}: ${caption}`}
            className={`overflow-hidden rounded-lg transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
              active === i ? 'ring-2 ring-gold' : 'opacity-60 hover:opacity-100'
            }`}
          >
            <PlaceholderImage glyph={glyph} size="sm" tone={i % 2 === 0 ? 'night' : 'dusk'} className="aspect-[4/3] h-full w-full lg:aspect-auto" />
          </button>
        ))}
      </div>
    </div>
  );
}
