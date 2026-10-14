/**
 * THE public price rule for operator ride listings (founder decision 2026-10-05).
 *
 * A number is shown only when it is an approved operator rate for THAT listing and rental unit:
 * the account is claimed (the operator is on the marketplace), the listing carries an operator-set
 * price, the team has approved it (listing metadata.priceApproved === true) and the unit is known.
 * Category, ride-size and marketplace rate-card figures (src/lib/pricing/rate-card.ts) are private
 * planning data and are never displayed as a listing's price. Everything else reads "Priced by the operator".
 * Never $0.
 */
export const REQUEST_A_QUOTE = "Priced by the operator";

const UNIT: Record<string, string> = { day: "per day", hour: "per hour", night: "per night", item: "each" };

export function listingPriceLabel(i: { claimed: boolean; price?: { amount?: number; currency?: string } | null; priceApproved?: unknown; unitType?: unknown }): string | null {
  const amount = i.price?.amount;
  const unit = typeof i.unitType === "string" ? UNIT[i.unitType] : undefined;
  if (!i.claimed || i.priceApproved !== true || !unit || typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || i.price?.currency !== "USD") return null;
  return `$${(amount / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })} ${unit}`;
}
