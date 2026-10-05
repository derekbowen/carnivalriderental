/**
 * Inventory-backed pSEO data layer: the public ride snapshot (rides.json, from
 * `npm run inventory:export`) and US cities (cities.json, from `npm run geo:cities`).
 *
 * Every page is built from real operator rides near a real place: counts, distances and ride types
 * are computed, never written. Operator identity is not in the snapshot at all.
 */
import { milesBetween, type OperatorCard } from "../catalog/operator-search";
import { estimateText, type RateKey } from "../pricing/rate-card";
import { publicIndexingEnabled } from "../config";
import type { GateResult } from "../seo/publication";
import { canonicalUrl } from "../seo/routes";
import { stateBySlug, US_STATES } from "../taxonomy";
import rideTypesFile from "../taxonomy/ride-types.json";
import contract from "../../../contract/operator-listing-contract.json";
import citiesFile from "../geo/cities.json";
import ridesFile from "./rides.json";

export interface InventoryRide {
  id: string;
  title: string;
  rideClass: string | null;
  rideType: string | null;
  rateKey: string;
  homeState: string | null;
  serviceStates: string[];
  lat: number;
  lng: number;
  photo: string | null;
  thumb: string | null;
  facts: { label: string; value: string }[];
  claimed: boolean;
}
export interface City {
  state: string;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  pop: number;
}
export interface RideType {
  id: string;
  name: string;
  searchPhrases: string[];
}

export const RIDES = (ridesFile as { rides: InventoryRide[] }).rides;
export const INVENTORY_GENERATED_AT = (ridesFile as { generatedAt: string }).generatedAt;
export const CITIES = (citiesFile as { cities: City[] }).cities;
export const RIDE_TYPES: RideType[] = (rideTypesFile as { rideTypes: RideType[] }).rideTypes;
const CLASS_LABEL = new Map(contract.rideClass.options.map((o) => [o.option, o.label]));

/**
 * Template settings. A page family becomes indexable only when its copy is founder-approved,
 * public indexing is switched on for the environment, AND the page has enough real supply.
 */
export const PSEO_INVENTORY = {
  /** Operators within this many straight-line miles count as "near". */
  radiusMiles: 200,
  cityMinRides: 10,
  rideCityMinRides: 5,
  /** Founder approval of the city and ride+city templates. Until true, nothing here is indexable. */
  copyApproved: false,
} as const;

const citiesByKey = new Map(CITIES.map((c) => [`${c.state}/${c.slug}`, c]));
const rideTypeById = new Map(RIDE_TYPES.map((r) => [r.id, r]));

export function cityBySlugs(stateSlug: string, citySlug: string): (City & { stateName: string; stateAbbr: string; stateSlug: string }) | null {
  const st = stateBySlug(stateSlug);
  const c = st ? citiesByKey.get(`${st.code}/${citySlug}`) : undefined;
  return st && c ? { ...c, stateName: st.name, stateAbbr: st.abbr, stateSlug: st.slug } : null;
}
export const rideTypeFor = (id: string) => rideTypeById.get(id) ?? null;

export interface NearRide extends InventoryRide {
  miles: number;
}

const nearCache = new Map<string, NearRide[]>();
/** All rides within the radius of a point, nearest first (memoised per point). */
export function ridesNear(lat: number, lng: number, radius = PSEO_INVENTORY.radiusMiles): NearRide[] {
  const key = `${lat},${lng},${radius}`;
  const hit = nearCache.get(key);
  if (hit) return hit;
  const out = RIDES.map((r) => ({ ...r, miles: Math.round(milesBetween({ lat, lng }, r)) }))
    .filter((r) => r.miles <= radius)
    .sort((a, b) => a.miles - b.miles || a.id.localeCompare(b.id));
  if (nearCache.size > 3000) nearCache.clear();
  nearCache.set(key, out);
  return out;
}

export function toCard(r: NearRide | InventoryRide): OperatorCard {
  return {
    id: r.id,
    title: r.title,
    rideClass: r.rideClass,
    rideClassLabel: r.rideClass ? CLASS_LABEL.get(r.rideClass) ?? null : null,
    homeState: r.homeState?.toUpperCase() ?? null,
    photo: r.photo ? { src: r.photo, alt: r.title } : null,
    miles: "miles" in r ? r.miles : null,
    estimate: estimateText(r.rateKey as RateKey),
    claimed: r.claimed,
    detailsReady: true,
    bookable: false,
  };
}

export interface CityStats {
  total: number;
  nearestMiles: number | null;
  byType: { type: RideType; count: number; nearestMiles: number }[];
  byClass: { id: string; label: string; count: number }[];
  operatorStates: string[];
}

export function cityStats(c: City): CityStats {
  const near = ridesNear(c.lat, c.lng);
  const types = new Map<string, { count: number; nearestMiles: number }>();
  const classes = new Map<string, number>();
  for (const r of near) {
    if (r.rideType) {
      const t = types.get(r.rideType);
      types.set(r.rideType, t ? { count: t.count + 1, nearestMiles: t.nearestMiles } : { count: 1, nearestMiles: r.miles });
    }
    if (r.rideClass) classes.set(r.rideClass, (classes.get(r.rideClass) ?? 0) + 1);
  }
  return {
    total: near.length,
    nearestMiles: near[0]?.miles ?? null,
    byType: [...types].map(([id, v]) => ({ type: rideTypeById.get(id)!, ...v })).filter((x) => x.type).sort((a, b) => b.count - a.count),
    byClass: [...classes].map(([id, count]) => ({ id, label: CLASS_LABEL.get(id) ?? id, count })).sort((a, b) => b.count - a.count),
    operatorStates: [...new Set(near.map((r) => r.homeState?.toUpperCase()).filter((s): s is string => !!s))].sort(),
  };
}

/** Other cities, nearest first, for internal links. */
export function nearbyCities(c: City, n = 12): (City & { miles: number; stateSlug: string })[] {
  return CITIES.filter((x) => !(x.state === c.state && x.slug === c.slug))
    .map((x) => ({ ...x, miles: Math.round(milesBetween(c, x)), stateSlug: US_STATES.find((s) => s.code === x.state)!.slug }))
    .sort((a, b) => a.miles - b.miles)
    .slice(0, n);
}

const gate = (reasons: string[]): GateResult => ({ indexable: reasons.length === 0, reasons });

export function inventoryCityGate(c: City): GateResult {
  const reasons: string[] = [];
  if (!publicIndexingEnabled()) reasons.push("public indexing disabled in this environment");
  if (!PSEO_INVENTORY.copyApproved) reasons.push("city template copy not founder-approved");
  const total = ridesNear(c.lat, c.lng).length;
  if (total < PSEO_INVENTORY.cityMinRides) reasons.push(`only ${total} rides within ${PSEO_INVENTORY.radiusMiles} mi`);
  return gate(reasons);
}

export function inventoryRideCityGate(c: City, rideType: string): GateResult {
  const reasons: string[] = [];
  if (!publicIndexingEnabled()) reasons.push("public indexing disabled in this environment");
  if (!PSEO_INVENTORY.copyApproved) reasons.push("ride + city template copy not founder-approved");
  const n = ridesNear(c.lat, c.lng).filter((r) => r.rideType === rideType).length;
  if (n < PSEO_INVENTORY.rideCityMinRides) reasons.push(`only ${n} matching rides within ${PSEO_INVENTORY.radiusMiles} mi`);
  return gate(reasons);
}

/** Every inventory page that would exist (has supply), with its gate. For the sitemap and docs. */
export function inventoryRoutes(): { path: string; family: string; gate: GateResult }[] {
  const out: { path: string; family: string; gate: GateResult }[] = [];
  for (const c of CITIES) {
    const st = US_STATES.find((s) => s.code === c.state)!;
    const near = ridesNear(c.lat, c.lng);
    if (near.length === 0) continue;
    out.push({ path: `/${st.slug}/${c.slug}`, family: "city", gate: inventoryCityGate(c) });
    const counts = new Map<string, number>();
    for (const r of near) if (r.rideType) counts.set(r.rideType, (counts.get(r.rideType) ?? 0) + 1);
    for (const [t, n] of counts) if (n >= PSEO_INVENTORY.rideCityMinRides) out.push({ path: `/${st.slug}/${c.slug}/${t}`, family: "ride-city", gate: inventoryRideCityGate(c, t) });
  }
  return out;
}

/**
 * Page metadata for inventory pages. Pages that fail only the environment/approval gates keep a
 * self-canonical (they are the canonical URL, just not open to indexing yet); pages without enough
 * supply get noindex and NO canonical, so a thin combination never presents itself as canonical.
 */
export function inventoryMetadata(opts: { path: string; title: string; description: string; gate: GateResult }) {
  const thin = opts.gate.reasons.some((r) => r.startsWith("only "));
  return {
    title: `${opts.title} | Carnival Ride Rental`,
    description: opts.description,
    ...(thin ? {} : { alternates: { canonical: canonicalUrl(opts.path) } }),
    robots: opts.gate.indexable ? { index: true, follow: true } : { index: false, follow: !thin },
  };
}
