import React from 'react';
import type { CostLine } from '../../types/request';
import { formatUSD } from '../../utils/currency';

const defaultLines: CostLine[] = [
{ label: 'Supplier quote', detail: 'No supplier quote received', amount: null },
{ label: 'Transport & mobilization', detail: '', amount: null },
{ label: 'Setup, teardown & crew', detail: '', amount: null },
{ label: 'Other costs', detail: '', amount: null },
{ label: 'Payment costs', detail: '', amount: null }];


interface CostBreakdownProps {
  costs: CostLine[];
  knownCost: number;
  unknownCount: number;
}

export function CostBreakdown({ costs, knownCost, unknownCount }: CostBreakdownProps) {
  const lines = costs.length > 0 ? costs : defaultLines;
  const unknowns = costs.length > 0 ? unknownCount : defaultLines.length;

  return (
    <section aria-labelledby="costs-heading" className="rounded-xl border border-line bg-surface">
      <div className="border-b border-line px-5 py-4">
        <h2 id="costs-heading" className="font-semibold text-ink">
          Supplier quote cost breakdown
        </h2>
      </div>
      <table className="w-full text-sm">
        <caption className="sr-only">Cost lines</caption>
        <thead>
          <tr className="text-left text-xs text-ink-muted">
            <th scope="col" className="px-5 py-2.5 font-medium">Cost line</th>
            <th scope="col" className="px-5 py-2.5 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {lines.map((line) =>
          <tr key={line.label}>
              <td className="px-5 py-3">
                <p className="font-medium text-ink">{line.label}</p>
                {line.detail && <p className="text-xs text-ink-muted">{line.detail}</p>}
              </td>
              <td className="px-5 py-3 text-right tabular-nums">
                {line.amount === null ?
              <span className="rounded bg-danger-soft px-1.5 py-0.5 text-xs font-semibold text-danger">Unknown</span> :

              <span className="text-ink">{formatUSD(line.amount)}</span>
              }
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-line-strong">
            <th scope="row" className="px-5 py-3 text-left font-semibold text-ink">
              Total known cost
              {unknowns > 0 &&
              <span className="block text-xs font-normal text-danger">
                  Excludes {unknowns} unknown {unknowns === 1 ? 'line' : 'lines'}
                </span>
              }
            </th>
            <td className="px-5 py-3 text-right font-semibold tabular-nums text-ink">{formatUSD(knownCost)}</td>
          </tr>
        </tfoot>
      </table>
    </section>);

}