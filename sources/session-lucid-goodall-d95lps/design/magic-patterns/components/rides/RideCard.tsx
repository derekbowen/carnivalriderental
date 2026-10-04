import React from 'react';
import { Link } from 'react-router-dom';
import { PlaceholderImage } from '../PlaceholderImage';
import { PriceKindLabel } from '../PriceKindLabel';
import { SourcingChip } from '../SourcingChip';
import { formatRange } from '../../utils/currency';
import type { Ride } from '../../types/ride';

type Props = { ride: Ride };

export function RideCard({ ride }: Props) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white transition-shadow hover:shadow-lg hover:shadow-midnight/5">
      <Link to={`/rides/${ride.slug}`} className="flex flex-1 flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold">
        <PlaceholderImage glyph={ride.glyph} caption={ride.gallery[0]} className="aspect-[4/3]" />
        <div className="flex flex-1 flex-col p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{ride.rideType}</p>
          <h3 className="mt-1.5 font-display text-2xl leading-snug group-hover:text-gold-deep">{ride.name}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{ride.summary}</p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {ride.settings.map((s) => (
              <span key={s} className="rounded-full bg-ivory px-2.5 py-0.5 text-xs text-ink ring-1 ring-line">
                {s === 'outdoor' ? 'Outdoor' : 'Indoor suitable'}
              </span>
            ))}
          </div>
          <div className="mt-auto pt-5">
            <SourcingChip />
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-[15px] font-semibold">
                Estimate from {formatRange(ride.estimateMin, ride.estimateMax)}{' '}
                <span className="font-normal text-muted">(not a quote)</span>
              </p>
              <PriceKindLabel kind="estimate" className="mt-2" />
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}
