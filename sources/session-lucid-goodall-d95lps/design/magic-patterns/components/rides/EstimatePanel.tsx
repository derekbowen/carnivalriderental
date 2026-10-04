import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, CheckIcon } from 'lucide-react';
import { PriceKindLabel } from '../PriceKindLabel';
import { brand } from '../../data/brand';
import { formatRange } from '../../utils/currency';
import type { Ride } from '../../types/ride';

type Props = { ride: Ride };

const quoteItems = ['Ride and operating crew', 'Transport & mobilization', 'Setup & teardown', 'Any site-specific costs'];

export function EstimatePanel({ ride }: Props) {
  return (
    <div className="rounded-2xl bg-midnight p-6 text-ivory shadow-xl shadow-midnight/10 sm:p-7">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Estimate range</p>
      <p className="mt-3 font-display text-3xl sm:text-4xl">{formatRange(ride.estimateMin, ride.estimateMax)}</p>
      <PriceKindLabel kind="estimate" tone="dark" className="mt-3" />
      <p className="mt-4 text-sm leading-relaxed text-ivory/60">
        Typical range for a single event day. Your price depends on date, distance, site and operating hours.
      </p>

      <Link
        to={`/request?ride=${ride.slug}`}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-gold px-5 py-4 text-base font-semibold text-midnight transition-colors hover:bg-gold-soft focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-soft focus-visible:ring-offset-2 focus-visible:ring-offset-midnight"
      >
        Request this ride <ArrowRightIcon size={18} aria-hidden="true" />
      </Link>
      <p className="mt-3 text-center text-xs text-ivory/50">A request doesn't book the ride or take payment.</p>

      <div className="mt-6 border-t border-ivory/10 pt-5">
        <p className="text-sm font-medium">Your written quote will itemize</p>
        <ul className="mt-3 space-y-2">
          {quoteItems.map((item) => (
            <li key={item} className="flex items-center gap-2 text-sm text-ivory/70">
              <CheckIcon size={14} className="text-gold" aria-hidden="true" /> {item}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-6 text-xs text-ivory/50">
        Questions first? <a href={`mailto:${brand.email}`} className="text-gold-soft underline-offset-2 hover:underline">Email our team</a>
      </p>
    </div>
  );
}
