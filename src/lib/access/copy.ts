/**
 * Price copy for public surfaces (category hubs, ride pages, FAQs, the connect form). Every string
 * is built from product rows (access_products via accessProductsForDisplay), never from literals, so
 * a price changed in the database changes everywhere at once. Ferris surfaces name the Ferris tier;
 * general surfaces name both.
 */
import { formatPrice, type AccessProduct, type AccessProducts } from "./config";
import { isFerrisRideType, type AccessTier } from "./pricing";

export interface AccessPriceCopy {
  tier: AccessTier;
  product: AccessProduct | null;
  /** e.g. "Ferris Wheel Event Access — $199" (no price when the tier is not for sale). */
  headline: string;
  /** The applicable tier on Ferris surfaces; both tiers on general ones. */
  sentence: string;
  /** What one purchase covers, from the product's terms. */
  terms: string;
  /** One line for CTAs: the Ferris headline on Ferris surfaces, both tiers everywhere else (never a lone "$99"). */
  ctaLine: string;
}

/** The FAQ entry about the fee, phrased for the surface (mirrored into FAQPage JSON-LD by the page). */
export const accessFaq = (copy: AccessPriceCopy) => ({ q: "How much does Event Access cost?", a: `${copy.sentence} ${copy.terms} You see how many operators match before paying, and we don't sell access when fewer than the minimum match.` });

const price = (p: AccessProduct) => formatPrice(p.priceCents, p.currency);
const termsOf = (p: AccessProduct | null) => (p ? `One event, up to ${p.unlockLimit} distinct operators, ${p.validityDays} days of access.` : "One event, a set number of distinct operators, for a set period.");

/** "Event Access is $99. Ferris Wheel Event Access is $199." (each clause only when that tier is for sale). */
export function bothTiersSentence(products: AccessProducts): string {
  const parts = [
    products.standard ? `Event Access is ${price(products.standard)}.` : "Event Access isn't available right now.",
    products.ferris ? `Ferris Wheel Event Access is ${price(products.ferris)}.` : null,
  ];
  return parts.filter(Boolean).join(" ");
}

export function accessPriceCopy(products: AccessProducts, rideType?: string | null): AccessPriceCopy {
  if (isFerrisRideType(rideType)) {
    const p = products.ferris;
    const headline = p ? `Ferris Wheel Event Access — ${price(p)}` : "Ferris Wheel Event Access";
    return {
      tier: "ferris",
      product: p,
      headline,
      sentence: p ? `Ferris wheel requests use Ferris Wheel Event Access: ${price(p)} once, for one event. The fee is for operator contact access only; the rental is agreed and paid with the operator.` : "Ferris Wheel Event Access isn't available right now.",
      terms: termsOf(p),
      ctaLine: p ? `${headline}, one time.` : headline,
    };
  }
  const p = products.standard;
  return {
    tier: "standard",
    product: p,
    headline: p ? `Event Access — ${price(p)}` : "Event Access",
    sentence: `${bothTiersSentence(products)} The fee is for operator contact access only; the rental is agreed and paid with the operator.`,
    terms: termsOf(p),
    ctaLine: bothTiersSentence(products),
  };
}
