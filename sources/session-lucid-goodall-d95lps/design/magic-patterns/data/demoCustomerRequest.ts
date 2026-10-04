import type { CustomerStatus } from '../types/request';

export const demoCustomerRequest: CustomerStatus = {
  reference: 'BAC-24817',
  rideName: 'Grand Ferris wheel',
  rideSlug: 'grand-ferris-wheel',
  eventDateLabel: 'Sat, Nov 14, 2026',
  location: 'Columbus, OH',
  venue: 'Riverside Civic Plaza',
  eventType: 'Municipal',
  attendance: '2,000–10,000 guests',
  completedStages: 4,
  stageDates: ['Sep 18, 2026', 'Sep 19, 2026', 'Sep 25, 2026', 'Sep 29, 2026', null, null],
  payment: 'Card saved',
  paymentNote: 'Your card is saved on file. No charge has been made.',
  estimate: { min: 12000, max: 28000 },
  acceptedQuote: 18450,
  latestUpdate:
    "You accepted the quote on Sep 29. We're now confirming a written commitment from the operator for Nov 14. Your booking is not confirmed until that commitment is in place.",
  coordinator: 'Jordan Ellis',
};
