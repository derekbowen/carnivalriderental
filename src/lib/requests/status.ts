// Fulfillment and payment are tracked separately and never inferred from each
// other. A saved card is not a booking; a committed supplier is not a payment.

export const FULFILLMENT = [
  "submitted",
  "sourcing",
  "quote_sent",
  "quote_accepted",
  "supplier_committed",
  "confirmed",
  "cancelled",
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT)[number];

export const PAYMENT = ["not_started", "method_saved", "authorized", "captured", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT)[number];

/** Customer-facing wording. Only "confirmed" may say "booked". */
export const FULFILLMENT_LABEL: Record<FulfillmentStatus, string> = {
  submitted: "Request received — not a booking yet",
  sourcing: "Sourcing operators for your event",
  quote_sent: "Quote sent — waiting for your decision",
  quote_accepted: "Quote accepted — securing an operator",
  supplier_committed: "Operator committed — finalizing your booking",
  confirmed: "Booking confirmed",
  cancelled: "Request closed",
};

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  not_started: "No payment taken",
  method_saved: "Payment method saved — not charged",
  authorized: "Amount authorized — not yet charged",
  captured: "Payment received",
  refunded: "Refunded",
};

/** The customer-visible progress steps, in order. */
export const PROGRESS: FulfillmentStatus[] = [
  "submitted",
  "sourcing",
  "quote_sent",
  "quote_accepted",
  "supplier_committed",
  "confirmed",
];

/**
 * Transitions an internal team member may request directly. Others happen
 * only as a side effect of a guarded action:
 *   quote_sent      ← sending a customer quote
 *   quote_accepted  ← the customer accepting the current quote
 *   sourcing        ← withdrawing a sent quote
 */
export const MANUAL_TRANSITIONS: Partial<Record<FulfillmentStatus, FulfillmentStatus[]>> = {
  submitted: ["sourcing", "cancelled"],
  sourcing: ["cancelled"],
  quote_sent: ["cancelled"],
  quote_accepted: ["supplier_committed", "cancelled"],
  supplier_committed: ["confirmed", "cancelled"],
};

/**
 * The approved payment policy decides when a booking may be confirmed. No
 * policy is approved yet, so confirmation is refused. Change this only with
 * the founder's sign-off (see docs/DECISIONS.md).
 */
export const CONFIRMATION_PAYMENT_POLICY: { approved: false } | { approved: true; requires: PaymentStatus[] } = {
  approved: false,
};
