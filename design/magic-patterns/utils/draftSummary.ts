import { rides } from '../data/rides';
import { eventTypes } from '../data/eventTypes';
import {
  accessOptions,
  attendanceOptions,
  budgetOptions,
  contactPreferenceOptions,
  flexibilityOptions,
  powerOptions,
  spaceOptions,
} from '../data/requestOptions';
import { formatDateRange } from './date';
import { formatHours, optionLabel } from './requestLabels';
import type { EventRequestDraft } from '../types/request';

export type SummarySection = { step: number; title: string; rows: { label: string; value: string }[] };

export function rideLabel(d: EventRequestDraft): string {
  return rides.find((r) => r.slug === d.rideSlug)?.name ?? 'Help me choose';
}

export function dateLabel(d: EventRequestDraft): string {
  if (!d.dateStart) return 'Not provided';
  return formatDateRange(d.dateStart, d.dateMode === 'range' ? d.dateEnd : undefined);
}

export function locationLabel(d: EventRequestDraft): string {
  if (!d.city && !d.state) return 'Not provided';
  return [d.city, d.state].filter(Boolean).join(', ');
}

export function summarizeDraft(d: EventRequestDraft): SummarySection[] {
  const eventTypeOptions = eventTypes.map((t) => ({ value: t.value, label: t.label }));
  return [
    {
      step: 0,
      title: 'Ride & flexibility',
      rows: [
        { label: 'Ride', value: rideLabel(d) },
        { label: 'Flexibility', value: optionLabel(flexibilityOptions, d.flexibility) },
        { label: 'Ride notes', value: d.rideNotes || '—' },
      ],
    },
    {
      step: 1,
      title: 'Event details',
      rows: [
        { label: d.dateMode === 'range' ? 'Date range' : 'Date', value: dateLabel(d) },
        { label: 'Location', value: locationLabel(d) },
        { label: 'Venue', value: d.venue || 'Not provided' },
        { label: 'Operating hours', value: formatHours(d.hoursStart, d.hoursEnd) },
        { label: 'Event type', value: optionLabel(eventTypeOptions, d.eventType) },
        { label: 'Expected attendance', value: optionLabel(attendanceOptions, d.attendance) },
      ],
    },
    {
      step: 2,
      title: 'Site & budget',
      rows: [
        { label: 'Access', value: optionLabel(accessOptions, d.access) },
        { label: 'Available space', value: optionLabel(spaceOptions, d.space) },
        { label: 'Power', value: optionLabel(powerOptions, d.power) },
        { label: 'Budget', value: optionLabel(budgetOptions, d.budget) },
        { label: 'Site notes', value: d.siteNotes || '—' },
      ],
    },
    {
      step: 3,
      title: 'Contact',
      rows: [
        { label: 'Name', value: [d.name, d.role].filter(Boolean).join(' · ') || 'Not provided' },
        { label: 'Organization', value: d.organization || 'Not provided' },
        { label: 'Email', value: d.email || 'Not provided' },
        { label: 'Phone', value: d.phone || 'Not provided' },
        { label: 'Preferred contact', value: optionLabel(contactPreferenceOptions, d.contactPreference) },
      ],
    },
  ];
}
