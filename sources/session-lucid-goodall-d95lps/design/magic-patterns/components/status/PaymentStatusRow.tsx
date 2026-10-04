import React from 'react';
import { CreditCardIcon } from 'lucide-react';
import { paymentStatuses } from '../../data/statusStages';
import type { PaymentStatus } from '../../types/request';

type Props = { status: PaymentStatus; note: string };

export function PaymentStatusRow({ status, note }: Props) {
  return (
    <section aria-labelledby="payment-heading" className="rounded-2xl border border-line bg-white p-6">
      <div className="flex items-start gap-3">
        <CreditCardIcon size={18} className="mt-1 shrink-0 text-muted" aria-hidden="true" />
        <div className="flex-1">
          <h2 id="payment-heading" className="font-display text-xl">Payment status</h2>
          <p className="mt-1 text-sm text-muted">
            Tracked separately from your booking. A payment step never confirms a booking on its own.
          </p>
        </div>
      </div>
      <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Payment status">
        {paymentStatuses.map((s) => {
          const active = s === status;
          return (
            <li
              key={s}
              aria-current={active ? 'true' : undefined}
              className={`rounded-md px-3 py-2.5 text-center text-sm ${
                active ? 'bg-ink font-semibold text-ivory' : 'bg-ivory text-muted ring-1 ring-line'
              }`}
            >
              {s}
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm text-ink/80">{note}</p>
    </section>
  );
}
