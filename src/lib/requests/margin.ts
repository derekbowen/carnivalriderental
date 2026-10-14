import type { SupplierQuote } from "./types";

/**
 * Projected contribution margin. INTERNAL ONLY.
 * Unknown components stay unknown: the margin is then reported as an upper bound
 * ("before unknown costs"), never as a final figure, and never as guaranteed profit.
 */
export interface MarginProjection {
  customerPriceCents: number | null;
  components: { label: string; cents: number | null }[];
  knownCostsCents: number;
  unknownComponents: string[];
  /** Customer price minus known costs. null if there is no customer price. */
  marginBeforeUnknownsCents: number | null;
  isComplete: boolean;
}

export function projectMargin(
  customerPriceCents: number | null,
  supplierQuote: SupplierQuote | null,
  paymentCostCents: number | null,
): MarginProjection {
  const components = [
    { label: "Supplier quote", cents: supplierQuote?.supplierPriceCents ?? null },
    { label: "Transport & mobilization", cents: supplierQuote?.transportCents ?? null },
    { label: "Setup, teardown & operating crew", cents: supplierQuote?.crewCents ?? null },
    { label: "Other fulfilment costs", cents: supplierQuote?.otherCents ?? null },
    { label: "Payment processing costs", cents: paymentCostCents },
  ];
  const known = components.filter((c) => c.cents !== null).reduce((s, c) => s + (c.cents as number), 0);
  const unknown = components.filter((c) => c.cents === null).map((c) => c.label);
  return {
    customerPriceCents,
    components,
    knownCostsCents: known,
    unknownComponents: unknown,
    marginBeforeUnknownsCents: customerPriceCents === null ? null : customerPriceCents - known,
    isComplete: customerPriceCents !== null && unknown.length === 0,
  };
}
