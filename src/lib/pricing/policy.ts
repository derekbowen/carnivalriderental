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
  estimateLabel: "Priced by the operator",
  notFinal: "The operator sets the rental price; any figure shown is theirs and not the final price.",
  noEstimate: "Priced by the operator — ask them directly for a quote.",
  steps: [
    { title: "Priced by the operator", body: "Rides are priced per event by the independent operator who owns them. A ride shows a figure only when its operator has approved one, and that is not the final price." },
    {
      title: "Every event is different",
      body: "Location, travel distance, hours, crew, power, permits and insurance change the price. Operators quote after hearing your details.",
    },
    {
      title: "Event Access is the fee we charge",
      body: "It buys direct contact details for matching operators, not the rental. The rental is agreed and paid with the operator.",
    },
    { title: "Not a booking", body: "Nothing on this site reserves a ride. A booking exists only when you and the operator agree one directly." },
  ],
} as const;
