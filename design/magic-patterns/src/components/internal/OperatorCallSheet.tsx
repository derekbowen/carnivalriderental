import React from 'react';
import { PhoneIcon } from 'lucide-react';
import type { OperatorAnswer, SupplierCandidate } from '../../types/request';
import { formatUSD } from '../../utils/currency';

const answerStyles: Record<OperatorAnswer, string> = {
  Yes: 'bg-success text-white',
  No: 'bg-pop text-white',
  'Awaiting answer': 'bg-accent text-ink',
  'Not called': 'border border-line-strong text-ink-muted'
};

interface OperatorCallSheetProps {
  candidates: SupplierCandidate[];
}

export function OperatorCallSheet({ candidates }: OperatorCallSheetProps) {
  const sorted = [...candidates].sort((a, b) => a.distanceMi - b.distanceMi);
  const hasYes = sorted.some((c) => c.answer === 'Yes');
  const nextToCall = sorted.find((c) => c.answer === 'Not called');
  const awaiting = sorted.some((c) => c.answer === 'Awaiting answer');

  return (
    <section aria-labelledby="calls-heading" className="rounded-xl border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 id="calls-heading" className="font-semibold text-ink">Operator call sheet</h2>
          <p className="text-xs text-ink-muted">Closest listed unit first. Their only answer is yes or no.</p>
        </div>
        {!hasYes && !awaiting && nextToCall &&
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-ink-soft">
          
            <PhoneIcon className="h-4 w-4" aria-hidden="true" />
            Call next closest: {nextToCall.name}
          </button>
        }
      </div>
      {sorted.length === 0 ?
      <p className="px-5 py-8 text-center text-sm text-ink-muted">
          No operators queued yet. Pull the closest listed units for this ride to start calling.
        </p> :

      <ol className="divide-y divide-line">
          {sorted.map((c, i) =>
        <li key={c.name} className="grid gap-3 px-5 py-4 md:grid-cols-[28px_1fr_110px_130px] md:items-center">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-canvas text-xs font-bold text-ink">
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-3">
                  <p className="font-semibold text-ink">{c.name}</p>
                  <p className="text-xs text-ink-muted">
                    {c.base} · {c.distanceMi} mi
                  </p>
                </div>
                <p className="mt-0.5 text-sm text-ink-muted">{c.note}</p>
              </div>
              <div className="text-sm md:text-right">
                <p className="text-xs text-ink-muted">Our offer</p>
                <p className="font-semibold tabular-nums text-ink">{c.offer !== null ? formatUSD(c.offer) : '—'}</p>
              </div>
              <div className="md:text-right">
                <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ${answerStyles[c.answer]}`}>
                  {c.answer}
                </span>
                <p className="mt-1 text-xs text-ink-muted">{c.lastTouch}</p>
              </div>
            </li>
        )}
        </ol>
      }
    </section>);

}