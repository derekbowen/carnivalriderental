import { budgetRanges } from '../data/filters';
import type { EventSize, Ride, Setting } from '../types/ride';

export type RideFilters = {
  category: string;
  sizes: EventSize[];
  budget: string;
  settings: Setting[];
};

export const emptyFilters: RideFilters = { category: 'all', sizes: [], budget: 'any', settings: [] };

export function filterRides(list: Ride[], filters: RideFilters): Ride[] {
  const range = budgetRanges.find((b) => b.value === filters.budget);
  return list.filter((ride) => {
    if (filters.category !== 'all' && ride.categoryId !== filters.category) return false;
    if (filters.sizes.length && !filters.sizes.some((s) => ride.eventSizes.includes(s))) return false;
    if (filters.settings.length && !filters.settings.every((s) => ride.settings.includes(s))) return false;
    if (range && range.value !== 'any' && (ride.estimateMax < range.min || ride.estimateMin > range.max)) return false;
    return true;
  });
}

export function countActiveFilters(filters: RideFilters): number {
  return (
    (filters.category !== 'all' ? 1 : 0) +
    filters.sizes.length +
    (filters.budget !== 'any' ? 1 : 0) +
    filters.settings.length
  );
}
