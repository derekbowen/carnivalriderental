import React from 'react';
import type { InternalStatus } from '../../types/request';

const styles: Record<InternalStatus, string> = {
  New: 'bg-sky-50 text-sky-800 ring-sky-200',
  Sourcing: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  'Quote drafting': 'bg-violet-50 text-violet-800 ring-violet-200',
  'Quote sent': 'bg-amber-50 text-amber-900 ring-amber-200',
  'Quote accepted': 'bg-orange-50 text-orange-900 ring-orange-200',
  'Operator committed': 'bg-teal-50 text-teal-800 ring-teal-200',
  'Booking confirmed': 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  'Closed — not booked': 'bg-slate-100 text-slate-600 ring-slate-200',
};

export function InternalStatusBadge({ status }: { status: InternalStatus }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${styles[status]}`}>
      {status}
    </span>
  );
}
