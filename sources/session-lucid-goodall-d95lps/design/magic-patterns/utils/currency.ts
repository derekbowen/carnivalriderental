const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export function formatUSD(value: number): string {
  return usd.format(value);
}

export function formatRange(min: number, max: number): string {
  return `${formatUSD(min)}–${formatUSD(max)}`;
}

export function formatMaybeUSD(value: number | null): string {
  return value === null ? 'Unknown' : formatUSD(value);
}
