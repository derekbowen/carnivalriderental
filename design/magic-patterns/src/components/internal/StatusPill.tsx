import React from 'react';
import type { InternalStatus } from '../../types/request';

const styles: Record<InternalStatus, string> = {
  New: 'bg-ink text-canvas',
  Sourcing: 'bg-accent-soft text-accent-ink',
  'Awaiting supplier quote': 'bg-accent-soft text-accent-ink',
  'Quote drafted': 'bg-surface text-ink border border-line-strong',
  'Quote sent': 'bg-surface text-ink border border-line-strong',
  Accepted: 'bg-success-soft text-success',
  Confirmed: 'bg-success text-surface'
};

export function StatusPill({ status }: {status: InternalStatus;}) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[status]}`}>
      {status}
    </span>);

}