import React from 'react';
import { CircleDashedIcon } from 'lucide-react';
import type { RideSpec } from '../../types/ride';

interface SpecsTableProps {
  specs: RideSpec[];
}

export function SpecsTable({ specs }: SpecsTableProps) {
  return (
    <section aria-labelledby="specs-heading">
      <h2 id="specs-heading" className="font-display text-3xl text-ink">
        Specifications
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
        Specifications are confirmed with the operator for the specific unit sourced for your event. Values marked
        “Typical” are norms for this ride type, not verified figures for a particular unit.
      </p>
      <div className="mt-6 overflow-hidden rounded-xl border border-line bg-surface">
        <table className="w-full text-left text-[15px]">
          <caption className="sr-only">Ride specifications</caption>
          <tbody className="divide-y divide-line">
            {specs.map((spec) =>
            <tr key={spec.label}>
                <th scope="row" className="w-2/5 px-5 py-3.5 font-medium text-ink-soft">
                  {spec.label}
                </th>
                <td className="px-5 py-3.5">
                  {spec.value ?
                <span className="flex flex-wrap items-center gap-2 text-ink">
                      {spec.value}
                      {spec.basis === 'typical' &&
                  <span className="rounded border border-line-strong px-1.5 py-0.5 text-[11px] font-medium text-ink-muted">
                          Typical
                        </span>
                  }
                    </span> :

                <span className="inline-flex items-center gap-1.5 text-ink-muted">
                      <CircleDashedIcon className="h-4 w-4" aria-hidden="true" />
                      Not yet verified
                    </span>
                }
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>);

}