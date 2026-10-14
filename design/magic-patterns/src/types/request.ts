export interface EventRequestForm {
  rideSlug: string;
  startDate: string;
  endDate: string;
  dailyHours: string;
  datesFlexible: boolean;
  city: string;
  state: string;
  venueName: string;
  venueType: string;
  attendance: string;
  space: string;
  surface: string;
  power: string;
  access: string;
  siteNotes: string;
  name: string;
  organization: string;
  orgType: string;
  email: string;
  phone: string;
  budget: string;
  notes: string;
}

export type FormErrors = Partial<Record<keyof EventRequestForm, string>>;

export type TrackStepState = 'done' | 'current' | 'upcoming';

export interface TrackStep {
  label: string;
  description: string;
  date?: string;
}

export type PriceKind = 'estimate' | 'accepted';

export type InternalStatus =
'New' |
'Sourcing' |
'Awaiting supplier quote' |
'Quote drafted' |
'Quote sent' |
'Accepted' |
'Confirmed';

export type OperatorAnswer = 'Yes' | 'No' | 'Awaiting answer' | 'Not called';

export interface SupplierCandidate {
  name: string;
  base: string;
  distanceMi: number;
  offer: number | null;
  answer: OperatorAnswer;
  lastTouch: string;
  note: string;
}

export interface CostLine {
  label: string;
  detail: string;
  amount: number | null;
}

export interface InternalRequest {
  reference: string;
  rideName: string;
  eventDate: string;
  eventDays: number;
  city: string;
  state: string;
  status: InternalStatus;
  nextAction: string;
  owner: string;
  customerOrg: string;
  orgType: string;
  attendance: string;
  venue: string;
  space: string;
  power: string;
  access: string;
  budget: string;
  brief: string;
  candidates: SupplierCandidate[];
  costs: CostLine[];
  customerPrice: number | null;
  customerPriceKind: PriceKind;
}