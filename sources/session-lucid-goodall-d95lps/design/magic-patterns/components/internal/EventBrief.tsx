import React from 'react';
import { formatDateRange, formatShortDate } from '../../utils/date';
import type { InternalRequest } from '../../types/request';

type Props = { request: InternalRequest };

export function EventBrief({ request: r }: Props) {
  const groups = [
    {
      title: 'Event',
      rows: [
        ['Date', formatDateRange(r.eventDate, r.eventDateEnd)],
        ['Location', `${r.city}, ${r.state}`],
        ['Venue', r.venue],
        ['Operating hours', r.hours],
        ['Event type', r.eventType],
        ['Attendance', r.attendance],
      ],
    },
    {
      title: 'Ride & site',
      rows: [
        ['Ride', r.rideName],
        ['Flexibility', r.flexibility],
        ['Access', r.site.access],
        ['Space', r.site.space],
        ['Power', r.site.power],
        ['Budget', r.budget],
      ],
    },
    {
      title: 'Contact',
      rows: [
        ['Name', `${r.contact.name} · ${r.contact.role}`],
        ['Organization', r.contact.organization],
        ['Email', r.contact.email],
        ['Phone', r.contact.phone],
        ['Received', formatShortDate(r.receivedAt)],
      ],
    },
  ];

  return (
    <section aria-labelledby="brief-heading" className="rounded-xl border border-line bg-white">
      <h2 id="brief-heading" className="border-b border-line px-5 py-3.5 font-display text-lg">Event brief</h2>
      <div className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
        {groups.map((g) => (
          <div key={g.title} className="p-5">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{g.title}</h3>
            <dl className="mt-3 space-y-2.5">
              {g.rows.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className={`text-sm ${value === 'Not sure' || value === 'Not sure yet' ? 'italic text-amber-800' : ''}`}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      {r.notes && (
        <p className="border-t border-line px-5 py-4 text-sm">
          <span className="font-semibold">Customer notes: </span>
          {r.notes}
        </p>
      )}
    </section>
  );
}
