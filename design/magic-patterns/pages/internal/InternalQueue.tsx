import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRightIcon, SearchIcon } from 'lucide-react';
import { InternalBanner } from '../../components/internal/InternalBanner';
import { InternalStatusBadge } from '../../components/internal/InternalStatusBadge';
import { Input } from '../../components/Input';
import { internalRequests } from '../../data/internalRequests';
import { internalStatuses } from '../../data/statusStages';
import { formatDateRange } from '../../utils/date';
import type { InternalStatus } from '../../types/request';

type Filter = 'All' | InternalStatus;

export function InternalQueue() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return internalRequests.filter(
      (r) =>
        (filter === 'All' || r.status === filter) &&
        (!q || [r.reference, r.city, r.state, r.rideName, r.contact.organization].some((v) => v.toLowerCase().includes(q))),
    );
  }, [filter, query]);

  const countFor = (s: InternalStatus) => internalRequests.filter((r) => r.status === s).length;
  const statusFilters = internalStatuses.filter((s) => countFor(s) > 0);

  return (
    <div className="min-h-[70vh] bg-[#F4F2EC]">
      <InternalBanner />
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Internal · Operations</p>
            <h1 className="mt-2 font-display text-3xl">Request queue</h1>
          </div>
          <div className="w-full md:w-80">
            <Input
              aria-label="Search requests"
              placeholder="Search reference, city, ride…"
              startAdornment={<SearchIcon size={16} />}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {(['All', ...statusFilters] as Filter[]).map((s) => {
            const active = filter === s;
            const count = s === 'All' ? internalRequests.length : countFor(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                aria-pressed={active}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  active ? 'bg-ink text-ivory' : 'bg-white text-ink ring-1 ring-line hover:ring-muted'
                }`}
              >
                {s} <span className={active ? 'text-ivory/60' : 'text-muted'}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[960px] text-left text-sm">
            <caption className="sr-only">Customer requests</caption>
            <thead className="border-b border-line bg-ivory text-[11px] uppercase tracking-[0.12em] text-muted">
              <tr>
                {['Reference', 'Event date', 'City', 'Ride', 'Budget', 'Status', 'Next action', ''].map((h, i) => (
                  <th key={h || i} scope="col" className="px-4 py-3 font-semibold">
                    {h || <span className="sr-only">Open</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr
                  key={r.reference}
                  onClick={() => navigate(`/internal/${r.reference}`)}
                  className="cursor-pointer align-top hover:bg-ivory/70"
                >
                  <td className="px-4 py-3.5">
                    <Link
                      to={`/internal/${r.reference}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-mono text-[13px] font-semibold text-ink underline-offset-2 hover:underline"
                    >
                      {r.reference}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">{formatDateRange(r.eventDate, r.eventDateEnd)}</td>
                  <td className="whitespace-nowrap px-4 py-3.5">{r.city}, {r.state}</td>
                  <td className="px-4 py-3.5">{r.rideName}</td>
                  <td className={`whitespace-nowrap px-4 py-3.5 ${r.budget === 'Not sure yet' ? 'italic text-muted' : ''}`}>{r.budget}</td>
                  <td className="px-4 py-3.5"><InternalStatusBadge status={r.status} /></td>
                  <td className="max-w-[260px] px-4 py-3.5 text-ink/80">{r.nextAction}</td>
                  <td className="px-4 py-3.5 text-muted"><ChevronRightIcon size={16} aria-hidden="true" /></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted">
                    No requests match this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
