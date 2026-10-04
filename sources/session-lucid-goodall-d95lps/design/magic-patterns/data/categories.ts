import type { RideCategory } from '../types/ride';

export const categories: RideCategory[] = [
  {
    id: 'ferris-wheels',
    name: 'Ferris wheels',
    glyph: 'ferris',
    blurb: 'A skyline centerpiece for civic festivals, campus nights and brand moments.',
    estimateFrom: 6500,
  },
  {
    id: 'carousels',
    name: 'Carousels',
    glyph: 'carousel',
    blurb: 'Timeless and photogenic, suited to plazas, markets and large halls.',
    estimateFrom: 4500,
  },
  {
    id: 'swing-rides',
    name: 'Swing rides',
    glyph: 'swing',
    blurb: 'High-visibility motion that draws a crowd across an open site.',
    estimateFrom: 3800,
  },
  {
    id: 'family-kiddie',
    name: 'Family & kiddie rides',
    glyph: 'family',
    blurb: 'Gentle rides for younger guests and mixed-age audiences.',
    estimateFrom: 2500,
  },
  {
    id: 'packages',
    name: 'Full carnival packages',
    glyph: 'package',
    blurb: 'A coordinated midway of several rides, sourced and scheduled as one booking.',
    estimateFrom: 25000,
  },
];
