import { rides } from '../data/rides';
import { eventTypes } from '../data/eventTypes';
import { attendanceOptions } from '../data/requestOptions';
import { dateLabel, locationLabel, rideLabel } from './draftSummary';
import { formatShortDate } from './date';
import { optionLabel } from './requestLabels';
import type { CustomerStatus, SubmittedRequest } from '../types/request';

export function statusFromSubmitted(sub: SubmittedRequest): CustomerStatus {
  const { draft } = sub;
  const ride = rides.find((r) => r.slug === draft.rideSlug);
  return {
    reference: sub.reference,
    rideName: rideLabel(draft),
    rideSlug: ride?.slug ?? null,
    eventDateLabel: dateLabel(draft),
    location: locationLabel(draft),
    venue: draft.venue || 'Not provided',
    eventType: optionLabel(eventTypes.map((t) => ({ value: t.value, label: t.label })), draft.eventType),
    attendance: `${optionLabel(attendanceOptions, draft.attendance)} guests`,
    completedStages: 1,
    stageDates: [formatShortDate(sub.submittedAt.slice(0, 10)), null, null, null, null, null],
    payment: 'Not started',
    paymentNote: 'No payment details are needed until you accept a quote.',
    estimate: ride ? { min: ride.estimateMin, max: ride.estimateMax } : null,
    acceptedQuote: null,
    latestUpdate: 'Request received. A coordinator will review your brief and begin sourcing operators.',
    coordinator: 'Being assigned',
  };
}
