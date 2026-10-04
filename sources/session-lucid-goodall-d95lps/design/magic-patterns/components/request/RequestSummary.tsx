import React from 'react';
import { PlaceholderImage } from '../PlaceholderImage';
import { PriceKindLabel } from '../PriceKindLabel';
import { rides } from '../../data/rides';
import { attendanceOptions, budgetOptions } from '../../data/requestOptions';
import { formatRange } from '../../utils/currency';
import { dateLabel, locationLabel, rideLabel } from '../../utils/draftSummary';
import { optionLabel } from '../../utils/requestLabels';
import type { EventRequestDraft } from '../../types/request';

type Props = { draft: EventRequestDraft };

const afterSubmit = ['We review your brief', 'We source matching operators', 'You receive a written quote'];

export function RequestSummary({ draft }: Props) {
  const ride = rides.find((r) => r.slug === draft.rideSlug);
  const rows = [
    { label: 'Ride', value: rideLabel(draft) },
    { label: 'Date', value: dateLabel(draft) },
    { label: 'Location', value: locationLabel(draft) },
    { label: 'Attendance', value: optionLabel(attendanceOptions, draft.attendance, '—') },
    { label: 'Budget', value: optionLabel(budgetOptions, draft.budget, '—') },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <PlaceholderImage glyph={ride?.glyph ?? 'package'} caption={ride ? ride.gallery[0] : 'Event request'} className="aspect-[16/9]" />
      <div className="p-6">
        <h2 className="font-display text-xl">Your request</h2>
        <dl className="mt-4 space-y-2.5">
          {rows.map((r) => (
            <div key={r.label} className="flex justify-between gap-4 text-sm">
              <dt className="text-muted">{r.label}</dt>
              <dd className="text-right font-medium">{r.value}</dd>
            </div>
          ))}
        </dl>
        {ride && (
          <div className="mt-5 border-t border-line pt-4">
            <p className="text-sm">Estimate from {formatRange(ride.estimateMin, ride.estimateMax)}</p>
            <PriceKindLabel kind="estimate" className="mt-1.5" />
          </div>
        )}
        <div className="mt-6 rounded-lg bg-ivory p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">After you submit</p>
          <ol className="mt-3 space-y-2">
            {afterSubmit.map((s, i) => (
              <li key={s} className="flex items-center gap-2.5 text-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-midnight text-[11px] font-semibold text-gold">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-muted">Nothing is booked until you accept the scope and an operator commits.</p>
        </div>
      </div>
    </div>
  );
}
