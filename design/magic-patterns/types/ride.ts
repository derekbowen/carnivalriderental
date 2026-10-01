export type GlyphKind = 'ferris' | 'carousel' | 'swing' | 'family' | 'package';
export type EventSize = 'small' | 'medium' | 'large' | 'festival';
export type Setting = 'outdoor' | 'indoor';

export type RideCategory = {
  id: string;
  name: string;
  glyph: GlyphKind;
  blurb: string;
  estimateFrom: number;
};

/** A spec only carries a value when it has been verified. Otherwise it varies by operator. */
export type RideSpec = {
  label: string;
  verifiedValue?: string;
};

export type Ride = {
  slug: string;
  name: string;
  categoryId: string;
  rideType: string;
  glyph: GlyphKind;
  estimateMin: number;
  estimateMax: number;
  eventSizes: EventSize[];
  settings: Setting[];
  summary: string;
  description: string[];
  suitability: { label: string; note: string }[];
  specs: RideSpec[];
  gallery: string[];
};
