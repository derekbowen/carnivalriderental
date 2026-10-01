export type EventTypeIcon = 'building' | 'landmark' | 'graduation' | 'tent' | 'party';

export const eventTypes: { value: string; label: string; icon: EventTypeIcon; description: string }[] = [
  {
    value: 'corporate',
    label: 'Corporate',
    icon: 'building',
    description: 'Company picnics, brand activations and employee appreciation days.',
  },
  {
    value: 'municipal',
    label: 'Municipal',
    icon: 'landmark',
    description: 'City festivals, holiday markets and park-district celebrations.',
  },
  {
    value: 'school',
    label: 'Schools & colleges',
    icon: 'graduation',
    description: 'Homecoming, orientation weeks, graduations and fundraisers.',
  },
  {
    value: 'festival',
    label: 'Festivals',
    icon: 'tent',
    description: 'Multi-day fairs and music or food festivals that need a midway.',
  },
  {
    value: 'private',
    label: 'Private events',
    icon: 'party',
    description: 'Weddings, milestone celebrations and private estate events.',
  },
];
