import type { CostLine } from '../types/request';

export interface MarginSummary {
  knownCost: number;
  unknownCount: number;
  margin: number | null;
  marginPct: number | null;
}

export function summarizeMargin(costs: CostLine[], customerPrice: number | null): MarginSummary {
  const knownCost = costs.reduce((sum, line) => sum + (line.amount ?? 0), 0);
  const unknownCount = costs.filter((line) => line.amount === null).length;
  if (customerPrice === null || costs.length === 0) {
    return { knownCost, unknownCount, margin: null, marginPct: null };
  }
  const margin = customerPrice - knownCost;
  return { knownCost, unknownCount, margin, marginPct: margin / customerPrice * 100 };
}