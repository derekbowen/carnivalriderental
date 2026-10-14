import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import type { InternalStatus } from '../../types/request';
import { internalRequests } from '../../data/internalRequests';
import { StatusPill } from '../../components/internal/StatusPill';

type Filter = 'All' | 'Needs sourcing' | 'Quoting' | 'Won';

const filterMap: Record<Filter, InternalStatus[] | null> = {
  All: null,
  'Needs sourcing': ['New', 'Sourcing', 'Awaiting supplier quote'],
  Quoting: ['Quote drafted', 'Quote sent'],
  Won: ['Accepted', 'Confirmed']
};

export function RequestQueue() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('All');

  const rows = useMemo(() => {
    const allowed = filterMap[filter];
    return internalRequests.
    filter((r) => !allowed || allowed.includes(r.status)).
    sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  }, [filter]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-tight text-ink">Fulfilment queue</h1>
          <p className="mt-1 text-sm text-ink-muted">Sorted by event date. Open a request to manage suppliers and pricing.</p>
        </div>
        <div role="tablist" aria-label="Filter requests" className="flex rounded-lg border border-line-strong bg-surface p-1">
          {(Object.keys(filterMap) as Filter[]).map((f) => {
            const count = filterMap[f] ? internalRequests.filter((r) => filterMap[f]!.includes(r.status)).length : internalRequests.length;
            return (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors duration-150 ${
                filter === f ? 'bg-ink text-canvas' : 'text-ink-soft hover:text-ink'}`
                }>
                
                {f} <span className={filter === f ? 'text-canvas/70' : 'text-ink-muted'}>{count}</span>
              </button>);

          })}
        </div>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[880px] text-sm">
          <caption className="sr-only">Event requests</caption>
          <thead className="border-b border-line bg-canvas/60 text-left text-xs text-ink-muted">
            <tr>
              <th scope="col" className="px-5 py-3 font-medium">Reference</th>
              <th scope="col" className="px-5 py-3 font-medium">Ride</th>
              <th scope="col" className="px-5 py-3 font-medium">Event date</th>
              <th scope="col" className="px-5 py-3 font-medium">City</th>
              <th scope="col" className="px-5 py-3 font-medium">Status</th>
              <th scope="col" className="px-5 py-3 font-medium">Next action</th>
              <th scope="col" className="px-5 py-3 font-medium">Owner</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) =>
            <tr
              key={r.reference}
              onClick={() => navigate(`/internal/requests/${r.reference}`)}
              className="cursor-pointer transition-colors duration-150 hover:bg-canvas/70">
              
                <td className="px-5 py-3.5">
                  <Link
                  to={`/internal/requests/${r.reference}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-mono text-[13px] font-medium text-ink underline-offset-2 hover:underline">
                  
                    {r.reference}
                  </Link>
                </td>
                <td className="px-5 py-3.5 text-ink">{r.rideName}</td>
                <td className="whitespace-nowrap px-5 py-3.5 text-ink">
                  {format(parseISO(r.eventDate), 'd MMM yyyy')}
                  {r.eventDays > 1 && <span className="text-ink-muted"> · {r.eventDays}d</span>}
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-ink">{r.city}, {r.state}</td>
                <td className="px-5 py-3.5"><StatusPill status={r.status} /></td>
                <td className="px-5 py-3.5 text-ink-soft">{r.nextAction}</td>
                <td className={`whitespace-nowrap px-5 py-3.5 ${r.owner === 'Unassigned' ? 'text-danger' : 'text-ink-soft'}`}>{r.owner}</td>
              </tr>
            )}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-5 py-10 text-center text-sm text-ink-muted">No requests in this view.</p>}
      </div>
    </div>);

}