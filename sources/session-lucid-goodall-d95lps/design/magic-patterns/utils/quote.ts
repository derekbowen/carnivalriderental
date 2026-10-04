import type { QuoteLines, Supplier } from '../types/request';

export function summarizeQuote(quote: QuoteLines): { knownTotal: number; unknownCount: number } {
  const values = Object.values(quote) as (number | null)[];
  const known = values.filter((v): v is number => v !== null);
  return { knownTotal: known.reduce((a, b) => a + b, 0), unknownCount: values.length - known.length };
}

export function projectedContribution(
  customerPrice: number | null,
  quote: QuoteLines | null,
): { amount: number; unknownCount: number } | null {
  if (customerPrice === null || !quote) return null;
  const summary = summarizeQuote(quote);
  return { amount: customerPrice - summary.knownTotal, unknownCount: summary.unknownCount };
}

/** The supplier whose quote currently drives pricing: committed first, then quoted. */
export function leadSupplier(suppliers: Supplier[]): Supplier | null {
  return (
    suppliers.find((s) => s.stage === 'Committed' && s.quote) ??
    suppliers.find((s) => s.stage === 'Quoted' && s.quote) ??
    null
  );
}
