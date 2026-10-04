import React from 'react';
import { format, parseISO } from 'date-fns';
import type { EventRequestForm } from '../../types/request';
import { rides } from '../../data/rides';
import { usStates } from '../../data/states';
import { requestSteps, NOT_SURE_RIDE } from '../../data/requestOptions';

interface ReviewSummaryProps {
  form: EventRequestForm;
  onEdit: (step: number) => void;
}

function fmtDate(value: string) {
  return value ? format(parseISO(value), 'EEE d MMM yyyy') : '';
}

export function ReviewSummary({ form, onEdit }: ReviewSummaryProps) {
  const ride =
  form.rideSlug === NOT_SURE_RIDE ? 'Not sure yet — recommend a ride' : rides.find((r) => r.slug === form.rideSlug)?.name;
  const stateName = usStates.find((s) => s.code === form.state)?.name;

  const sections: {rows: [string, string][];}[] = [
  {
    rows: [
    ['Ride', ride ?? ''],
    ['Dates', [fmtDate(form.startDate), fmtDate(form.endDate)].filter(Boolean).join(' – ')],
    ['Flexible dates', form.datesFlexible ? 'Yes' : 'No'],
    ['Hours per day', form.dailyHours]]

  },
  {
    rows: [
    ['Location', [form.city, stateName].filter(Boolean).join(', ')],
    ['Venue', form.venueName],
    ['Venue type', form.venueType],
    ['Attendance', form.attendance]]

  },
  {
    rows: [
    ['Space', form.space],
    ['Ground surface', form.surface],
    ['Power', form.power],
    ['Truck access', form.access],
    ['Site notes', form.siteNotes]]

  },
  {
    rows: [
    ['Name', form.name],
    ['Organization', [form.organization, form.orgType].filter(Boolean).join(' · ')],
    ['Email', form.email],
    ['Phone', form.phone],
    ['Budget', form.budget],
    ['Notes', form.notes]]

  }];


  return (
    <div className="divide-y divide-line rounded-xl border border-line bg-surface">
      {sections.map((section, i) =>
      <section key={requestSteps[i]} className="p-5" aria-labelledby={`review-${i}`}>
          <div className="flex items-center justify-between">
            <h3 id={`review-${i}`} className="font-semibold text-ink">
              {requestSteps[i]}
            </h3>
            <button
            type="button"
            onClick={() => onEdit(i)}
            className="text-sm font-medium text-ink underline underline-offset-4 hover:text-accent-ink">
            
              Edit<span className="sr-only"> {requestSteps[i]}</span>
            </button>
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[150px_1fr]">
            {section.rows.map(([label, value]) =>
          <React.Fragment key={label}>
                <dt className="text-ink-muted">{label}</dt>
                <dd className={value ? 'text-ink' : 'text-ink-muted'}>{value || 'Not provided'}</dd>
              </React.Fragment>
          )}
          </dl>
        </section>
      )}
    </div>);

}