import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon, InfoIcon } from 'lucide-react';
import type { Ride } from '../../types/ride';
import { AvailabilityBadge } from '../AvailabilityBadge';
import { EstimateRange } from '../EstimateRange';
import { primaryButtonClass } from '../../utils/formStyles';

interface RequestPanelProps {
  ride: Ride;
}

export function RequestPanel({ ride }: RequestPanelProps) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-[0_12px_32px_-20px_rgba(20,33,61,0.25)]">
      <AvailabilityBadge status={ride.availability} />
      <div className="mt-5">
        <EstimateRange low={ride.estimateLow} high={ride.estimateHigh} size="lg" />
        <p className="mt-1 text-sm text-ink-muted">{ride.estimateBasis}</p>
      </div>

      <Link to={`/request?ride=${ride.slug}`} className={`${primaryButtonClass} mt-6 w-full`}>
        Request this ride <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
      </Link>

      <div className="mt-5 flex gap-2.5 rounded-lg bg-canvas p-3.5 text-[13px] leading-relaxed text-ink-soft">
        <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden="true" />
        <p>
          This estimate reflects typical operator pricing for this ride type. Your quote will depend on the verified
          unit, transport distance, dates, operating hours and site conditions — it may fall outside this range.
        </p>
      </div>

      <ul className="mt-5 space-y-2 border-t border-line pt-5 text-sm text-ink-soft">
        <li className="flex justify-between gap-3">
          <span>Cost to request</span>
          <span className="font-medium text-ink">Free</span>
        </li>
        <li className="flex justify-between gap-3">
          <span>Booked</span>
          <span className="font-medium text-ink">Once an operator says yes</span>
        </li>
      </ul>
    </div>);

}