import React from 'react';
import { Link } from 'react-router-dom';
import { MapPinIcon } from 'lucide-react';
import type { Ride } from '../../types/ride';
import { categories } from '../../data/categories';
import { listings } from '../../data/listings';
import { PlaceholderImage } from '../PlaceholderImage';
import { AvailabilityBadge } from '../AvailabilityBadge';
import { EstimateRange } from '../EstimateRange';

interface RideCardProps {
  ride: Ride;
}

export function RideCard({ ride }: RideCardProps) {
  const category = categories.find((c) => c.id === ride.categoryId);
  const unitCount = listings.filter((l) => l.rideSlug === ride.slug).length;

  return (
    <Link
      to={`/rides/${ride.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-[0_8px_24px_-12px_rgba(11,27,63,0.25)]">
      
      <div className="relative">
        <PlaceholderImage className="aspect-[4/3] w-full" label={ride.name} />
        <AvailabilityBadge status={ride.availability} className="absolute left-3 top-3" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-semibold text-ink-muted">{category?.name}</p>
        <h3 className="mt-1 font-display text-[22px] leading-tight text-ink">{ride.name}</h3>
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft">
          <MapPinIcon className="h-4 w-4 text-pop" aria-hidden="true" />
          {unitCount} listed {unitCount === 1 ? 'unit' : 'units'} nationwide
        </p>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">{ride.summary}</p>
        <div className="mt-auto border-t border-line pt-4">
          <EstimateRange low={ride.estimateLow} high={ride.estimateHigh} />
        </div>
      </div>
    </Link>);

}