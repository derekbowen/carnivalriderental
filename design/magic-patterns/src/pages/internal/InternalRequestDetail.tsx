import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { AlertTriangleIcon, ArrowLeftIcon } from 'lucide-react';
import { internalRequests } from '../../data/internalRequests';
import { StatusPill } from '../../components/internal/StatusPill';
import { OperatorCallSheet } from '../../components/internal/OperatorCallSheet';
import { CostBreakdown } from '../../components/internal/CostBreakdown';
import { PriceKindLabel } from '../../components/PriceKindLabel';
import { formatUSD } from '../../utils/currency';
import { summarizeMargin } from '../../utils/margin';

export function InternalRequestDetail() {
  const { reference } = useParams();
  const req = internalRequests.find((r) => r.reference === reference);

  if (!req) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="font-display text-3xl text-ink">Request not found</h1>
        <Link to="/internal" className="mt-4 inline-block text-sm font-medium text-ink underline underline-offset-4">
          Back to queue
        </Link>
      </div>);

  }

  const { knownCost, unknownCount, margin, marginPct } = summarizeMargin(req.costs, req.customerPrice);

  const brief: [string, string][] = [
  ['Customer', `${req.customerOrg} · ${req.orgType}`],
  ['Event date', `${format(parseISO(req.eventDate), 'EEE d MMM yyyy')} · ${req.eventDays} ${req.eventDays === 1 ? 'day' : 'days'}`],
  ['Location', `${req.city}, ${req.state}`],
  ['Venue', req.venue],
  ['Attendance', req.attendance],
  ['Space', req.space],
  ['Power', req.power],
  ['Truck access', req.access],
  ['Budget', req.budget]];


  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
      <Link to="/internal" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink">
        <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" /> Fulfilment queue
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-mono text-sm text-ink-muted">{req.reference}</p>
            <StatusPill status={req.status} />
          </div>
          <h1 className="mt-1 font-display text-4xl tracking-tight text-ink">{req.rideName}</h1>
          <p className="mt-1 text-sm text-ink-muted">Owner: {req.owner}</p>
        </div>
        <div className="rounded-lg border border-accent/50 bg-accent-soft px-4 py-3">
          <p className="text-xs font-medium text-accent-ink">Next action</p>
          <p className="mt-0.5 text-sm font-semibold text-ink">{req.nextAction}</p>
        </div>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-8">
          <section aria-labelledby="brief-heading" className="rounded-xl border border-line bg-surface p-5">
            <h2 id="brief-heading" className="font-semibold text-ink">Event brief</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{req.brief}</p>
            <dl className="mt-5 grid gap-x-8 gap-y-3 border-t border-line pt-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {brief.map(([label, value]) =>
              <div key={label}>
                  <dt className="text-xs text-ink-muted">{label}</dt>
                  <dd className={`mt-0.5 ${value.startsWith('Not sure') || value === 'Not set yet' || value === 'Not provided' ? 'text-accent-ink font-medium' : 'text-ink'}`}>
                    {value}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <OperatorCallSheet candidates={req.candidates} />
          <CostBreakdown costs={req.costs} knownCost={knownCost} unknownCount={unknownCount} />
        </div>

        <aside className="lg:col-span-4" aria-label="Pricing">
          <div className="sticky top-6 space-y-4">
            <section className="rounded-xl border border-line bg-surface p-5" aria-labelledby="price-heading">
              <div className="flex items-center justify-between">
                <h2 id="price-heading" className="text-sm font-semibold text-ink">Customer price</h2>
                <PriceKindLabel kind={req.customerPriceKind} />
              </div>
              {req.customerPrice !== null ?
              <p className="mt-3 font-display text-4xl tabular-nums text-ink">{formatUSD(req.customerPrice)}</p> :

              <p className="mt-3 font-display text-3xl text-ink-muted">Not set</p>
              }
              <p className="mt-1 text-xs text-ink-muted">
                {req.customerPriceKind === 'accepted' ?
                'Accepted by customer in writing.' :
                'Draft — not yet accepted by the customer.'}
              </p>
            </section>

            <section className="rounded-xl bg-ink p-5 text-canvas" aria-labelledby="margin-heading">
              <h2 id="margin-heading" className="text-sm font-semibold">Projected contribution margin (not guaranteed)</h2>
              {margin !== null && marginPct !== null ?
              <>
                  <p className="mt-3 font-display text-4xl tabular-nums">
                    {formatUSD(margin)}
                    <span className="ml-2 text-lg text-canvas/70">{marginPct.toFixed(1)}%</span>
                  </p>
                  <dl className="mt-4 space-y-1.5 border-t border-canvas/15 pt-4 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-canvas/70">Customer price</dt>
                      <dd className="tabular-nums">{formatUSD(req.customerPrice ?? 0)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-canvas/70">Known costs</dt>
                      <dd className="tabular-nums">− {formatUSD(knownCost)}</dd>
                    </div>
                  </dl>
                </> :

              <p className="mt-3 text-sm text-canvas/75">Can’t be projected until a customer price and supplier costs exist.</p>
              }
              {(unknownCount > 0 || req.costs.length === 0) &&
              <p className="mt-4 flex gap-2 rounded-lg bg-canvas/10 p-3 text-xs leading-relaxed text-canvas">
                  <AlertTriangleIcon className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                  {req.costs.length === 0 ?
                'All cost lines are unknown.' :
                `${unknownCount} cost ${unknownCount === 1 ? 'line is' : 'lines are'} unknown. Margin will fall once ${unknownCount === 1 ? 'it is' : 'they are'} known.`}
                </p>
              }
            </section>
          </div>
        </aside>
      </div>
    </div>);

}