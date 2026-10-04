import React, { useState } from 'react';
import { PlaceholderImage } from '../PlaceholderImage';

interface RideGalleryProps {
  rideName: string;
}

const views = ['Full view at event', 'Rider perspective', 'Night lighting', 'Setup footprint'];

export function RideGallery({ rideName }: RideGalleryProps) {
  const [active, setActive] = useState(0);

  return (
    <div>
      <PlaceholderImage
        key={active}
        className="aspect-[16/10] w-full rounded-2xl"
        label={`${rideName} — ${views[active]} (${active + 1} of ${views.length})`} />
      
      <div className="mt-3 grid grid-cols-4 gap-3" role="tablist" aria-label="Gallery images">
        {views.map((view, i) =>
        <button
          key={view}
          type="button"
          role="tab"
          aria-selected={active === i}
          aria-label={`Show image: ${view}`}
          onClick={() => setActive(i)}
          className={`overflow-hidden rounded-lg ring-offset-2 ring-offset-canvas transition-[box-shadow,opacity] duration-150 ${
          active === i ? 'ring-2 ring-ink' : 'opacity-70 hover:opacity-100'}`
          }>
          
            <PlaceholderImage className="aspect-[4/3] w-full" compact label={view} />
          </button>
        )}
      </div>
    </div>);

}