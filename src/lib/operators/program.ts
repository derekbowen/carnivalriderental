/**
 * The operator program under the discovery-and-access model (founder decision 2026-10-06): listing is
 * free, there is no commission and no payout, and customers who buy Event Access contact the operator
 * directly. Every number the /operators page states comes from here so the page cannot drift.
 */
export const OPERATOR_PROGRAM = {
  status: "early-access" as "early-access" | "live",
  /** What an operator pays to list. Always 0 under this model; the page says "free". */
  listingFeeUsd: 0,
  /** Commission or fee on the operator's rentals. None: we are not a party to the rental. */
  rentalCommissionPct: 0,
  /** Founder approval of the page copy. Until true the page is never indexable. */
  copyApproved: false,
} as const;
