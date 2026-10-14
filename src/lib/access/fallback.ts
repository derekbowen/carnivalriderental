/**
 * Fallback matching for Event Access requests the exact search can't serve (fewer contactable
 * operators than the product's minimum). Founder decision 2026-10-14: before a customer is sent to a
 * manual search, show the closest viable alternatives, always labelled as alternatives, never as
 * exact matches. The chain, in order:
 *
 *   exact ride type (the normal match)
 *   ↓ alias      rides we couldn't classify whose title uses an exact name for the requested ride
 *   ↓ related    a short curated list of closely related ride types (RELATED_RIDE_TYPES)
 *   ↓ category   any ride type in the requested type's category, only when nothing above is viable
 *   ↓ radius     the requested ride (with aliases) within a wider radius (FALLBACK_RADII_MILES)
 *   ↓ manual     always offered: we search by hand, free
 *
 * An offer is shown only when it would itself be sellable: at least the minimum contactable
 * operators for the tier its own ride requirement resolves to (pricing.ts), with that tier's product
 * active. Choosing one creates a new event request with that requirement, so the price follows what
 * the customer actually buys access to, never anything the browser sends.
 *
 * Offers hold counts and distances only: no operator identity, no listing content.
 */
import { CLASS_LABELS, RIDE_TYPES, rideTypeFor, ridesNear, type NearRide } from "../inventory";
import { rideTypeCopy } from "../inventory/ride-type-copy";
import { MATCH_RADIUS_MILES } from "./config";
import type { OperatorSource } from "./contacts";
import { matchOperators, type ContactStatusCache, type MatchResult } from "./matching";
import { resolveCriteria, type AccessTier } from "./pricing";

/** Wider radii tried for the requested ride, smallest first; the first viable one is offered. */
export const FALLBACK_RADII_MILES: readonly number[] = [400, 750];
/** At most this many related ride types are offered (curated order). */
const MAX_RELATED_OFFERS = 2;

export type FallbackKind = "alias" | "related" | "category" | "radius";

export interface FallbackOffer {
  kind: FallbackKind;
  /** The ride requirement the alternative request is created with (null = not limited to one type). */
  rideType: string | null;
  rideClass: string | null;
  /** kind "category": the category hub whose ride types were searched. */
  categoryId: string | null;
  /** kind "alias" / "radius": the ride the customer asked for. */
  requestedRideType: string | null;
  radiusMiles: number;
  /** Contactable operators found when the offer was computed (each company once). */
  operators: number;
  nearestMiles: number;
  tier: AccessTier;
}

/**
 * Closely related ride types: what an operator would reasonably suggest when the requested ride isn't
 * available. Curated, in order of closeness; a type with no close relative has none (the category
 * step covers it). Every id must be a canonical taxonomy id (tests/access-fallback.test.ts).
 */
export const RELATED_RIDE_TYPES: Record<string, readonly string[]> = {
  "ferris-wheel": ["giant-ferris-wheel", "mini-ferris-wheel"],
  "giant-ferris-wheel": ["ferris-wheel"],
  "mini-ferris-wheel": ["ferris-wheel"],
  carousel: ["double-decker-carousel", "kiddie-carousel"],
  "double-decker-carousel": ["carousel"],
  "kiddie-carousel": ["carousel"],
  "wave-swinger": ["chair-swing-ride", "tower-swing-ride"],
  "chair-swing-ride": ["wave-swinger", "kiddie-swing-ride"],
  "kiddie-swing-ride": ["chair-swing-ride"],
  "tower-swing-ride": ["wave-swinger", "chair-swing-ride"],
  "trackless-train": ["kiddie-train"],
  "kiddie-train": ["trackless-train"],
  "family-coaster": ["kiddie-coaster"],
  "kiddie-coaster": ["family-coaster"],
  "spinning-teacups": ["tilt-ride", "scrambler"],
  "tilt-ride": ["scrambler", "spinning-teacups"],
  scrambler: ["tilt-ride", "spinning-teacups"],
  "bumper-cars": ["kiddie-bumper-cars", "bumper-boats"],
  "kiddie-bumper-cars": ["bumper-cars"],
  "bumper-boats": ["bumper-cars"],
  "giant-slide": ["fun-house"],
  "fun-house": ["mirror-maze", "haunted-house"],
  "mirror-maze": ["fun-house"],
  "haunted-house": ["dark-ride", "fun-house"],
  "swinging-pirate-ship": ["kiddie-pirate-ship"],
  "kiddie-pirate-ship": ["swinging-pirate-ship"],
  "music-express": ["sizzler-style-ride"],
  "sizzler-style-ride": ["music-express", "scrambler"],
  "helicopter-ride": ["kiddie-jets"],
  "kiddie-jets": ["helicopter-ride"],
  "kiddie-boats": ["kiddie-cars", "kiddie-motorcycles"],
  "kiddie-cars": ["kiddie-motorcycles", "kiddie-boats"],
  "kiddie-motorcycles": ["kiddie-cars"],
  "pony-cart-ride": ["kiddie-cars"],
  "ring-of-fire": ["inverter"],
  kamikaze: ["pendulum-ride"],
  orbiter: ["tornado-ride"],
  "round-up": ["gravitron"],
  inverter: ["ring-of-fire", "kamikaze"],
  "freak-out": ["pendulum-ride"],
  "tornado-ride": ["orbiter"],
  "go-karts": ["bumper-cars"],
  "dark-ride": ["haunted-house"],
};

/**
 * Extra names for a ride type that operators use in listing titles (founder list 2026-10-14), on top
 * of the taxonomy's own name and search phrases. Exact phrases only: single words like "express" name
 * coasters and spinning rides as often as trains, so they are never aliases.
 */
const EXTRA_ALIASES: Record<string, readonly string[]> = {
  "trackless-train": ["train ride", "trackless ride", "children's train", "childrens train", "kids train", "locomotive ride", "party train"],
};

const norm = (s: string) => ` ${s.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, " ").trim()} `;
const phraseOf = (searchPhrase: string) =>
  searchPhrase
    .toLowerCase()
    .replace(/^rent an? /, "")
    .replace(/\s+(rental|rentals)(\s+for\s+.*)?$/, "")
    .replace(/\s+for\s+(events?|festivals?|party|parties|kids)$/, "")
    .trim();

/** The exact phrases that name a ride type in a listing title (normalised, space-padded). */
export function aliasPhrases(rideTypeId: string): string[] {
  const t = RIDE_TYPES.find((x) => x.id === rideTypeId);
  if (!t) return [];
  const raw = [t.name, ...(t.searchPhrases ?? []).map(phraseOf), ...(EXTRA_ALIASES[rideTypeId] ?? [])];
  return [...new Set(raw.map(norm).filter((p) => p.trim().length >= 4))];
}

/** A ride we couldn't classify whose title names the requested ride. Classified rides never alias. */
export function isAliasOf(ride: Pick<NearRide, "title" | "rideType">, rideTypeId: string, phrases = aliasPhrases(rideTypeId)): boolean {
  if (ride.rideType) return false;
  const t = norm(ride.title);
  return phrases.some((p) => t.includes(p));
}

const CATEGORY_NOUN: Record<string, string> = {
  "ferris-wheels": "Ferris wheels",
  carousels: "carousels",
  "swing-rides": "swing rides",
  "thrill-rides": "thrill rides",
  "kiddie-rides": "kiddie rides",
  "family-rides": "family rides",
};
export const categoryNoun = (categoryId: string | null) => (categoryId && CATEGORY_NOUN[categoryId]) || "carnival rides";

/** Lower-case singular name for sentences: "trackless train", "kiddie ride", "carnival ride". */
export function requirementNoun(rideType: string | null, rideClass: string | null): string {
  if (rideType) return rideTypeCopy(rideType, rideTypeFor(rideType)?.name ?? rideType).one;
  if (rideClass && CLASS_LABELS.has(rideClass)) return `${rideClass} ride`;
  return "carnival ride";
}

/** Plural of requirementNoun: "trackless trains", "kiddie rides", "carnival rides". */
export function requirementPlural(rideType: string | null, rideClass: string | null): string {
  if (rideType) return rideTypeCopy(rideType, rideTypeFor(rideType)?.name ?? rideType).many;
  return `${requirementNoun(null, rideClass)}s`;
}

export interface FallbackSpec {
  kind: FallbackKind;
  rideType: string | null;
  rideClass: string | null;
  categoryId: string | null;
  requestedRideType: string | null;
  radiusMiles: number;
  filter: (r: NearRide) => boolean;
}

/** The ride filter an offer was computed with, rebuilt from the stored offer when a customer picks it. */
export function specForOffer(o: FallbackOffer): FallbackSpec {
  return { kind: o.kind, rideType: o.rideType, rideClass: o.rideClass, categoryId: o.categoryId, requestedRideType: o.requestedRideType, radiusMiles: o.radiusMiles, filter: filterFor(o) };
}

function filterFor(o: Pick<FallbackOffer, "kind" | "rideType" | "rideClass" | "categoryId" | "requestedRideType">): (r: NearRide) => boolean {
  if (o.kind === "category") {
    const types = new Set(RIDE_TYPES.filter((t) => t.categoryId === o.categoryId && t.id !== o.requestedRideType).map((t) => t.id));
    return (r) => !!r.rideType && types.has(r.rideType);
  }
  if (o.kind === "related") return (r) => r.rideType === o.rideType;
  // alias and radius: the requested ride, plus (for a ride type) unclassified rides that name it.
  if (o.rideType) {
    const phrases = aliasPhrases(o.rideType);
    return (r) => r.rideType === o.rideType || isAliasOf(r, o.rideType!, phrases);
  }
  if (o.rideClass) return (r) => r.rideClass === o.rideClass;
  return () => true;
}

/** The fallback chain for a resolved requirement, in the order offers are preferred. */
export function fallbackSpecs(req: { rideType: string | null; rideClass: string | null }): FallbackSpec[] {
  const base = { rideClass: null as string | null, categoryId: null as string | null, requestedRideType: req.rideType, radiusMiles: MATCH_RADIUS_MILES };
  const specs: Omit<FallbackSpec, "filter">[] = [];
  if (req.rideType) {
    if (aliasPhrases(req.rideType).length) specs.push({ ...base, kind: "alias", rideType: req.rideType });
    for (const t of RELATED_RIDE_TYPES[req.rideType] ?? []) specs.push({ ...base, kind: "related", rideType: t });
    const cat = RIDE_TYPES.find((t) => t.id === req.rideType)?.categoryId ?? null;
    if (cat) specs.push({ ...base, kind: "category", rideType: null, categoryId: cat });
  }
  for (const radiusMiles of FALLBACK_RADII_MILES) specs.push({ ...base, kind: "radius", rideType: req.rideType, rideClass: req.rideType ? null : req.rideClass, radiusMiles });
  return specs.map((s) => ({ ...s, filter: filterFor(s) }));
}

/** Memoises listing → operator lookups across the several match runs one request needs. */
function memoSource(source: OperatorSource): OperatorSource {
  const known = new Map<string, string | null>();
  return {
    kind: source.kind,
    contact: (id) => source.contact(id),
    async authorsFor(ids) {
      const missing = ids.filter((i) => !known.has(i));
      if (missing.length) {
        const got = await source.authorsFor(missing);
        for (const i of missing) known.set(i, got.get(i) ?? null);
      }
      return new Map(ids.flatMap((i) => (known.get(i) ? [[i, known.get(i)!] as [string, string]] : [])));
    },
  };
}

export interface FallbackInput {
  lat: number;
  lng: number;
  state: string;
  rideType: string | null;
  rideClass: string | null;
}

/** Runs one offer's match: the same matcher as the exact search, with the offer's ride filter and radius. */
export function matchForSpec(input: FallbackInput, spec: FallbackSpec, source: OperatorSource, cache: ContactStatusCache): Promise<MatchResult> {
  return matchOperators({ lat: input.lat, lng: input.lng, state: input.state, rideType: spec.rideType, rideClass: spec.rideClass }, source, cache, { radiusMiles: spec.radiusMiles, filter: spec.filter });
}

/**
 * The viable alternatives for a request whose exact search can't be sold, best first: at most one
 * alias offer, up to MAX_RELATED_OFFERS related types, a category offer only when neither of those is
 * viable, and the smallest viable wider radius. `minimumFor` returns the minimum contactable matches
 * for a tier, or null when that tier isn't for sale (its offers are then never shown).
 */
export async function computeFallbacks(input: FallbackInput, source: OperatorSource, cache: ContactStatusCache, minimumFor: (tier: AccessTier) => Promise<number | null>): Promise<FallbackOffer[]> {
  const src = memoSource(source);
  const offers: FallbackOffer[] = [];
  const rides = new Map<number, NearRide[]>();
  let related = 0;
  let radiusOffered = false;
  for (const spec of fallbackSpecs(input)) {
    if (spec.kind === "related" && related >= MAX_RELATED_OFFERS) continue;
    if (spec.kind === "category" && offers.some((o) => o.kind === "alias" || o.kind === "related")) continue;
    if (spec.kind === "radius" && radiusOffered) continue;
    const tier = resolveCriteria({ rideType: spec.rideType, rideClass: spec.rideClass }).tier;
    const minimum = await minimumFor(tier);
    if (minimum === null) continue;
    // Cheap screen before any API call: a company needs at least one listing, so too few listings can't be viable.
    if (!rides.has(spec.radiusMiles)) rides.set(spec.radiusMiles, ridesNear(input.lat, input.lng, spec.radiusMiles));
    const candidates = rides.get(spec.radiusMiles)!.filter(spec.filter);
    if (candidates.length < minimum) continue;
    // An alias offer must add rides the exact search didn't already have.
    if (spec.kind === "alias" && !candidates.some((r) => r.rideType !== spec.rideType)) continue;
    const m = await matchForSpec(input, spec, src, cache);
    if (m.contactableCount < minimum) continue;
    offers.push({ kind: spec.kind, rideType: spec.rideType, rideClass: spec.rideClass, categoryId: spec.categoryId, requestedRideType: spec.requestedRideType, radiusMiles: spec.radiusMiles, operators: m.contactableCount, nearestMiles: Math.min(...m.operators.map((o) => o.miles)), tier });
    if (spec.kind === "related") related++;
    if (spec.kind === "radius") radiusOffered = true;
  }
  return offers;
}

/** Same offer (kind, requirement, radius)? Used to reuse an alternative request instead of duplicating it. */
export const sameOffer = (a: Pick<FallbackOffer, "kind" | "rideType" | "rideClass" | "categoryId" | "radiusMiles">, b: typeof a) =>
  a.kind === b.kind && a.rideType === b.rideType && a.rideClass === b.rideClass && a.categoryId === b.categoryId && a.radiusMiles === b.radiusMiles;
