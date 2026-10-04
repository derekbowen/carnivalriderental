/**
 * Event request / fulfilment domain.
 *
 * Source of truth (session one): the development SQLite store (src/lib/requests/repo.ts).
 * Fulfilment status and payment status are SEPARATE tracks and are never inferred
 * from each other.
 */

export const FULFILMENT_STATUSES = [
  "submitted", // customer sent the brief
  "in_review", // our team is reviewing the brief
  "sourcing", // we are contacting operators
  "quote_sent", // a customer quote version is awaiting the customer
  "quote_accepted", // customer accepted the current quote version
  "supplier_committed", // an operator has committed this unit/crew to this event
  "confirmed", // booking confirmed under the approved payment policy
  "unable_to_source", // terminal
  "declined", // terminal: we declined the request
  "cancelled", // terminal: customer withdrew
] as const;
export type FulfilmentStatus = (typeof FULFILMENT_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "none", // nothing collected or saved
  "payment_method_saved", // a payment method is on file — NOT money reserved
  "funds_authorized", // an amount is authorized (card auths expire ~7 days)
  "payment_captured", // money collected
  "refunded",
  "failed",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Global supplier relationship (independent of any event). */
export const SUPPLIER_RELATIONSHIPS = ["researched_prospect", "contacted", "verified_supplier"] as const;
export type SupplierRelationship = (typeof SUPPLIER_RELATIONSHIPS)[number];

/** A supplier's stage for ONE event request. */
export const CANDIDATE_STAGES = ["candidate", "contacted", "quoted", "committed", "declined"] as const;
export type CandidateStage = (typeof CANDIDATE_STAGES)[number];

export const QUOTE_STATUSES = ["draft", "sent", "accepted", "superseded", "withdrawn"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export interface EventBrief {
  rideSlug: string | null;
  rideFlexibility: "this_ride_only" | "open_to_similar" | "need_advice";
  eventDateStart: string; // YYYY-MM-DD
  eventDateEnd: string | null;
  dateFlexibility: "fixed" | "flexible";
  operatingHours: string | null;
  city: string;
  state: string; // two-letter code
  venueName: string | null;
  eventType: "corporate" | "municipal" | "school" | "college" | "festival" | "private" | "other";
  expectedAttendance: "under_500" | "500_2000" | "2000_10000" | "10000_plus" | "not_sure";
  budget: "under_10k" | "10k_25k" | "25k_50k" | "50k_plus" | "not_sure";
  siteSurface: "paved" | "grass" | "mixed" | "not_sure";
  availableSpace: string | null; // free text, null = not sure
  power: "available" | "not_available" | "not_sure";
  siteAccess: string | null; // free text, null = not sure
  notes: string | null;
  contact: { name: string; email: string; phone: string | null; organization: string | null };
}

export interface EventRequest {
  id: string;
  reference: string;
  createdAt: string;
  updatedAt: string;
  brief: EventBrief;
  fulfilmentStatus: FulfilmentStatus;
  paymentStatus: PaymentStatus;
  paymentMode: "demo";
  isTestData: boolean;
  assignedSupplierId: string | null;
  assignedUnitId: string | null;
}

export interface CustomerQuote {
  id: string;
  requestId: string;
  version: number;
  amountCents: number;
  scope: string;
  status: QuoteStatus;
  createdAt: string;
  sentAt: string | null;
  acceptedAt: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  relationship: SupplierRelationship;
  region: string | null;
  notes: string | null;
  isDemo: boolean;
}

export interface RideUnit {
  id: string;
  supplierId: string;
  rideSlug: string;
  description: string;
  homeBase: string | null;
  verification: "unverified" | "verified";
  isDemo: boolean;
}

export interface RequestSupplier {
  id: string;
  requestId: string;
  supplierId: string;
  unitId: string | null;
  stage: CandidateStage;
  notes: string | null;
  updatedAt: string;
}

/** All cents fields: null means UNKNOWN, never zero. */
export interface SupplierQuote {
  id: string;
  requestId: string;
  supplierId: string;
  supplierPriceCents: number | null;
  transportCents: number | null;
  crewCents: number | null;
  otherCents: number | null;
  notes: string | null;
  createdAt: string;
}

export interface StatusEvent {
  id: string;
  requestId: string;
  track: "fulfilment" | "payment" | "note";
  fromStatus: string | null;
  toStatus: string | null;
  actor: "customer" | "team" | "system";
  note: string | null;
  createdAt: string;
}
