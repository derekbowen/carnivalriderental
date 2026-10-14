import React from 'react';
import { CheckIcon } from 'lucide-react';
import type { TrackStep } from '../../types/request';

interface ProgressTrackProps {
  title: string;
  steps: TrackStep[];
  current: number;
}

export function ProgressTrack({ title, steps, current }: ProgressTrackProps) {
  return (
    <section aria-labelledby={`track-${title}`} className="rounded-2xl border border-line bg-surface p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={`track-${title}`} className="font-display text-2xl text-ink">
          {title}
        </h2>
        <p className="text-sm text-ink-muted">{steps[current]?.label}</p>
      </div>
      <ol className="mt-6">
        {steps.map((step, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'upcoming';
          const last = i === steps.length - 1;
          return (
            <li key={step.label} className="relative flex gap-4 pb-6 last:pb-0" aria-current={state === 'current' ? 'step' : undefined}>
              {!last &&
              <span
                className={`absolute left-[11px] top-7 h-[calc(100%-24px)] w-px ${state === 'done' ? 'bg-ink' : 'bg-line-strong'}`}
                aria-hidden="true" />

              }
              <span
                className={`relative z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                state === 'done' ?
                'bg-ink text-canvas' :
                state === 'current' ?
                'border-2 border-accent bg-surface' :
                'border border-line-strong bg-surface'}`
                }>
                
                {state === 'done' && <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />}
                {state === 'current' && <span className="h-2 w-2 rounded-full bg-accent" />}
                <span className="sr-only">{state === 'done' ? 'Completed' : state === 'current' ? 'In progress' : 'Not started'}</span>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className={`font-medium ${state === 'upcoming' ? 'text-ink-muted' : 'text-ink'}`}>{step.label}</p>
                  {step.date && <p className="text-xs text-ink-muted">{step.date}</p>}
                </div>
                {state !== 'upcoming' && <p className="mt-0.5 text-sm text-ink-muted">{step.description}</p>}
                {state === 'current' &&
                <span className="mt-2 inline-block rounded bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-ink">
                    In progress
                  </span>
                }
              </div>
            </li>);

        })}
      </ol>
    </section>);

}