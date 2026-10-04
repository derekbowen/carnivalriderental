import type { Option } from '../types/request';

export const flexibilityOptions: Option[] = [
  {
    value: 'exact',
    label: 'Only this ride',
    description: "We source this ride type and tell you if it can't be found for your date.",
  },
  {
    value: 'similar',
    label: 'This ride or a close alternative',
    description: 'Recommended — gives us more operators to source from.',
  },
  {
    value: 'open',
    label: 'Open to recommendations',
    description: "Tell us the goal and we'll propose rides that fit.",
  },
];

export const attendanceOptions: Option[] = [
  { value: 'under-500', label: 'Under 500' },
  { value: '500-2000', label: '500–2,000' },
  { value: '2000-10000', label: '2,000–10,000' },
  { value: '10000-plus', label: '10,000+' },
];

export const accessOptions: Option[] = [
  { value: 'truck', label: 'Paved access for large trucks' },
  { value: 'limited', label: 'Limited or restricted access' },
  { value: 'soft', label: 'Grass or soft ground only' },
  { value: 'not-sure', label: 'Not sure', description: "We'll ask during sourcing.", notSure: true },
];

export const spaceOptions: Option[] = [
  { value: 'under-2500', label: 'Under 2,500 sq ft' },
  { value: '2500-6000', label: '2,500–6,000 sq ft' },
  { value: '6000-15000', label: '6,000–15,000 sq ft' },
  { value: '15000-plus', label: '15,000+ sq ft' },
  { value: 'not-sure', label: 'Not sure', description: 'A site map later is fine.', notSure: true },
];

export const powerOptions: Option[] = [
  { value: 'dedicated', label: 'Dedicated power on site' },
  { value: 'standard', label: 'Standard outlets only' },
  { value: 'none', label: 'No power — generator needed' },
  { value: 'not-sure', label: 'Not sure', description: "We'll confirm with the operator.", notSure: true },
];

export const budgetOptions: Option[] = [
  { value: 'under-5k', label: 'Under $5,000' },
  { value: '5k-15k', label: '$5,000–$15,000' },
  { value: '15k-40k', label: '$15,000–$40,000' },
  { value: '40k-100k', label: '$40,000–$100,000' },
  { value: '100k-plus', label: '$100,000+' },
  { value: 'not-sure', label: 'Not sure yet', notSure: true },
];

export const contactPreferenceOptions: Option[] = [
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone call' },
];

export const dateModeOptions: Option[] = [
  { value: 'single', label: 'Single date' },
  { value: 'range', label: 'Date range or flexible' },
];
