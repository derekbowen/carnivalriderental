import React from 'react';
import { PriceKindLabel } from '../PriceKindLabel';
import { internalStatuses } from '../../data/statusStages';
import { formatUSD } from '../../utils/currency';
import { projectedContribution } from '../../utils/quote';
import type { InternalStatus, PaymentStatus, Supplier } from '../../types/request';

type Props = {
  customerPrice: number | null;
  status: InternalStatus;
  lead: Supplier | null;
  payment: PaymentStatus;
};

export function PricingPanel({ customerPrice, status, lead, payment }: Props) {
  const accepted =
    internalStatuses.indexOf(status) >= internalStatuses.indexOf('Quote accepted') && status !== 'Closed — not booked';
  const contribution = projectedContribution(customerPrice, lead?.quote ?? null);

  return (
    <section aria-labelledby="pricing-heading" className="rounded-xl border border-line bg-white">
      <h2 id="pricing-heading" className="border-b border-line px-5 py-3.5 font-display text-lg">Pricing</h2>
      <div className="space-y-5 p-5">
        <div>
          <p className="text-xs text-muted">Customer price</p>
          {customerPrice !== null ? (
            <>
              <p className="mt-1 font-display text-3xl tabular-nums">{formatUSD(customerPrice)}</p>
              <PriceKindLabel kind={accepted ? 'accepted' : 'estimate'} className="mt-1.5" />
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">Not priced yet</p>
          )}
        </div>

        <div className="rounded-lg bg-ivory p-4">
          <p className="text-xs font-semibold">Projected contribution (not guaranteed)</p>
          {contribution ? (
            <>
              <p className={`mt-1 font-display text-2xl tabular-nums ${contribution.amount < 0 ? 'text-red-700' : ''}`}>
                {formatUSD(contribution.amount)}
              </p>
              <p className="mt-1 text-xs text-muted">
                Customer price minus known costs from {lead?.name}.
                {contribution.unknownCount > 0 && (
                  <span className="text-amber-800"> Excludes {contribution.unknownCount} unknown cost line{contribution.unknownCount > 1 ? 's' : ''}.</span>
                )}
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">Unknown — needs a customer price and a supplier quote.</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line pt-4 text-sm">
          <span className="text-muted">Payment status</span>
          <span className="rounded bg-ink px-2 py-0.5 text-xs font-semibold text-ivory">{payment}</span>
        </div>
        <p className="text-xs text-muted">Payment is tracked separately and does not move fulfillment status.</p>
      </div>
    </section>
  );
}
