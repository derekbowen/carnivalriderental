export type Option = {
  value: string;
  label: string;
  description?: string;
  notSure?: boolean;
};

export type EventRequestDraft = {
  rideSlug: string;
  flexibility: string;
  rideNotes: string;
  dateMode: 'single' | 'range';
  dateStart: string;
  dateEnd: string;
  city: string;
  state: string;
  venue: string;
  hoursStart: string;
  hoursEnd: string;
  eventType: string;
  attendance: string;
  access: string;
  space: string;
  power: string;
  budget: string;
  siteNotes: string;
  name: string;
  organization: string;
  role: string;
  email: string;
  phone: string;
  contactPreference: string;
};

export type FieldErrors = Partial<Record<keyof EventRequestDraft | 'acknowledged', string>>;

export type UpdateDraft = <K extends keyof EventRequestDraft>(key: K, value: EventRequestDraft[K]) => void;

export type StepProps = {
  draft: EventRequestDraft;
  update: UpdateDraft;
  errors: FieldErrors;
};

export type SubmittedRequest = {
  reference: string;
  submittedAt: string;
  draft: EventRequestDraft;
};

export type PaymentStatus = 'Not started' | 'Card saved' | 'Authorized' | 'Paid';

export type CustomerStatus = {
  reference: string;
  rideName: string;
  rideSlug: string | null;
  eventDateLabel: string;
  location: string;
  venue: string;
  eventType: string;
  attendance: string;
  /** Number of fulfillment stages fully completed (0–6). */
  completedStages: number;
  stageDates: (string | null)[];
  payment: PaymentStatus;
  paymentNote: string;
  estimate: { min: number; max: number } | null;
  acceptedQuote: number | null;
  latestUpdate: string;
  coordinator: string;
};

export type SupplierStage = 'Researched' | 'Contacted' | 'Verified' | 'Quoted' | 'Committed';

export type QuoteLines = {
  supplierQuote: number | null;
  transport: number | null;
  setupCrew: number | null;
  other: number | null;
  paymentCosts: number | null;
};

export type Supplier = {
  id: string;
  name: string;
  region: string;
  stage: SupplierStage;
  note: string;
  quote: QuoteLines | null;
};

export type InternalStatus =
  | 'New'
  | 'Sourcing'
  | 'Quote drafting'
  | 'Quote sent'
  | 'Quote accepted'
  | 'Operator committed'
  | 'Booking confirmed'
  | 'Closed — not booked';

export type InternalRequest = {
  reference: string;
  receivedAt: string;
  eventDate: string;
  eventDateEnd?: string;
  city: string;
  state: string;
  rideName: string;
  flexibility: string;
  budget: string;
  status: InternalStatus;
  nextAction: string;
  coordinator: string;
  eventType: string;
  attendance: string;
  venue: string;
  hours: string;
  site: { access: string; space: string; power: string };
  contact: { name: string; organization: string; role: string; email: string; phone: string };
  notes: string;
  suppliers: Supplier[];
  customerPrice: number | null;
  payment: PaymentStatus;
};
