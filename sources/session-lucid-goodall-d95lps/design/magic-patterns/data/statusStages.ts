import type { InternalStatus, PaymentStatus, SupplierStage } from '../types/request';

export const fulfillmentStages = [
  { id: 'submitted', label: 'Request submitted', description: 'We have your event brief.' },
  {
    id: 'sourcing',
    label: 'Sourcing operators',
    description: 'Our team is contacting carnival operators who may serve your date and site.',
  },
  {
    id: 'quote-sent',
    label: 'Quote sent',
    description: 'A written quote covering ride, crew, transport and setup is sent to you.',
  },
  { id: 'quote-accepted', label: 'Quote accepted', description: 'You accept the final scope and price.' },
  {
    id: 'operator-committed',
    label: 'Operator committed',
    description: 'A specific operator commits to your date in writing.',
  },
  {
    id: 'confirmed',
    label: 'Booking confirmed',
    description: 'Your booking is confirmed. We coordinate logistics through event day.',
  },
];

export const paymentStatuses: PaymentStatus[] = ['Not started', 'Card saved', 'Authorized', 'Paid'];

export const internalStatuses: InternalStatus[] = [
  'New',
  'Sourcing',
  'Quote drafting',
  'Quote sent',
  'Quote accepted',
  'Operator committed',
  'Booking confirmed',
  'Closed — not booked',
];

export const supplierStages: SupplierStage[] = ['Researched', 'Contacted', 'Verified', 'Quoted', 'Committed'];

export const quoteLineLabels: { key: 'supplierQuote' | 'transport' | 'setupCrew' | 'other' | 'paymentCosts'; label: string }[] = [
  { key: 'supplierQuote', label: 'Supplier quote' },
  { key: 'transport', label: 'Transport & mobilization' },
  { key: 'setupCrew', label: 'Setup/teardown & crew' },
  { key: 'other', label: 'Other costs' },
  { key: 'paymentCosts', label: 'Payment costs' },
];
