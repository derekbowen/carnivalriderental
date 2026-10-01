import type { Ride } from '../types/ride';

export const rides: Ride[] = [
{
  id: 'r1',
  slug: 'giant-observation-wheel',
  name: 'Giant Observation Wheel',
  categoryId: 'ferris-wheels',
  summary: 'A 30 m-class enclosed-gondola wheel that anchors a large festival or civic event.',
  description: [
  'Large observation wheels are the single most recognizable ride you can bring to an event. Enclosed gondolas make them suitable for evening programming, mixed-age groups and VIP hospitality.',
  'These units travel on multiple trailers and need a level, well-compacted site with clear truck access. We confirm footprint, ground loading and power with the operator before any quote is issued.'],

  estimateLow: 28000,
  estimateHigh: 55000,
  estimateBasis: 'per event, typically 2–4 operating days',
  availability: 'sourcing',
  eventSizes: ['2000-10000', '10000-plus'],
  sourcingStates: ['CA', 'TX', 'FL', 'IL', 'NY', 'OH', 'PA', 'GA'],
  leadTime: '12–16 weeks recommended',
  specs: [
  { label: 'Approx. height', value: '28–34 m', basis: 'typical' },
  { label: 'Footprint', value: null },
  { label: 'Riders per rotation', value: '144–216', basis: 'typical' },
  { label: 'Power requirement', value: null },
  { label: 'Setup time', value: '2–3 days', basis: 'typical' },
  { label: 'Minimum rider height', value: null },
  { label: 'Ground surface', value: 'Level, compacted or paved', basis: 'typical' },
  { label: 'Operating crew', value: null }],

  suitability: [
  { audience: 'Festivals & civic events', fit: 'Strong fit', note: 'Visible landmark that draws foot traffic across a site.' },
  { audience: 'Corporate events', fit: 'Good fit', note: 'Works well for evening hospitality with enclosed gondolas.' },
  { audience: 'Schools & colleges', fit: 'Limited fit', note: 'Footprint and lead time usually exceed campus event needs.' }]

},
{
  id: 'r2',
  slug: 'classic-ferris-wheel',
  name: 'Classic Ferris Wheel',
  categoryId: 'ferris-wheels',
  summary: 'An 18–20 m open-seat wheel — the traditional fairground silhouette at a manageable scale.',
  description: [
  'A classic wheel gives an event its skyline without the logistics of an observation wheel. Most units arrive on a single trailer and set up within a day.',
  'Open seating suits daytime and fair-weather events. We confirm the specific unit, its inspection records and the operating crew during sourcing.'],

  estimateLow: 9500,
  estimateHigh: 18000,
  estimateBasis: 'per event, typically 1–3 operating days',
  availability: 'sourcing',
  eventSizes: ['500-2000', '2000-10000', '10000-plus'],
  sourcingStates: ['CA', 'TX', 'FL', 'IL', 'NY', 'OH', 'PA', 'GA', 'MI', 'NC', 'AZ'],
  leadTime: '8–12 weeks recommended',
  specs: [
  { label: 'Approx. height', value: '18–20 m', basis: 'typical' },
  { label: 'Footprint', value: 'Approx. 18 × 12 m', basis: 'typical' },
  { label: 'Riders per rotation', value: '32–48', basis: 'typical' },
  { label: 'Power requirement', value: null },
  { label: 'Setup time', value: '6–10 hours', basis: 'typical' },
  { label: 'Minimum rider height', value: null },
  { label: 'Ground surface', value: 'Level paved or firm grass', basis: 'typical' },
  { label: 'Operating crew', value: null }],

  suitability: [
  { audience: 'Festivals & civic events', fit: 'Strong fit', note: 'Recognizable centerpiece at a realistic footprint.' },
  { audience: 'Corporate events', fit: 'Strong fit', note: 'Popular for summer parties and brand activations.' },
  { audience: 'Schools & colleges', fit: 'Good fit', note: 'Suits homecoming and spring events with open fields.' }]

},
{
  id: 'r3',
  slug: 'double-deck-venetian-carousel',
  name: 'Double-Deck Venetian Carousel',
  categoryId: 'carousels',
  summary: 'An ornate two-level carousel that works as both a ride and a set piece.',
  description: [
  'Double-deck carousels are among the most photographed rides at any event. Their decoration and lighting make them a natural focal point for evening programming and hospitality areas.',
  'They require a level site, significant setup time and a larger crew than single-deck carousels. Availability of these units is limited, so early requests are strongly advised.'],

  estimateLow: 16000,
  estimateHigh: 32000,
  estimateBasis: 'per event, typically 2–4 operating days',
  availability: 'sourcing',
  eventSizes: ['2000-10000', '10000-plus'],
  sourcingStates: ['CA', 'FL', 'NY', 'IL', 'TX', 'NJ'],
  leadTime: '12–16 weeks recommended',
  specs: [
  { label: 'Approx. height', value: '10–12 m', basis: 'typical' },
  { label: 'Footprint', value: null },
  { label: 'Riders per rotation', value: '60–80', basis: 'typical' },
  { label: 'Power requirement', value: null },
  { label: 'Setup time', value: '1–2 days', basis: 'typical' },
  { label: 'Minimum rider height', value: null },
  { label: 'Ground surface', value: 'Level paved preferred', basis: 'typical' },
  { label: 'Operating crew', value: null }],

  suitability: [
  { audience: 'Festivals & civic events', fit: 'Strong fit', note: 'Draws all ages and photographs well.' },
  { audience: 'Corporate events', fit: 'Strong fit', note: 'Works as a ride and a backdrop for hospitality.' },
  { audience: 'Private events', fit: 'Good fit', note: 'Best for large estates with paved access.' }]

},
{
  id: 'r4',
  slug: 'heritage-carousel',
  name: 'Heritage Carousel',
  categoryId: 'carousels',
  summary: 'A single-deck carousel for 30–36 riders, suited to mixed-age crowds.',
  description: [
  'A single-deck carousel is the most versatile ride for events where guests range from toddlers to grandparents. It sets up quickly and fits on most paved or level grass sites.',
  'We confirm the unit, its decoration style and seating configuration with the operator once your dates and venue are known.'],

  estimateLow: 6500,
  estimateHigh: 12500,
  estimateBasis: 'per event, typically 1–3 operating days',
  availability: 'sourcing',
  eventSizes: ['under-500', '500-2000', '2000-10000'],
  sourcingStates: ['CA', 'TX', 'FL', 'IL', 'NY', 'OH', 'PA', 'GA', 'MI', 'NC', 'WA', 'CO'],
  leadTime: '6–10 weeks recommended',
  specs: [
  { label: 'Approx. height', value: '6–8 m', basis: 'typical' },
  { label: 'Footprint', value: 'Approx. 12 m diameter', basis: 'typical' },
  { label: 'Riders per rotation', value: '30–36', basis: 'typical' },
  { label: 'Power requirement', value: null },
  { label: 'Setup time', value: '4–8 hours', basis: 'typical' },
  { label: 'Minimum rider height', value: null },
  { label: 'Ground surface', value: 'Level paved or firm grass', basis: 'typical' },
  { label: 'Operating crew', value: null }],

  suitability: [
  { audience: 'Schools & colleges', fit: 'Strong fit', note: 'Inclusive ride that suits family days and fairs.' },
  { audience: 'Private events', fit: 'Strong fit', note: 'Compact enough for many private venues.' },
  { audience: 'Corporate events', fit: 'Good fit', note: 'Good choice for family days and holiday events.' }]

},
{
  id: 'r5',
  slug: 'wave-swinger',
  name: 'Wave Swinger',
  categoryId: 'swing-rides',
  summary: 'A tilting chair swing with strong hourly throughput and a lively evening presence.',
  description: [
  'Wave swingers move a lot of guests per hour, which makes them useful for events where queue length matters. The tilting canopy and lighting give them presence after dark.',
  'Rider height and weight limits vary by unit. We confirm these with the operator before quoting, so your guest communications are accurate.'],

  estimateLow: 8500,
  estimateHigh: 16000,
  estimateBasis: 'per event, typically 1–3 operating days',
  availability: 'sourcing',
  eventSizes: ['500-2000', '2000-10000', '10000-plus'],
  sourcingStates: ['CA', 'TX', 'FL', 'IL', 'OH', 'PA', 'GA', 'MI'],
  leadTime: '8–12 weeks recommended',
  specs: [
  { label: 'Approx. height', value: '9–12 m', basis: 'typical' },
  { label: 'Footprint', value: null },
  { label: 'Riders per cycle', value: '48', basis: 'typical' },
  { label: 'Power requirement', value: null },
  { label: 'Setup time', value: '6–10 hours', basis: 'typical' },
  { label: 'Minimum rider height', value: null },
  { label: 'Ground surface', value: 'Level paved or compacted', basis: 'typical' },
  { label: 'Operating crew', value: null }],

  suitability: [
  { audience: 'Festivals & civic events', fit: 'Strong fit', note: 'High throughput keeps queues moving.' },
  { audience: 'Schools & colleges', fit: 'Good fit', note: 'Popular with older students; check height limits.' },
  { audience: 'Corporate events', fit: 'Good fit', note: 'Adds energy to evening programs.' }]

},
{
  id: 'r6',
  slug: 'tower-swing',
  name: 'Tower Swing',
  categoryId: 'swing-rides',
  summary: 'A 40 m-class rotating tower swing — a vertical landmark for large-scale events.',
  description: [
  'Tower swings deliver height and spectacle on a relatively compact base. They are a strong alternative to an observation wheel where site depth is limited.',
  'These are specialist units with limited availability nationally. Sourcing typically involves a longer verification process, including structural inspection documentation.'],

  estimateLow: 22000,
  estimateHigh: 42000,
  estimateBasis: 'per event, typically 2–4 operating days',
  availability: 'sourcing',
  eventSizes: ['10000-plus'],
  sourcingStates: ['CA', 'TX', 'FL', 'IL', 'NY'],
  leadTime: '14–20 weeks recommended',
  specs: [
  { label: 'Approx. height', value: null },
  { label: 'Footprint', value: null },
  { label: 'Riders per cycle', value: '24–32', basis: 'typical' },
  { label: 'Power requirement', value: null },
  { label: 'Setup time', value: '1–2 days', basis: 'typical' },
  { label: 'Minimum rider height', value: null },
  { label: 'Ground surface', value: null },
  { label: 'Operating crew', value: null }],

  suitability: [
  { audience: 'Festivals & civic events', fit: 'Strong fit', note: 'Built for large crowds and long operating days.' },
  { audience: 'Corporate events', fit: 'Limited fit', note: 'Usually oversized for corporate programs.' },
  { audience: 'Schools & colleges', fit: 'Limited fit', note: 'Height limits exclude many younger guests.' }]

},
{
  id: 'r7',
  slug: 'kiddie-ferris-wheel',
  name: 'Kiddie Ferris Wheel',
  categoryId: 'kiddie-rides',
  summary: 'A compact enclosed-tub wheel sized for younger guests and tighter sites.',
  description: [
  'A small-format wheel gives younger guests their own version of the headline ride. It fits on most paved areas and sets up in a few hours.',
  'Ideal alongside a carousel for family days. We confirm age and height guidance with the operator so you can communicate it clearly.'],

  estimateLow: 2800,
  estimateHigh: 5500,
  estimateBasis: 'per event day',
  availability: 'sourcing',
  eventSizes: ['under-500', '500-2000', '2000-10000'],
  sourcingStates: ['CA', 'TX', 'FL', 'IL', 'NY', 'OH', 'PA', 'GA', 'MI', 'NC', 'WA', 'CO', 'AZ', 'VA'],
  leadTime: '4–8 weeks recommended',
  specs: [
  { label: 'Approx. height', value: '5–7 m', basis: 'typical' },
  { label: 'Footprint', value: 'Approx. 7 × 5 m', basis: 'typical' },
  { label: 'Riders per rotation', value: '12–20', basis: 'typical' },
  { label: 'Power requirement', value: null },
  { label: 'Setup time', value: '2–4 hours', basis: 'typical' },
  { label: 'Maximum rider height', value: null },
  { label: 'Ground surface', value: 'Level paved preferred', basis: 'typical' },
  { label: 'Operating crew', value: null }],

  suitability: [
  { audience: 'Schools & colleges', fit: 'Strong fit', note: 'Suited to elementary family nights and fairs.' },
  { audience: 'Private events', fit: 'Strong fit', note: 'Fits most private venues and driveways.' },
  { audience: 'Festivals & civic events', fit: 'Good fit', note: 'Pairs well with a dedicated family zone.' }]

},
{
  id: 'r8',
  slug: 'trackless-kiddie-train',
  name: 'Trackless Kiddie Train',
  categoryId: 'kiddie-rides',
  summary: 'A road-going mini train that can loop a site or run a fixed route.',
  description: [
  'Trackless trains double as a ride and a way to move small guests around a site. They need a firm, continuous route rather than a fixed footprint.',
  'Route length and surface are confirmed during sourcing, along with driver arrangements from the operator.'],

  estimateLow: 2200,
  estimateHigh: 4800,
  estimateBasis: 'per event day',
  availability: 'sourcing',
  eventSizes: ['under-500', '500-2000', '2000-10000'],
  sourcingStates: ['CA', 'TX', 'FL', 'IL', 'NY', 'OH', 'PA', 'GA', 'NC', 'VA', 'MA'],
  leadTime: '4–6 weeks recommended',
  specs: [
  { label: 'Approx. length', value: '9–12 m', basis: 'typical' },
  { label: 'Route requirement', value: null },
  { label: 'Riders per trip', value: '16–24', basis: 'typical' },
  { label: 'Power requirement', value: 'Battery or petrol (unit-dependent)', basis: 'typical' },
  { label: 'Setup time', value: 'Under 1 hour', basis: 'typical' },
  { label: 'Maximum rider height', value: null },
  { label: 'Ground surface', value: 'Paved or firm path', basis: 'typical' },
  { label: 'Operating crew', value: null }],

  suitability: [
  { audience: 'Schools & colleges', fit: 'Strong fit', note: 'Simple to stage on campus paths.' },
  { audience: 'Private events', fit: 'Good fit', note: 'Needs a continuous paved route.' },
  { audience: 'Corporate events', fit: 'Good fit', note: 'Useful for family days across larger campuses.' }]

}];