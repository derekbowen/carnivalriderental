import type { CustomerQuote, EventBrief, FulfilmentStatus, PaymentStatus } from "./types";

/** Customer-facing wording. Each label says only what is true at that stage. */
export const FULFILMENT_LABELS: Record<FulfilmentStatus, { title: string; detail: string }> = {
  submitted: { title: "Request received", detail: "We have your event brief. Nothing is booked yet." },
  in_review: { title: "Reviewing your brief", detail: "Our team is checking your requirements. Nothing is booked yet." },
  sourcing: { title: "Sourcing an operator", detail: "We are contacting operators who may be able to serve your event. Availability is not confirmed." },
  quote_sent: { title: "Quote ready for your review", detail: "Review the scope and price below. Accepting it does not by itself confirm the booking." },
  quote_accepted: { title: "Quote accepted", detail: "We are securing a firm commitment from the operator. Not yet confirmed." },
  supplier_committed: { title: "Operator committed", detail: "An operator has committed to your event. Confirmation follows once the agreed payment step is complete." },
  confirmed: { title: "Booking confirmed", detail: "Your booking is confirmed under the agreed terms." },
  unable_to_source: { title: "Unable to source", detail: "We could not find suitable equipment for this request." },
  declined: { title: "Request declined", detail: "We are unable to take on this request." },
  cancelled: { title: "Request withdrawn", detail: "This request was withdrawn." },
};

/** The customer progress tracker (happy path only). */
export const FULFILMENT_STEPS: FulfilmentStatus[] = [
  "submitted",
  "in_review",
  "sourcing",
  "quote_sent",
  "quote_accepted",
  "supplier_committed",
  "confirmed",
];

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  none: "No payment taken",
  payment_method_saved: "Payment method saved (no money reserved)",
  funds_authorized: "Funds authorized (not yet collected)",
  payment_captured: "Payment collected",
  refunded: "Refunded",
  failed: "Payment attempt failed",
};

export const QUOTE_PRICE_LABEL: Record<CustomerQuote["status"], string> = {
  draft: "Draft quote (internal)",
  sent: "Quote — awaiting your acceptance",
  accepted: "Accepted quote",
  superseded: "Superseded quote",
  withdrawn: "Withdrawn quote",
};

export const OPTION_LABELS = {
  rideFlexibility: { this_ride_only: "This ride only", open_to_similar: "Open to similar rides", need_advice: "Need advice" },
  dateFlexibility: { fixed: "Dates are fixed", flexible: "Dates are flexible" },
  eventType: {
    corporate: "Corporate event",
    municipal: "Municipal / civic event",
    school: "School event",
    college: "College / university event",
    festival: "Festival / fair",
    private: "Private event",
    other: "Other",
  },
  expectedAttendance: {
    under_500: "Under 500",
    "500_2000": "500 – 2,000",
    "2000_10000": "2,000 – 10,000",
    "10000_plus": "10,000+",
    not_sure: "Not sure",
  },
  budget: { under_10k: "Under $10,000", "10k_25k": "$10,000 – $25,000", "25k_50k": "$25,000 – $50,000", "50k_plus": "$50,000+", not_sure: "Not sure yet" },
  siteSurface: { paved: "Paved", grass: "Grass", mixed: "Mixed", not_sure: "Not sure" },
  power: { available: "Power available on site", not_available: "No power on site", not_sure: "Not sure" },
} satisfies Record<string, Record<string, string>>;

export function optionLabel<K extends keyof typeof OPTION_LABELS>(key: K, value: keyof (typeof OPTION_LABELS)[K]): string {
  return OPTION_LABELS[key][value] as string;
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

export function notSure(v: string | null): string {
  return v ?? "Not sure";
}

export function briefDates(b: EventBrief): string {
  return b.eventDateEnd && b.eventDateEnd !== b.eventDateStart ? `${b.eventDateStart} → ${b.eventDateEnd}` : b.eventDateStart;
}
