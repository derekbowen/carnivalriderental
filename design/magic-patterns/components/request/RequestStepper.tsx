import React from 'react';
import { CheckIcon } from 'lucide-react';

type Props = {
  steps: string[];
  current: number;
  furthest: number;
  onSelect: (index: number) => void;
};

export function RequestStepper({ steps, current, furthest, onSelect }: Props) {
  return (
    <nav aria-label="Request progress">
      <ol className="grid grid-cols-5 gap-2">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          const reachable = i <= furthest && !active;
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                disabled={!reachable}
                aria-current={active ? 'step' : undefined}
                className="group w-full text-left disabled:cursor-default"
              >
                <span className={`block h-1 rounded-full ${done || active ? 'bg-gold' : 'bg-ivory/15'}`} />
                <span className="mt-3 flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      active ? 'bg-gold text-midnight' : done ? 'bg-ivory/15 text-gold' : 'bg-transparent text-ivory/50 ring-1 ring-ivory/25'
                    }`}
                  >
                    {done ? <CheckIcon size={13} aria-hidden="true" /> : i + 1}
                  </span>
                  <span
                    className={`hidden text-sm md:inline ${active ? 'text-ivory' : 'text-ivory/55'} ${reachable ? 'group-hover:text-ivory group-hover:underline' : ''}`}
                  >
                    {label}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm text-ivory/70 md:hidden">
        Step {current + 1} of {steps.length}: {steps[current]}
      </p>
    </nav>
  );
}
