import React from 'react';
import type { SupplierStage } from '../../types/request';

const styles: Record<SupplierStage, string> = {
  Researched: 'bg-slate-100 text-slate-700 ring-slate-200',
  Contacted: 'bg-sky-50 text-sky-800 ring-sky-200',
  Verified: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  Quoted: 'bg-amber-50 text-amber-900 ring-amber-200',
  Committed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
};

export function StageChip({ stage }: { stage: SupplierStage }) {
  return <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ring-1 ${styles[stage]}`}>{stage}</span>;
}
