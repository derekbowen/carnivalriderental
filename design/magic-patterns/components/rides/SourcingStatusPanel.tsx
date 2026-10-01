import React from 'react';
import { SourcingChip } from '../SourcingChip';

const states = [
  { when: 'Today', label: 'Available on request' },
  { when: 'After your quote', label: 'Scope & price written up' },
  { when: 'After an operator commits', label: 'Booking confirmed' },
];

export function SourcingStatusPanel() {
  return (
    <section aria-labelledby="sourcing-heading" className="rounded-2xl border border-gold/40 bg-gold/5 p-6 sm:p-8">
      <SourcingChip />
      <h2 id="sourcing-heading" className="mt-4 font-display text-2xl">Sourcing status</h2>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink/80">
        We source this ride for your date; availability is confirmed only after an operator commits.
      </p>
      <ol className="mt-6 grid gap-3 sm:grid-cols-3">
        {states.map((s, i) => (
          <li key={s.when} className={`rounded-lg p-4 ${i === 0 ? 'bg-midnight text-ivory' : 'bg-white ring-1 ring-line'}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.14em] ${i === 0 ? 'text-gold' : 'text-muted'}`}>{s.when}</p>
            <p className="mt-1.5 text-sm font-medium">{s.label}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
