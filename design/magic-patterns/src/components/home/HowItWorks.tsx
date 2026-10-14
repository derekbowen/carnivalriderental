import React from 'react';
import { bookingSteps } from '../../data/homepage';

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-16 bg-accent text-ink" aria-labelledby="how-heading">
      <div className="awning h-3" aria-hidden="true" />
      <div className="mx-auto max-w-7xl px-6 py-20 lg:px-10 lg:py-24">
        <div className="grid gap-6 lg:grid-cols-12">
          <h2 id="how-heading" className="font-display text-4xl lg:col-span-5 lg:text-[52px] lg:leading-[1.02]">
            How managed booking works
          </h2>
          <p className="text-[17px] leading-relaxed text-ink-soft lg:col-span-6 lg:col-start-7">
            You deal with one team from first request to final teardown. We hold the contract with you and the
            relationship with the operator — so scope, price and accountability sit in one place.
          </p>
        </div>

        <ol className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {bookingSteps.map((step, i) =>
          <li key={step.title} className="flex flex-col rounded-2xl bg-surface p-6 shadow-[0_2px_0_0_#0B1B3F]">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-pop font-display text-xl text-white">
                {i + 1}
              </span>
              <h3 className="mt-5 text-lg font-bold leading-snug">{step.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">{step.body}</p>
            </li>
          )}
        </ol>

        <p className="mt-12 text-sm font-medium text-ink-soft">
          Nothing is booked until step 4. Until then, availability reads{' '}
          <span className="font-bold text-ink">“Sourcing on request”</span> and prices read{' '}
          <span className="font-bold text-ink">“Estimate”</span>.
        </p>
      </div>
    </section>);

}