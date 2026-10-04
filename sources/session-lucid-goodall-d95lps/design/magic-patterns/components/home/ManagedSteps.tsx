import React from 'react';
import { managedSteps } from '../../data/howItWorks';

export function ManagedSteps() {
  return (
    <section id="how-it-works" className="scroll-mt-16 border-y border-line bg-white py-20 lg:py-28" aria-labelledby="how-heading">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-deep">How a managed booking works</p>
            <h2 id="how-heading" className="mt-4 font-display text-3xl leading-tight sm:text-4xl lg:text-5xl">
              One request. Our team handles the sourcing.
            </h2>
          </div>
          <p className="self-end text-base leading-relaxed text-muted lg:col-span-5 lg:col-start-8">
            You deal with one coordinator instead of calling operators one by one. We only confirm a booking when the
            scope is agreed in writing and an operator has committed to your date.
          </p>
        </div>

        <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2 lg:grid-cols-5">
          {managedSteps.map((step, i) => {
            const last = i === managedSteps.length - 1;
            return (
              <li key={step.title} className={`flex flex-col p-7 ${last ? 'bg-midnight text-ivory md:col-span-2 lg:col-span-1' : 'bg-white'}`}>
                <span className={`font-display text-5xl ${last ? 'text-gold' : 'text-gold-deep'}`}>{i + 1}</span>
                <h3 className="mt-6 font-display text-xl leading-snug">{step.title}</h3>
                <p className={`mt-3 text-sm leading-relaxed ${last ? 'text-ivory/70' : 'text-muted'}`}>{step.description}</p>
                {last && (
                  <p className="mt-auto pt-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-soft">
                    The only point a booking is confirmed
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
