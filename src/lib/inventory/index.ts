/**
 * Inventory-backed pSEO data layer: the public ride snapshot (rides.json, from
 * `npm run inventory:export`) and US cities (cities.json, from `npm run geo:cities`).
 *
 * Every page is built from real operator rides near a real place: counts, distances and ride types
 * are computed, never written. Operator identity is not in the snapshot at all.
 */
import { milesBetween, type OperatorCard } from "../catalog/operator-search";
import { publicIndexingEnabled } from "../config";
import type { GateResult } from "../seo/publication";
import { canonicalUrl, paths } from "../seo/routes";
import { stateBySlug, US_STATES } from "../taxonomy";
import rideTypesFile from "../taxonomy/ride-types.json";
import contract from "../../../contract/operator-listing-contract.json";
import citiesFile from "../geo/cities.json";
import eligibleFile from "./index-eligible.json";
import { approvedForIndexing, OPEN_INDEXING } from "./pilot";
import operatorsFile from "./operators.json";
import ridesFile from "./rides.json";
import testToLiveFile from "./test-to-live.json";

export interface InventoryRide {
  id: string;
  title: string;
  /** Optional until the refreshed live inventory snapshot is exported. */
  description?: string | null;
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
  /** Category hub this type belongs to (contract manifest category id), when it has one. */
  categoryId?: string;
}

export const RIDES = (ridesFile as { rides: InventoryRide[] }).rides;

/**
 * Listing ids from the Test marketplace (the catalog before the 2026-10-14 Live cutover) → the same
 * listing recreated in Live. Public ids only, no identity. Old /s/{id} links and ?listing= parameters
 * resolve through this map; ids that aren't in it are simply unknown (never redirected elsewhere).
 */
const TEST_TO_LIVE = (testToLiveFile as { map: Record<string, string> }).map;
export function liveListingIdFor(id: string): string | null {
  return TEST_TO_LIVE[id] ?? null;
}
export const INVENTORY_GENERATED_AT = (ridesFile as { generatedAt: string }).generatedAt;
export const CITIES = (citiesFile as { cities: City[] }).cities;
export const RIDE_TYPES: RideType[] = (rideTypesFile as { rideTypes: RideType[] }).rideTypes;
const CLASS_LABEL = new Map(contract.rideClass.options.map((o) => [o.option, o.label]));
export const CLASS_LABELS: ReadonlyMap<string, string> = CLASS_LABEL;

/**
 * Template settings. A page family becomes indexable only when its copy is founder-approved,
 * public indexing is switched on for the environment, AND the page has enough real supply.
 */
/**
 * Anonymous operator keys (scripts/inventory-operators.ts): opaque per-owner hashes used only to
 * count distinct operators ("listed by 4 operators"). Never an identity.
 */
const OPERATOR_KEY: Record<string, string> = (operatorsFile as { byListing: Record<string, string> }).byListing;
export const operatorKey = (listingId: string): string => OPERATOR_KEY[listingId] ?? `listing:${listingId}`;
/** Distinct operators behind a set of rides. */
export function operatorCount(rides: { id: string }[]): number {
  return new Set(rides.map((r) => operatorKey(r.id))).size;
}
/** Rides from operators other than the one that owns `ride`, same ride type, nearest first. */
export function similarRides(ride: InventoryRide, radius: number = PSEO_INVENTORY.radiusMiles): NearRide[] {
  if (!ride.rideType) return [];
  const own = operatorKey(ride.id);
  return ridesNear(ride.lat, ride.lng, radius).filter((r) => r.rideType === ride.rideType && r.id !== ride.id && operatorKey(r.id) !== own);
}

/** Ride types that belong to a category hub, taxonomy order. */
export const rideTypesInCategory = (categoryId: string): RideType[] => RIDE_TYPES.filter((t) => t.categoryId === categoryId);

export interface TypeStats {
  type: RideType;
  /** Listings of this type in the snapshot. */
  count: number;
  /** Distinct operators behind them. */
  operators: number;
  /** A representative operator photo, when any listing of the type has one. */
  photo: string | null;
}
const typeStatsCache = new Map<string, TypeStats>();
/** Inventory counts for one ride type (whole snapshot, no location). */
export function typeStats(t: RideType): TypeStats {
  const hit = typeStatsCache.get(t.id);
  if (hit) return hit;
  const rides = RIDES.filter((r) => r.rideType === t.id);
  const out = { type: t, count: rides.length, operators: operatorCount(rides), photo: rides.find((r) => r.photo)?.photo ?? null };
  typeStatsCache.set(t.id, out);
  return out;
}

/** Type stats for the rides an area can draw on: based in the state or listing it as a service state. */
export function typeStatsForState(stateCode: string): TypeStats[] {
  const code = stateCode.toLowerCase();
  const rides = RIDES.filter((r) => r.rideType && (r.homeState?.toLowerCase() === code || r.serviceStates.some((s) => s.toLowerCase() === code)));
  const byType = new Map<string, InventoryRide[]>();
  for (const r of rides) byType.set(r.rideType!, [...(byType.get(r.rideType!) ?? []), r]);
  return RIDE_TYPES.filter((t) => byType.has(t.id))
    .map((t) => ({ type: t, count: byType.get(t.id)!.length, operators: operatorCount(byType.get(t.id)!), photo: byType.get(t.id)!.find((r) => r.photo)?.photo ?? null }))
    .sort((a, b) => b.count - a.count || a.type.id.localeCompare(b.type.id));
}

const stateCountCache = new Map<string, number>();
/** Inventory rides based in or serving a state: the supply a state page shows (memoised; the snapshot is fixed per build). */
export function stateInventoryCount(stateCode: string): number {
  let n = stateCountCache.get(stateCode);
  if (n === undefined) stateCountCache.set(stateCode, (n = typeStatsForState(stateCode).reduce((sum, t) => sum + t.count, 0)));
  return n;
}

/**
 * Inventory rides for a category hub (no location): the category's ride types, photographed
 * listings first, at most one per operator so several companies are represented. Deterministic.
 */
export function ridesForCategory(categoryId: string, limit = 12): InventoryRide[] {
  const types = new Set(rideTypesInCategory(categoryId).map((t) => t.id));
  const pool = RIDES.filter((r) => r.rideType && types.has(r.rideType)).sort((a, b) => Number(!!b.photo) - Number(!!a.photo) || a.id.localeCompare(b.id));
  const seen = new Set<string>();
  const out: InventoryRide[] = [];
  for (const r of pool) {
    const op = operatorKey(r.id);
    if (seen.has(op)) continue;
    seen.add(op);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

export const SNAPSHOT_PAGE_SIZE = 24;
/** Ride search by canonical ride type, nearest to a point first, from the inventory snapshot (the live API has no ride-type field). */
export function snapshotSearch(q: { origin: { lat: number; lng: number }; rideType: string; page?: number }): { cards: OperatorCard[]; totalItems: number; totalPages: number; page: number } {
  const all = RIDES.filter((r) => r.rideType === q.rideType)
    .map((r) => ({ ...r, miles: Math.round(milesBetween(q.origin, r)) }))
    .sort((a, b) => a.miles - b.miles || a.id.localeCompare(b.id));
  const totalPages = Math.max(1, Math.ceil(all.length / SNAPSHOT_PAGE_SIZE));
  const page = Math.min(Math.max(1, q.page ?? 1), totalPages);
  return { cards: all.slice((page - 1) * SNAPSHOT_PAGE_SIZE, page * SNAPSHOT_PAGE_SIZE).map(toCard), totalItems: all.length, totalPages, page };
}

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
export function ridesNear(lat: number, lng: number, radius: number = PSEO_INVENTORY.radiusMiles): NearRide[] {
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
    description: r.description ?? null,
    rideClass: r.rideClass,
    rideClassLabel: r.rideClass ? CLASS_LABEL.get(r.rideClass) ?? null : null,
    homeState: r.homeState?.toUpperCase() ?? null,
    photo: r.photo ? { src: r.photo, alt: r.title } : null,
    photoLarge: null,
    miles: "miles" in r ? r.miles : null,
    // The snapshot holds no operator-approved prices yet, so every card reads "Priced by the operator".
    price: null,
    claimed: r.claimed,
    detailsReady: true,
  };
}

export interface CityStats {
  total: number;
  nearestMiles: number | null;
  byType: { type: RideType; count: number; nearestMiles: number }[];
  byClass: { id: string; label: string; count: number }[];
  operatorStates: string[];
  /** Distinct operators behind `total` (anonymous keys). */
  operators: number;
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
    operators: operatorCount(near),
  };
}

/** Other cities, nearest first, for internal links. */
export function nearbyCities(c: City, n = 12): (City & { miles: number; stateSlug: string })[] {
  return CITIES.filter((x) => !(x.state === c.state && x.slug === c.slug))
    .map((x) => ({ ...x, miles: Math.round(milesBetween(c, x)), stateSlug: US_STATES.find((s) => s.code === x.state)!.slug }))
    .sort((a, b) => a.miles - b.miles)
    .slice(0, n);
}

// ------------------------------------------------------------------------------ link graph
// Internal links between pSEO pages are made SYMMETRIC: if page A links to nearby page B, B links
// back to A. Each page links to its k nearest peers, plus every peer that lists it among theirs.

const cityKey = (c: City) => `${c.state}/${c.slug}`;
const withSlug = (c: City) => ({ ...c, stateSlug: US_STATES.find((s) => s.code === c.state)!.slug });
const NEAR_K = 12;

function symmetricNeighbours(nodes: City[], k: number): Map<string, City[]> {
  const nearest = new Map<string, City[]>();
  for (const c of nodes) {
    nearest.set(cityKey(c), nodes.filter((x) => x !== c).map((x) => ({ x, d: milesBetween(c, x) })).sort((a, b) => a.d - b.d).slice(0, k).map((o) => o.x));
  }
  const out = new Map<string, City[]>();
  for (const c of nodes) out.set(cityKey(c), [...nearest.get(cityKey(c))!]);
  for (const c of nodes) for (const n of nearest.get(cityKey(c))!) {
    const back = out.get(cityKey(n))!;
    if (!back.includes(c)) back.push(c);
  }
  for (const [kk, list] of out) {
    const me = nodes.find((x) => cityKey(x) === kk)!;
    list.sort((a, b) => milesBetween(me, a) - milesBetween(me, b));
  }
  return out;
}

let cityGraph: Map<string, City[]> | null = null;
/** Nearby city pages to link from a city page: its nearest 12 plus every city that links to it. */
export function linkedNearbyCities(c: City): (City & { stateSlug: string })[] {
  cityGraph ??= symmetricNeighbours(CITIES, NEAR_K);
  return (cityGraph.get(cityKey(c)) ?? []).map(withSlug);
}

const rideGraphs = new Map<string, Map<string, City[]>>();
/** Other cities with a page for the same ride type, linked symmetrically (nearest 12 + reverse). */
export function linkedRideCities(c: City, rideType: string): (City & { stateSlug: string })[] {
  let g = rideGraphs.get(rideType);
  if (!g) {
    const nodes = CITIES.filter((x) => ridesNear(x.lat, x.lng).filter((r) => r.rideType === rideType).length >= PSEO_INVENTORY.rideCityMinRides);
    g = symmetricNeighbours(nodes, NEAR_K);
    rideGraphs.set(rideType, g);
  }
  return (g.get(cityKey(c)) ?? []).map(withSlug);
}

/**
 * Where a ride listing sits in the page hierarchy, for its breadcrumbs and back links: the nearest
 * city page in the operator's home state that is index-eligible (else any with supply), and that
 * city's ride-type page when one exists for the ride's type.
 */
export function rideHome(r: { lat: number; lng: number; homeState: string | null; rideType: string | null }) {
  const st = r.homeState ? US_STATES.find((s) => s.code === r.homeState!.toLowerCase()) : undefined;
  if (!st) return null;
  const inState = CITIES.filter((c) => c.state === st.code && ridesNear(c.lat, c.lng).length >= PSEO_INVENTORY.cityMinRides)
    .map((c) => ({ c, d: milesBetween(c, r) }))
    .sort((a, b) => a.d - b.d);
  const pick = inState.find((x) => !duplicateGateReason(inventoryCityPath(x.c))) ?? inState[0];
  if (!pick) return { state: st, city: null, rideCityPath: null };
  const city = withSlug(pick.c);
  const hasRideCity = !!r.rideType && ridesNear(city.lat, city.lng).filter((x) => x.rideType === r.rideType).length >= PSEO_INVENTORY.rideCityMinRides;
  return { state: st, city, rideCityPath: hasRideCity ? inventoryRideCityPath(city, r.rideType!) : null };
}

const gate = (reasons: string[]): GateResult => ({ indexable: reasons.length === 0, reasons });

const stateSlugOf = (c: City) => US_STATES.find((s) => s.code === c.state)!.slug;
export const inventoryCityPath = (c: City) => `/${stateSlugOf(c)}/${c.slug}`;
export const inventoryRideCityPath = (c: City, rideType: string) => `/${stateSlugOf(c)}/${c.slug}/${rideType}`;

/**
 * Near-duplicate gate (founder decision 2026-10-05, option 1). Adjacent cities share most listings,
 * so only one page per near-duplicate group (its head) may be indexed; the rest stay live for
 * visitors but noindex. The list comes from `npm run pseo:duplicates` and is tied to the snapshot it
 * was computed from: if the snapshot changes and the list isn't regenerated, nothing is indexable.
 */
const ELIGIBLE = eligibleFile as { inventoryGeneratedAt: string; paths: string[] };
const eligiblePaths = new Set(ELIGIBLE.paths);
export function duplicateGateReason(path: string): string | null {
  if (ELIGIBLE.inventoryGeneratedAt !== INVENTORY_GENERATED_AT) return "near-duplicate map is stale (run npm run pseo:duplicates)";
  return eligiblePaths.has(path) ? null : "near-duplicate of a nearby city page (not its group head)";
}

/**
 * Indexable only when ALL hold: public indexing on for the environment; the page is approved for
 * indexing (open indexing, or the template copy approved, or the exact path in an approved wave:
 * pilot.ts); the page meets its supply threshold; and, unless open indexing is on, the page is the
 * head of its near-duplicate group. Approval never bypasses the environment or supply gates.
 */
export function inventoryCityGate(c: City): GateResult {
  const reasons: string[] = [];
  if (!publicIndexingEnabled()) reasons.push("public indexing disabled in this environment");
  if (!PSEO_INVENTORY.copyApproved && !approvedForIndexing(inventoryCityPath(c))) reasons.push("city template copy not founder-approved");
  const total = ridesNear(c.lat, c.lng).length;
  if (total < PSEO_INVENTORY.cityMinRides) reasons.push(`only ${total} rides within ${PSEO_INVENTORY.radiusMiles} mi`);
  else if (!OPEN_INDEXING.enabled) {
    const dup = duplicateGateReason(inventoryCityPath(c));
    if (dup) reasons.push(dup);
  }
  return gate(reasons);
}

export function inventoryRideCityGate(c: City, rideType: string): GateResult {
  const reasons: string[] = [];
  if (!publicIndexingEnabled()) reasons.push("public indexing disabled in this environment");
  if (!PSEO_INVENTORY.copyApproved && !approvedForIndexing(inventoryRideCityPath(c, rideType))) reasons.push("ride + city template copy not founder-approved");
  const n = ridesNear(c.lat, c.lng).filter((r) => r.rideType === rideType).length;
  if (n < PSEO_INVENTORY.rideCityMinRides) reasons.push(`only ${n} matching rides within ${PSEO_INVENTORY.radiusMiles} mi`);
  else if (!OPEN_INDEXING.enabled) {
    const dup = duplicateGateReason(inventoryRideCityPath(c, rideType));
    if (dup) reasons.push(dup);
  }
  return gate(reasons);
}

/**
 * Core national hubs of the indexing cohort (homepage, /rides). Both are built from the inventory
 * snapshot. Indexable only when indexing is on for the environment, the exact path is in the
 * approved cohort (pilot.ts corePaths), and a real inventory stands behind it (at least the city
 * threshold of rides). Never demo fixtures: those are gone from public pages and off in production.
 */
export function coreHubGate(path: string): GateResult {
  const reasons: string[] = [];
  if (!publicIndexingEnabled()) reasons.push("public indexing disabled in this environment");
  if (!approvedForIndexing(path)) reasons.push("not in the approved indexing cohort");
  if (RIDES.length < PSEO_INVENTORY.cityMinRides) reasons.push(`only ${RIDES.length} rides in the inventory snapshot`);
  return gate(reasons);
}
export const coreRoutes = (): { path: string; family: string; gate: GateResult }[] => ["/", "/rides"].map((path) => ({ path, family: "core", gate: coreHubGate(path) }));

const categoryCountCache = new Map<string, number>();
/** Inventory rides in a category (the supply a category hub shows; memoised, the snapshot is fixed per build). */
export function categoryInventoryCount(categoryId: string): number {
  let n = categoryCountCache.get(categoryId);
  if (n === undefined) {
    const types = new Set(rideTypesInCategory(categoryId).map((t) => t.id));
    categoryCountCache.set(categoryId, (n = RIDES.filter((r) => r.rideType && types.has(r.rideType)).length));
  }
  return n;
}

/** Site directory pages (/directory, /directory/{state}): same environment and approval gates. */
export function directoryGate(): GateResult {
  const reasons: string[] = [];
  if (!publicIndexingEnabled()) reasons.push("public indexing disabled in this environment");
  if (!PSEO_INVENTORY.copyApproved && !OPEN_INDEXING.enabled) reasons.push("directory not founder-approved");
  return gate(reasons);
}
export function directoryRoutes(): { path: string; family: string; gate: GateResult }[] {
  const g = directoryGate();
  return [{ path: "/directory", family: "directory", gate: g }, ...US_STATES.map((s) => ({ path: `/directory/${s.slug}`, family: "directory", gate: g }))];
}

/**
 * Ride listing pages (/s/{id}): one page per listing, with its own photo, facts and description.
 * Same environment and approval gates as the other families; a listing that left the catalog 404s.
 */
export function rideListingGate(id: string): GateResult {
  const reasons: string[] = [];
  if (!publicIndexingEnabled()) reasons.push("public indexing disabled in this environment");
  if (!approvedForIndexing(paths.rideListing(id))) reasons.push("ride listing pages not approved for indexing");
  return gate(reasons);
}
/** Every listing in the inventory snapshot, with its gate. For the sitemap. */
export const listingRoutes = (): { path: string; family: string; gate: GateResult }[] =>
  RIDES.map((r) => ({ path: paths.rideListing(r.id), family: "listing", gate: rideListingGate(r.id) }));

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
    // The brand suffix only when the whole title still fits the ~60 characters search results show.
    title: `${opts.title} | Carnival Ride Rental`.length <= 60 ? `${opts.title} | Carnival Ride Rental` : opts.title,
    description: opts.description,
    ...(thin ? {} : { alternates: { canonical: canonicalUrl(opts.path) } }),
    robots: opts.gate.indexable ? { index: true, follow: true } : { index: false, follow: !thin },
  };
}
