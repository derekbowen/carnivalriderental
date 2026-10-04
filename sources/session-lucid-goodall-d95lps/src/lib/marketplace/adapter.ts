// Boundary between this app and the marketplace engine (Sharetribe).
//
// SESSION ONE STATUS: NOT CONNECTED. No Sharetribe marketplace credentials
// are configured, so the app runs on the DEVELOPMENT ADAPTER below. It does
// not talk to Sharetribe, does not create listings or transactions, and must
// never be described as a working integration.
//
// Intended mapping (see docs/ARCHITECTURE.md — verify before building):
//   * Our company is the seller of record: one provider user owned by the
//     operating business, onboarded to Stripe Connect with the business's own
//     verification. Ride offerings are listings authored by that user.
//   * Customer quote → regular price-negotiation transaction on that listing
//     (request quote → our offer → customer accepts & pays).
//   * Carnival operators are suppliers in OUR procurement records, not
//     marketplace users. They never need a Sharetribe account.

export type MarketplaceStatus =
  | { mode: "development-adapter"; connected: false; reason: string }
  | { mode: "sharetribe"; connected: true; clientIdPresent: true };

export interface MarketplaceAdapter {
  status(): MarketplaceStatus;
}

export const developmentAdapter: MarketplaceAdapter = {
  status: () => ({
    mode: "development-adapter",
    connected: false,
    reason:
      "Sharetribe is not connected in this environment. Ride offerings come from the local catalog and requests are stored in the development database.",
  }),
};

export function marketplace(): MarketplaceAdapter {
  // A Sharetribe adapter will be added when test-marketplace credentials are
  // provided and the listing/transaction mapping has been proven against it.
  // Until then a configured client id still does not switch modes.
  return developmentAdapter;
}
