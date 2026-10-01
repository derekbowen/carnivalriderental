import type { FulfilmentStatus, PaymentStatus } from "./types";

/**
 * Allowed fulfilment transitions. Enforced server-side in the service layer; the
 * UI only offers what this table allows.
 */
const TERMINAL: FulfilmentStatus[] = ["confirmed", "unable_to_source", "declined", "cancelled"];
const CLOSE_OUT: FulfilmentStatus[] = ["unable_to_source", "declined", "cancelled"];

export const FULFILMENT_TRANSITIONS: Record<FulfilmentStatus, FulfilmentStatus[]> = {
  submitted: ["in_review", ...CLOSE_OUT],
  in_review: ["sourcing", ...CLOSE_OUT],
  sourcing: ["quote_sent", ...CLOSE_OUT],
  quote_sent: ["quote_accepted", "sourcing", ...CLOSE_OUT],
  quote_accepted: ["supplier_committed", "sourcing", ...CLOSE_OUT],
  supplier_committed: ["confirmed", ...CLOSE_OUT],
  confirmed: [],
  unable_to_source: [],
  declined: [],
  cancelled: [],
};

export function canTransition(from: FulfilmentStatus, to: FulfilmentStatus): boolean {
  return FULFILMENT_TRANSITIONS[from].includes(to);
}

export function isTerminal(s: FulfilmentStatus): boolean {
  return TERMINAL.includes(s);
}

/** Payment track transitions (demo adapter). Independent of fulfilment. */
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  none: ["payment_method_saved", "funds_authorized", "payment_captured", "failed"],
  payment_method_saved: ["funds_authorized", "payment_captured", "failed", "none"],
  funds_authorized: ["payment_captured", "none", "failed"],
  payment_captured: ["refunded"],
  refunded: [],
  failed: ["none", "payment_method_saved", "funds_authorized", "payment_captured"],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

/**
 * The payment requirement for booking confirmation is a BUSINESS DECISION that
 * has not been made (deposit vs full payment, timing, refunds). Until it is,
 * only demo mode can confirm, and it requires a demo "payment_captured" state so
 * the demo never shows "confirmed" on a mere saved card or authorization.
 */
export const PAYMENT_POLICY = {
  decided: false as boolean,
  demoConfirmationRequires: "payment_captured" as PaymentStatus,
};
