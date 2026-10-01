import React from 'react';
import { formatUSD } from '../utils/currency';

interface EstimateRangeProps {
  low: number;
  high: number;
  size?: 'sm' | 'lg';
}

export function EstimateRange({ low, high, size = 'sm' }: EstimateRangeProps) {
  if (size === 'lg') {
    return (
      <div>
        <p className="text-sm text-ink-muted">Estimate from</p>
        <p className="mt-1 font-display text-[34px] leading-tight text-ink">
          {formatUSD(low)} – {formatUSD(high)}
        </p>
        <p className="mt-1 text-sm text-ink-muted">Planning estimate, not a quote</p>
      </div>);

  }
  return (
    <div>
      <p className="text-[15px] text-ink">
        <span className="text-ink-muted">Estimate from </span>
        <span className="font-semibold">
          {formatUSD(low)} – {formatUSD(high)}
        </span>
      </p>
      <p className="text-xs text-ink-muted">(planning estimate, not a quote)</p>
    </div>);

}