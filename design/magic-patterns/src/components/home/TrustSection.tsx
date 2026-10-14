import React from 'react';
import { CheckIcon, XIcon } from 'lucide-react';
import { commitments, comparison } from '../../data/homepage';
import { AvailabilityBadge } from '../AvailabilityBadge';
import { PriceKindLabel } from '../PriceKindLabel';

export function TrustSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24" aria-labelledby="trust-heading">
      <div className="max-w-2xl">
        <h2 id="trust-heading" className="font-display text-4xl text-ink lg:text-[52px] lg:leading-[1.02]">
          Stop searching. It’s all right here.
        </h2>
        <p className="mt-4 text-[17px] leading-relaxed text-ink-muted">
          Renting a carnival ride used to mean days of searching, calling and chasing. We built the central booking
          system that didn’t exist.
        </p>
      </div>

      <div className="mt-12 overflow-hidden rounded-2xl border border-line bg-surface">
        <table className="w-full text-left text-[15px]">
          <caption className="sr-only">Booking a ride the old way versus with Book a Carnival</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="w-1/4 px-6 py-4 text-sm font-medium text-ink-muted">
                <span className="sr-only">Task</span>
              </th>
              <th scope="col" className="px-6 py-4 text-sm font-semibold text-ink-muted">The old way</th>
              <th scope="col" className="bg-ink px-6 py-4 text-sm font-semibold text-accent">Book a Carnival</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {comparison.map((row) =>
            <tr key={row.label}>
                <th scope="row" className="px-6 py-4 font-semibold text-ink">{row.label}</th>
                <td className="px-6 py-4 text-ink-muted">
                  <span className="flex items-start gap-2">
                    <XIcon className="mt-0.5 h-4 w-4 shrink-0 text-pop" aria-hidden="true" />
                    {row.oldWay}
                  </span>
                </td>
                <td className="bg-ink/[0.03] px-6 py-4 font-medium text-ink">
                  <span className="flex items-start gap-2">
                    <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    {row.ourWay}
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ul className="mt-16 grid gap-x-12 gap-y-8 md:grid-cols-2">
        {commitments.map((c) =>
        <li key={c.title} className="border-t-2 border-ink pt-5">
            <h3 className="text-lg font-bold text-ink">{c.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{c.body}</p>
          </li>
        )}
      </ul>

      <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2">
        <div className="bg-surface p-7">
          <h3 className="font-display text-2xl text-ink">Reading our prices</h3>
          <dl className="mt-5 space-y-4">
            <div className="flex gap-4">
              <dt className="w-32 shrink-0"><PriceKindLabel kind="estimate" /></dt>
              <dd className="text-sm text-ink-muted">Typical price range for the ride. Shown so you can plan — not a quote.</dd>
            </div>
            <div className="flex gap-4">
              <dt className="w-32 shrink-0"><PriceKindLabel kind="accepted" /></dt>
              <dd className="text-sm text-ink-muted">Your final, itemized price — locked once an operator says yes and you approve it.</dd>
            </div>
          </dl>
        </div>
        <div className="bg-surface p-7">
          <h3 className="font-display text-2xl text-ink">Reading our availability</h3>
          <dl className="mt-5 space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
              <dt className="sm:w-52 sm:shrink-0"><AvailabilityBadge status="sourcing" /></dt>
              <dd className="text-sm text-ink-muted">The ride is listed. We check your date with the operator when you book.</dd>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
              <dt className="sm:w-52 sm:shrink-0"><AvailabilityBadge status="verified" /></dt>
              <dd className="text-sm text-ink-muted">An operator has said yes to your event at the agreed price.</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>);

}