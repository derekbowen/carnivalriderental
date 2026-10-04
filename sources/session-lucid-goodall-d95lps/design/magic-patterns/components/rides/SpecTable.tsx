import React from 'react';
import { BadgeCheckIcon, CircleDashedIcon } from 'lucide-react';
import type { RideSpec } from '../../types/ride';

type Props = { specs: RideSpec[] };

export function SpecTable({ specs }: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Specifications</caption>
        <thead className="bg-sand/60 text-[11px] uppercase tracking-[0.14em] text-muted">
          <tr>
            <th scope="col" className="px-5 py-3 font-semibold">Specification</th>
            <th scope="col" className="px-5 py-3 font-semibold">Detail</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {specs.map((spec) => (
            <tr key={spec.label} className="align-top">
              <th scope="row" className="w-2/5 px-5 py-4 font-medium text-ink">{spec.label}</th>
              <td className="px-5 py-4">
                {spec.verifiedValue ? (
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-ink">{spec.verifiedValue}</span>
                    <span className="inline-flex w-fit items-center gap-1 rounded-sm bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800 ring-1 ring-emerald-200">
                      <BadgeCheckIcon size={12} aria-hidden="true" /> Verified spec
                    </span>
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <CircleDashedIcon size={14} className="shrink-0 text-gold-deep" aria-hidden="true" />
                    Varies by operator — confirmed in your quote
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
