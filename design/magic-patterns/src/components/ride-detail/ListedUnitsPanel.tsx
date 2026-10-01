import React from 'react';
import { MapPinIcon } from 'lucide-react';
import type { Ride } from '../../types/ride';
import { listings } from '../../data/listings';
import { AvailabilityBadge } from '../AvailabilityBadge';

interface ListedUnitsPanelProps {
  ride: Ride;
}

const bookingFlow = [
'You book the ride with us for your date.',
'We offer the job to the closest listed operator at an agreed price.',
'Yes — you’re booked. No — we go straight to the next closest unit.',
'You pay us. We pay the operator and manage delivery.'];


export function ListedUnitsPanel({ ride }: ListedUnitsPanelProps) {
  const units = listings.filter((l) => l.rideSlug === ride.slug);

  return (
    <section aria-labelledby="units-heading" className="rounded-2xl border border-line bg-surface p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="units-heading" className="font-display text-3xl text-ink">
          Listed units
        </h2>
        <AvailabilityBadge status={ride.availability} />
      </div>
      <p className="mt-3 max-w-2xl leading-relaxed text-ink-muted">
        {units.length} {units.length === 1 ? 'unit is' : 'units are'} listed by carnival operators. A listing shows the
        ride exists — your date is confirmed with the operator when you book.
      </p>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {units.map((u, i) =>
        <li key={u.id} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pop-soft text-pop">
              <MapPinIcon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-ink">
                Unit {i + 1} · {u.base}, {u.state}
              </p>
              <p className="text-sm text-ink-muted">{u.detail}</p>
            </div>
          </li>
        )}
      </ul>
      <p className="mt-3 text-xs text-ink-muted">Operator details are shared once your booking is confirmed.</p>

      <div className="mt-8 grid gap-8 border-t border-line pt-8 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-bold text-ink">What happens when you book</h3>
          <ol className="mt-3 space-y-3">
            {bookingFlow.map((step, i) =>
            <li key={step} className="flex gap-3 text-sm leading-relaxed text-ink-soft">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">
                  {i + 1}
                </span>
                {step}
              </li>
            )}
          </ol>
        </div>
        <div>
          <h3 className="text-sm font-bold text-ink">Recommended lead time</h3>
          <p className="mt-1 text-sm text-ink-soft">{ride.leadTime}</p>
          <p className="mt-4 text-sm text-ink-muted">
            Booking early gives us more listed units to choose from if the closest one is taken.
          </p>
        </div>
      </div>
    </section>);

}