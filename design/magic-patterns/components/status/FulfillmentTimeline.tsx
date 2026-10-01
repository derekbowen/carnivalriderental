import React from 'react';
import { CheckIcon } from 'lucide-react';
import { fulfillmentStages } from '../../data/statusStages';

type Props = { completed: number; dates: (string | null)[] };

export function FulfillmentTimeline({ completed, dates }: Props) {
  return (
    <ol className="relative">
      {fulfillmentStages.map((stage, i) => {
        const done = i < completed;
        const current = i === completed;
        const last = i === fulfillmentStages.length - 1;
        return (
          <li key={stage.id} className="relative flex gap-5 pb-8 last:pb-0" aria-current={current ? 'step' : undefined}>
            {!last && (
              <span className={`absolute left-[15px] top-8 h-[calc(100%-2rem)] w-px ${done ? 'bg-gold' : 'bg-line'}`} aria-hidden="true" />
            )}
            <span
              className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                done
                  ? 'bg-gold text-midnight'
                  : current
                    ? 'bg-midnight text-gold ring-4 ring-gold/25'
                    : 'border border-dashed border-muted/50 bg-white text-muted'
              }`}
            >
              {done ? <CheckIcon size={15} aria-hidden="true" /> : i + 1}
            </span>
            <div className="flex-1 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={`font-medium ${done || current ? 'text-ink' : 'text-muted'}`}>{stage.label}</p>
                <span
                  className={`text-xs ${
                    done ? 'text-muted' : current ? 'rounded-full bg-gold/15 px-2 py-0.5 font-semibold text-gold-deep' : 'text-muted/70'
                  }`}
                >
                  {done ? dates[i] ?? 'Done' : current ? 'In progress' : 'Upcoming'}
                </span>
              </div>
              <p className={`mt-1 text-sm leading-relaxed ${done || current ? 'text-muted' : 'text-muted/70'}`}>{stage.description}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
