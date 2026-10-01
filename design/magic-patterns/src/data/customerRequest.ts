import type { PriceKind, TrackStep } from '../types/request';

export const customerRequest = {
  reference: 'BAC-2026-0148',
  rideName: 'Classic Ferris Wheel',
  rideSlug: 'classic-ferris-wheel',
  eventDates: 'Sat 12 – Sun 13 June 2027',
  location: 'Columbus, OH',
  venue: 'Riverside Commons (open lawn)',
  submittedOn: '18 Sep 2026',
  estimateLow: 9500,
  estimateHigh: 18000,
  priceKind: 'estimate' as PriceKind,
  availability: 'verified' as const,
  fulfilmentCurrent: 3,
  paymentCurrent: 0,
  contactName: 'Dana Whitfield',
  contactEmail: 'requests@bookacarnival.example'
};

export const fulfilmentTrack: TrackStep[] = [
{ label: 'Request received', description: 'Your event brief is with our fulfilment team.', date: '18 Sep' },
{ label: 'Offered to the closest operator', description: 'The closest listed wheel was taken that weekend, so we moved to the next closest.', date: '22 Sep' },
{ label: 'Operator said yes', description: 'An operator has confirmed your dates at our agreed price.', date: '29 Sep' },
{ label: 'Quote issued for your approval', description: 'We are preparing an itemized quote. You’ll be notified when it’s ready.' },
{ label: 'Scope & price approved', description: 'You review and accept the quote in writing.' },
{ label: 'Booking confirmed', description: 'Confirmed once the accepted payment terms are met.' },
{ label: 'Event delivered', description: 'Delivery, setup, operation and teardown on site.' }];


export const paymentTrack: TrackStep[] = [
{ label: 'No payment due', description: 'Nothing is charged while your request is being sourced and quoted.' },
{ label: 'Quote accepted', description: 'Payment terms are set out in the quote you accept.' },
{ label: 'Deposit invoiced', description: 'One invoice from Book a Carnival — we pay the operator.' },
{ label: 'Deposit received', description: 'Your booking is confirmed once this is received.' },
{ label: 'Balance invoiced', description: 'Timing follows your accepted terms.' },
{ label: 'Paid in full', description: 'All amounts settled.' }];


export const requestUpdates = [
{ date: '29 Sep 2026', text: 'Good news — an operator said yes to your dates. We’re finalizing crew costs before sending your final price.' },
{ date: '22 Sep 2026', text: 'The closest listed wheel is booked that weekend. We’ve moved to the next closest unit — no action needed from you.' },
{ date: '18 Sep 2026', text: 'Request received. Reference BAC-2026-0148 assigned.' }];