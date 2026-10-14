import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { MailIcon } from 'lucide-react';
import { customerRequest, fulfilmentTrack, paymentTrack, requestUpdates } from '../data/customerRequest';
import { ProgressTrack } from '../components/status/ProgressTrack';
import { PlaceholderImage } from '../components/PlaceholderImage';
import { AvailabilityBadge } from '../components/AvailabilityBadge';
import { PriceKindLabel } from '../components/PriceKindLabel';
import { formatUSD } from '../utils/currency';

export function RequestStatus() {
  const { reference } = useParams();
  const req = customerRequest;

  if (reference !== req.reference) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="font-display text-4xl text-ink">We couldn’t find that request</h1>
        <p className="mt-3 text-ink-muted">Check the reference in your confirmation email, or contact us and we’ll look it up.</p>
        <Link to={`/requests/${req.reference}`} className="mt-6 inline-block font-medium text-ink underline underline-offset-4">
          View sample request {req.reference}
        </Link>
      </div>);

  }

  return (
    <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-8">
        <div>
          <p className="font-mono text-sm text-ink-muted">{req.reference}</p>
          <h1 className="mt-2 font-display text-4xl tracking-tight text-ink lg:text-5xl">Your event request</h1>
          <p className="mt-2 text-ink-muted">
            Submitted {req.submittedOn} · <span className="font-medium text-ink">Not yet booked</span>
          </p>
        </div>
        <a href={`mailto:${req.contactEmail}`} className="inline-flex items-center gap-2 text-sm font-medium text-ink hover:text-accent-ink">
          <MailIcon className="h-4 w-4" aria-hidden="true" /> Contact {req.contactName}, your coordinator
        </a>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <div className="grid gap-6 md:grid-cols-2">
            <ProgressTrack title="Fulfilment status" steps={fulfilmentTrack} current={req.fulfilmentCurrent} />
            <ProgressTrack title="Payment status" steps={paymentTrack} current={req.paymentCurrent} />
          </div>

          <section className="mt-12" aria-labelledby="updates-heading">
            <h2 id="updates-heading" className="font-display text-2xl text-ink">
              Updates
            </h2>
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {requestUpdates.map((u) =>
              <li key={u.date} className="grid gap-1 py-4 sm:grid-cols-[140px_1fr] sm:gap-6">
                  <span className="text-sm text-ink-muted">{u.date}</span>
                  <span className="text-[15px] text-ink">{u.text}</span>
                </li>
              )}
            </ul>
          </section>
        </div>

        <aside className="lg:col-span-4" aria-label="Request summary">
          <div className="sticky top-24 rounded-2xl border border-line bg-surface p-5">
            <PlaceholderImage className="aspect-[4/3] w-full rounded-xl" label={req.rideName} />
            <h2 className="mt-4 font-display text-2xl text-ink">{req.rideName}</h2>
            <AvailabilityBadge status={req.availability} className="mt-2" />
            <p className="mt-2 text-xs text-ink-muted">
              An operator said yes to your dates. It’s locked in once you approve the final price.
            </p>

            <dl className="mt-5 space-y-3 border-t border-line pt-5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Dates</dt>
                <dd className="text-right text-ink">{req.eventDates}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Location</dt>
                <dd className="text-right text-ink">{req.location}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-muted">Venue</dt>
                <dd className="text-right text-ink">{req.venue}</dd>
              </div>
            </dl>

            <div className="mt-5 border-t border-line pt-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-ink-muted">Price</p>
                <PriceKindLabel kind={req.priceKind} />
              </div>
              <p className="mt-2 font-display text-3xl text-ink">
                {formatUSD(req.estimateLow)} – {formatUSD(req.estimateHigh)}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                Planning estimate, not a quote. Your itemized quote will replace this once issued.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>);

}