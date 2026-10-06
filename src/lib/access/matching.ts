/**
 * Deterministic operator matching for an event. Inputs: the public ride snapshot (no identity),
 * the listing → operator map and contactability flags from contacts.ts. Output: anonymised
 * operators ranked by relevant equipment, service geography, distance, contactability and claim
 * status. Never date availability: we don't know it.
 *
 * Access is sold per operator: several matching rides from one company are one match.
 */
import { CITIES, PSEO_INVENTORY, RIDES, ridesNear, type InventoryRide, type NearRide } from "../inventory";
import { STATE_CENTERS } from "../taxonomy/state-centers";
import { MATCH_RADIUS_MILES, MAX_MATCHED_OPERATORS } from "./config";
import { channelsOf, isContactable, type ContactChannels, type OperatorSource } from "./contacts";

export interface MatchInput {
  lat: number;
  lng: number;
  state: string;
  listingId?: string | null;
  rideType?: string | null;
  rideClass?: string | null;
}
export interface MatchedListing {
  id: string;
  title: string;
  rideType: string | null;
  rideClass: string | null;
  photo: string | null;
  thumb: string | null;
  miles: number;
}
export interface MatchedOperator {
  operatorId: string;
  /** Anonymous label shown before unlock ("Operator A"). */
  label: string;
  homeState: string | null;
  miles: number;
  servesState: boolean;
  claimed: boolean;
  contactable: boolean;
  listings: MatchedListing[];
}
export interface MatchResult {
  operators: MatchedOperator[];
  contactableCount: number;
  candidateListings: number;
  criteria: { rideType: string | null; rideClass: string | null; listingId: string | null; radiusMiles: number };
}

/** Cache of contactability flags (the DB table in production, a Map in tests). */
export interface ContactStatusCache {
  get(ids: string[]): Promise<Map<string, ContactChannels>>;
  put(id: string, ch: ContactChannels): Promise<void>;
}
export const memoryContactCache = (): ContactStatusCache => {
  const m = new Map<string, ContactChannels>();
  return { async get(ids) { return new Map(ids.filter((i) => m.has(i)).map((i) => [i, m.get(i)!])); }, async put(id, ch) { m.set(id, ch); } };
};

const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** City + state → coordinates from the Census city list, else the state centre. */
export function geocode(city: string, state: string): { lat: number; lng: number; resolved: "city" | "state" } | null {
  const st = state.toLowerCase();
  const slug = slugify(city);
  const c = CITIES.find((x) => x.state === st && x.slug === slug) ?? CITIES.find((x) => x.state === st && slugify(x.name) === slug);
  if (c) return { lat: c.lat, lng: c.lng, resolved: "city" };
  const centre = STATE_CENTERS[st] ?? STATE_CENTERS[st.toUpperCase()];
  return centre ? { lat: centre[0], lng: centre[1], resolved: "state" } : null;
}

function criteriaFor(input: MatchInput): { rideType: string | null; rideClass: string | null; listing: InventoryRide | null } {
  const listing = input.listingId ? RIDES.find((r) => r.id === input.listingId) ?? null : null;
  if (listing) return { rideType: listing.rideType, rideClass: listing.rideType ? null : listing.rideClass, listing };
  return { rideType: input.rideType ?? null, rideClass: input.rideType ? null : input.rideClass ?? null, listing: null };
}

const toMatched = (r: NearRide): MatchedListing => ({ id: r.id, title: r.title, rideType: r.rideType, rideClass: r.rideClass, photo: r.photo, thumb: r.thumb, miles: r.miles });

export async function matchOperators(input: MatchInput, source: OperatorSource, cache: ContactStatusCache, opts: { radiusMiles?: number; maxCandidates?: number; now?: () => Date } = {}): Promise<MatchResult> {
  const radius = opts.radiusMiles ?? Math.max(MATCH_RADIUS_MILES, PSEO_INVENTORY.radiusMiles);
  const { rideType, rideClass, listing } = criteriaFor(input);
  let candidates = ridesNear(input.lat, input.lng, radius).filter((r) => (rideType ? r.rideType === rideType : rideClass ? r.rideClass === rideClass : true));
  if (listing && !candidates.some((c) => c.id === listing.id)) {
    const miles = Math.round(Math.hypot(listing.lat - input.lat, listing.lng - input.lng) * 69);
    candidates = [{ ...listing, miles }, ...candidates];
  }
  candidates = candidates.slice(0, opts.maxCandidates ?? 150);

  const authors = await source.authorsFor(candidates.map((c) => c.id));
  const byOperator = new Map<string, NearRide[]>();
  for (const c of candidates) {
    const op = authors.get(c.id);
    if (!op) continue;
    byOperator.set(op, [...(byOperator.get(op) ?? []), c]);
  }

  const ids = [...byOperator.keys()];
  const cached = await cache.get(ids);
  const flags = new Map(cached);
  for (const id of ids) {
    if (flags.has(id)) continue;
    const c = await source.contact(id);
    const ch = c ? channelsOf(c) : { hasPhone: false, hasEmail: false, hasWebsite: false, claimed: false };
    flags.set(id, ch);
    await cache.put(id, ch);
  }

  const eventState = input.state.toLowerCase();
  const ranked = ids
    .map((operatorId) => {
      const rides = byOperator.get(operatorId)!.sort((a, b) => a.miles - b.miles);
      const ch = flags.get(operatorId)!;
      return {
        operatorId,
        label: "",
        homeState: rides[0].homeState?.toUpperCase() ?? null,
        miles: rides[0].miles,
        servesState: rides.some((r) => r.serviceStates.map((s) => s.toLowerCase()).includes(eventState) || r.homeState?.toLowerCase() === eventState),
        claimed: ch.claimed,
        contactable: isContactable(ch),
        listings: rides.slice(0, 6).map(toMatched),
      };
    })
    .filter((o) => o.contactable)
    .sort((a, b) => Number(b.servesState) - Number(a.servesState) || a.miles - b.miles || b.listings.length - a.listings.length || Number(b.claimed) - Number(a.claimed) || a.operatorId.localeCompare(b.operatorId))
    .slice(0, MAX_MATCHED_OPERATORS)
    .map((o, i) => ({ ...o, label: `Operator ${String.fromCharCode(65 + (i % 26))}${i >= 26 ? Math.floor(i / 26) + 1 : ""}` }));

  return { operators: ranked, contactableCount: ranked.length, candidateListings: candidates.length, criteria: { rideType, rideClass, listingId: listing?.id ?? null, radiusMiles: radius } };
}
