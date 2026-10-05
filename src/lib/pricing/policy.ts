/**
 * Customer pricing policy (founder decisions, 2026-10-04). Every price, estimate and request CTA in
 * the templates takes its wording from here, so the rules read the same on every page.
 *
 * - Prices shown before an operator confirms are ESTIMATES, never the final price.
 * - The operator may change the price for location, event type, travel distance and site conditions;
 *   the customer approves any change before they are committed.
 * - PAY FIRST: nobody is contacted about a request until it is paid (enforced in OUTREACH_POLICY,
 *   src/lib/requests/state.ts).
 * - A request is not a booking. Booked = operator committed + agreed payment step complete.
 *
 * Internal (never shown to customers): estimates are set conservatively high while pricing is
 * finalised. Numbers still need approved provenance before any estimate is displayed.
 */
export const PRICING_POLICY = {
  decidedOn: "2026-10-04",
  payFirst: true,
  /** Online payment is not live. While false, the notice says so instead of implying a checkout exists. */
  paymentsLive: false,
  adjustmentFactors: ["location", "event type", "travel distance", "site conditions"],
} as const;

export const PRICE_COPY = {
  estimateLabel: "Request a quote",
  notFinal: "Your quote sets the price; any price shown is not the final price.",
  noEstimate: "Request a quote — the final price is set with the operator.",
  steps: [
    { title: "Request a quote", body: "Rides are priced per event. A ride shows a price only when its operator has approved one, and that is not the final price until your quote confirms it." },
    {
      title: "The final price can change",
      body: "The operator may adjust it for your location, event type, travel distance and site conditions. You approve any change before you are committed.",
    },
    {
      title: "Pay first, then we source",
      body: "We start sourcing and contact operators only after your request is paid.",
      pendingNote: "Online payment is not open yet.",
    },
    { title: "A request, not a booking", body: "Your booking is confirmed only when an operator commits and the agreed payment step is complete." },
  ],
} as const;
