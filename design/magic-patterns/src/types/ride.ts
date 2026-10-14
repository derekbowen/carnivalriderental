export type RideCategoryId =
'ferris-wheels' |
'carousels' |
'swing-rides' |
'kiddie-rides' |
'packages';

export type AvailabilityStatus = 'sourcing' | 'verified';

export type EventSizeId = 'under-500' | '500-2000' | '2000-10000' | '10000-plus';

export interface RideCategory {
  id: RideCategoryId;
  name: string;
  description: string;
  comingLater?: boolean;
}

export interface RideSpec {
  label: string;
  value: string | null;
  basis?: 'typical' | 'verified';
}

export interface SuitabilityItem {
  audience: string;
  fit: 'Strong fit' | 'Good fit' | 'Limited fit';
  note: string;
}

export interface Listing {
  id: string;
  rideSlug: string;
  base: string;
  state: string;
  detail: string;
}

export interface Ride {
  id: string;
  slug: string;
  name: string;
  categoryId: RideCategoryId;
  summary: string;
  description: string[];
  estimateLow: number;
  estimateHigh: number;
  estimateBasis: string;
  availability: AvailabilityStatus;
  eventSizes: EventSizeId[];
  sourcingStates: string[];
  leadTime: string;
  specs: RideSpec[];
  suitability: SuitabilityItem[];
}