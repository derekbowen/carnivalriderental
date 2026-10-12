/**
 * The one place that turns an event request into (a) the ride requirement used for matching and
 * (b) the Event Access tier it is priced at. Matching (matching.ts) and pricing (service.ts) both
 * call `resolveCriteria`, so an operator can never be matched on one requirement and charged on
 * another.
 *
 * Rules (founder decision 2026-10-12):
 * - The authoritative inventory snapshot classifies a listing. When a listing id is supplied and
 *   exists there, its ride type wins over anything the client submitted (a Ferris listing is a
 *   Ferris request even if the submitted ride type is missing or wrong).
 * - Otherwise the submitted ride type counts only if it is a canonical taxonomy id; a ride class
 *   counts only when no ride type was resolved. Unknown values are treated as "any ride".
 * - A request whose resolved ride type is any Ferris wheel variant is priced at the Ferris tier.
 *   Which operators happen to match (one of them may own a Ferris wheel) never changes the tier.
 *
 * Nothing here reads a price: prices live in access_products (config.ts) and are looked up by tier.
 */
import { CLASS_LABELS, RIDES, rideTypeFor, type InventoryRide } from "../inventory";

export type AccessTier = "standard" | "ferris";

/** Canonical taxonomy ids (src/lib/taxonomy/ride-types.json) priced at the Ferris tier. */
export const FERRIS_RIDE_TYPES: readonly string[] = ["ferris-wheel", "giant-ferris-wheel", "mini-ferris-wheel"];

export const isFerrisRideType = (rideType: string | null | undefined): boolean => !!rideType && FERRIS_RIDE_TYPES.includes(rideType);

export interface CriteriaInput {
  listingId?: string | null;
  rideType?: string | null;
  rideClass?: string | null;
}

export interface ResolvedCriteria {
  /** The listing when it exists in the authoritative inventory; null when it doesn't (never trusted blindly). */
  listing: InventoryRide | null;
  listingId: string | null;
  rideType: string | null;
  rideClass: string | null;
  tier: AccessTier;
  /** Where the ride requirement came from; recorded for support, never used for pricing. */
  basis: "listing" | "ride-type" | "ride-class" | "any";
}

const canonicalRideType = (t: string | null | undefined): string | null => (t && rideTypeFor(t) ? t : null);
const canonicalRideClass = (c: string | null | undefined): string | null => (c && CLASS_LABELS.has(c) ? c : null);

export function resolveCriteria(input: CriteriaInput): ResolvedCriteria {
  const listing = input.listingId ? RIDES.find((r) => r.id === input.listingId) ?? null : null;
  if (listing) {
    const rideType = canonicalRideType(listing.rideType);
    const rideClass = rideType ? null : canonicalRideClass(listing.rideClass);
    return { listing, listingId: listing.id, rideType, rideClass, tier: tierForRideType(rideType), basis: "listing" };
  }
  const rideType = canonicalRideType(input.rideType);
  const rideClass = rideType ? null : canonicalRideClass(input.rideClass);
  return { listing: null, listingId: null, rideType, rideClass, tier: tierForRideType(rideType), basis: rideType ? "ride-type" : rideClass ? "ride-class" : "any" };
}

export const tierForRideType = (rideType: string | null | undefined): AccessTier => (isFerrisRideType(rideType) ? "ferris" : "standard");

/**
 * Category hubs → the ride requirement they stand for (the hub's canonical ride type, or a class).
 * Used by /connect?category= and by the hub's own price copy, so both agree on the tier.
 */
export const CATEGORY_CONTEXT: Record<string, { rideType?: string; rideClass?: string }> = {
  "ferris-wheels": { rideType: "ferris-wheel" },
  carousels: { rideType: "carousel" },
  "swing-rides": { rideType: "wave-swinger" },
  "kiddie-rides": { rideClass: "kiddie" },
  "thrill-rides": { rideClass: "major" },
};

/** The tier a stored event request belongs to, re-derived from its persisted (already resolved) criteria. */
export const tierForEvent = (event: { listingId: string | null; rideType: string | null; rideClass: string | null }): AccessTier => resolveCriteria(event).tier;
