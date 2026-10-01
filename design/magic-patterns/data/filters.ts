import type { EventSize, Setting } from '../types/ride';

export const eventSizeOptions: { value: EventSize; label: string; hint: string }[] = [
  { value: 'small', label: 'Small', hint: 'Under 500 guests' },
  { value: 'medium', label: 'Medium', hint: '500–2,000 guests' },
  { value: 'large', label: 'Large', hint: '2,000–10,000 guests' },
  { value: 'festival', label: 'Festival', hint: '10,000+ guests' },
];

export const budgetRanges: { value: string; label: string; min: number; max: number }[] = [
  { value: 'any', label: 'Any budget', min: 0, max: Number.POSITIVE_INFINITY },
  { value: 'under-5k', label: 'Under $5,000', min: 0, max: 5000 },
  { value: '5k-15k', label: '$5,000–$15,000', min: 5000, max: 15000 },
  { value: '15k-40k', label: '$15,000–$40,000', min: 15000, max: 40000 },
  { value: '40k-plus', label: '$40,000+', min: 40000, max: Number.POSITIVE_INFINITY },
];

export const settingOptions: { value: Setting; label: string }[] = [
  { value: 'outdoor', label: 'Outdoor suitable' },
  { value: 'indoor', label: 'Indoor suitable' },
];
