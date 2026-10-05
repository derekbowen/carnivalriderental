/**
 * Operator inventory states and booking eligibility (marketplace model, founder decision 2026-10-05).
 *
 * Imported operator listings belong to placeholder company accounts (claim addresses on our domain).
 * Sharetribe does not allow changing a listing's author, so a claim transfers the ACCOUNT: after a
 * verified ownership check the account's email is changed to the operator's, the operator sets their
 * own password, and every listing (and its source mapping) stays exactly where it is.
 */

/** Console: listing type operator-ride-rental → default-inquiry/release-1 (unitType inquiry). */
export const INQUIRY_ALIAS = "default-inquiry/release-1";

/** First paragraph of every unclaimed listing's description (truthful: the operator has not joined). */
export const UNCLAIMED_NOTICE =
  "This operator has not joined Carnival Ride Rental yet. Requests sent from carnivalriderental.us go to the Carnival Ride Rental request desk, which contacts the operator for you. Messages sent from this page are held in the operator's account until they claim it.";

export function withNotice(description: string): string {
  const d = (description ?? "").trim();
  return d.startsWith(UNCLAIMED_NOTICE) ? d : `${UNCLAIMED_NOTICE}\n\n${d}`.trim();
}

export function withoutNotice(description: string): string {
  const d = (description ?? "").trim();
  return d.startsWith(UNCLAIMED_NOTICE) ? d.slice(UNCLAIMED_NOTICE.length).trim() : d;
}

/**
 * Ownership verification: an operator may claim a company account only with an email at the
 * company's own website domain (or a founder-recorded manual verification). A typed company name
 * proves nothing.
 */
export function emailMatchesCompanyDomain(email: string, website: string | null | undefined): boolean {
  const host = (() => {
    try {
      return new URL(/^https?:\/\//i.test(website ?? "") ? String(website) : `https://${website}`).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  if (!host || !domain) return false;
  return domain === host || domain.endsWith(`.${host}`);
}

export interface EligibilityInput {
  /** User metadata.claimStatus, set only by the claim script after verification. */
  claimStatus: unknown;
  /** Integration API users/show attributes.stripeConnected (authoritative, read server-side). */
  stripeConnected: boolean;
  /** Integration API stripe account requirements, if any are outstanding (payouts disabled). */
  stripePayoutsEnabled: boolean;
  /** Listing metadata.rideApproved, set by the team after reviewing the operator's ride. */
  rideApproved: unknown;
  /** Listing price set by the operator (minor units), or null. */
  priceAmount: number | null;
  /** Commission decision recorded in program config; null = undecided. */
  commissionDecided: boolean;
}

/** Every reason this listing must NOT be bookable. Empty = eligible. */
export function bookingBlockers(i: EligibilityInput): string[] {
  const out: string[] = [];
  if (i.claimStatus !== "claimed") out.push("ownership not verified (unclaimed account)");
  if (i.rideApproved !== true) out.push("ride not approved for booking");
  if (!i.stripeConnected) out.push("operator has not connected Stripe");
  else if (!i.stripePayoutsEnabled) out.push("Stripe onboarding incomplete");
  if (!i.priceAmount || i.priceAmount <= 0) out.push("no operator-approved price");
  if (!i.commissionDecided) out.push("commission not decided (real-money payments gated)");
  return out;
}
