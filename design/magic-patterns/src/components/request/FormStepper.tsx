import React from 'react';
import { CheckIcon } from 'lucide-react';
import { requestSteps } from '../../data/requestOptions';

interface FormStepperProps {
  current: number;
}

export function FormStepper({ current }: FormStepperProps) {
  const steps = [...requestSteps, 'Review'];
  return (
    <nav aria-label="Request progress">
      <ol className="flex gap-2">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className="min-w-0 flex-1">
              <div className={`h-1 rounded-full ${done || active ? 'bg-ink' : 'bg-line-strong'}`} />
              <p
                className={`mt-2 hidden items-center gap-1 truncate text-xs md:flex ${
                active ? 'font-semibold text-ink' : done ? 'text-ink-soft' : 'text-ink-muted'}`
                }
                aria-current={active ? 'step' : undefined}>
                
                {done && <CheckIcon className="h-3 w-3 shrink-0" aria-hidden="true" />}
                {label}
              </p>
            </li>);

        })}
      </ol>
      <p className="mt-2 text-xs font-semibold text-ink md:hidden">{steps[current]}</p>
    </nav>);

}