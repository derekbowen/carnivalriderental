import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from 'lucide-react';
import { PriceKindLabel } from '../PriceKindLabel';

export function PricingClarity() {
  return (
    <section className="bg-sand py-20 lg:py-24" aria-labelledby="pricing-heading">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-deep">Pricing, clearly labeled</p>
          <h2 id="pricing-heading" className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
            You'll always know whether a number is an estimate or a commitment
          </h2>
          <Link
            to="/request"
            className="mt-8 inline-flex items-center gap-2 rounded-md bg-midnight px-5 py-3 text-sm font-semibold text-ivory hover:bg-midnight-3"
          >
            Start an event request <ArrowRightIcon size={16} aria-hidden="true" />
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:col-span-7">
          <article className="rounded-2xl border border-line bg-ivory p-7">
            <PriceKindLabel kind="estimate" />
            <p className="mt-6 font-display text-3xl">$12,000–$28,000</p>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Shown on ride pages to help you plan. It reflects a typical range — your price depends on date, distance,
              site and operating hours.
            </p>
          </article>
          <article className="rounded-2xl bg-midnight p-7 text-ivory">
            <PriceKindLabel kind="accepted" tone="dark" />
            <p className="mt-6 font-display text-3xl">$18,450</p>
            <p className="mt-4 text-sm leading-relaxed text-ivory/65">
              The written price you've accepted for an itemized scope. Your booking is confirmed once an operator commits
              to that scope and date.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}
