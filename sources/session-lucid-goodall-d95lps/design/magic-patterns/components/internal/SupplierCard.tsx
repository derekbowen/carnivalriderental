import React from 'react';
import { StageChip } from './StageChip';
import { quoteLineLabels, supplierStages } from '../../data/statusStages';
import { formatMaybeUSD, formatUSD } from '../../utils/currency';
import { summarizeQuote } from '../../utils/quote';
import type { Supplier } from '../../types/request';

type Props = { supplier: Supplier; isLead: boolean };

export function SupplierCard({ supplier, isLead }: Props) {
  const stageIndex = supplierStages.indexOf(supplier.stage);
  const summary = supplier.quote ? summarizeQuote(supplier.quote) : null;

  return (
    <article className={`rounded-xl border bg-white ${isLead ? 'border-midnight/40 ring-1 ring-midnight/10' : 'border-line'}`}>
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{supplier.name}</h3>
            <StageChip stage={supplier.stage} />
            {isLead && <span className="text-[11px] font-semibold uppercase tracking-wider text-gold-deep">Pricing basis</span>}
          </div>
          <p className="mt-0.5 text-sm text-muted">{supplier.region}</p>
          <p className="mt-2 text-sm text-ink/80">{supplier.note}</p>
        </div>
        <div className="flex gap-1" aria-label={`Stage ${stageIndex + 1} of ${supplierStages.length}: ${supplier.stage}`} role="img">
          {supplierStages.map((s, i) => (
            <span key={s} title={s} className={`h-1.5 w-7 rounded-full ${i <= stageIndex ? 'bg-midnight' : 'bg-line'}`} />
          ))}
        </div>
      </div>

      {supplier.quote && summary ? (
        <div className="border-t border-line">
          <table className="w-full text-sm">
            <caption className="sr-only">Quote lines from {supplier.name}</caption>
            <tbody className="divide-y divide-line">
              {quoteLineLabels.map(({ key, label }) => {
                const value = supplier.quote ? supplier.quote[key] : null;
                return (
                  <tr key={key}>
                    <th scope="row" className="px-5 py-2.5 text-left font-normal text-muted">{label}</th>
                    <td className={`px-5 py-2.5 text-right tabular-nums ${value === null ? 'font-medium text-amber-800' : ''}`}>
                      {formatMaybeUSD(value)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-ivory">
                <th scope="row" className="px-5 py-3 text-left font-semibold">Known cost total</th>
                <td className="px-5 py-3 text-right font-semibold tabular-nums">
                  {formatUSD(summary.knownTotal)}
                  {summary.unknownCount > 0 && (
                    <span className="block text-xs font-normal text-amber-800">+ {summary.unknownCount} unknown</span>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="border-t border-dashed border-line px-5 py-3 text-sm text-muted">No quote received yet.</p>
      )}
    </article>
  );
}
