/**
 * Site directory (/directory, /directory/{state}): a crawlable, human-readable index of every page
 * worth visiting. Built from the same data and gates as the pages it links to, so it can never link
 * a page that doesn't exist:
 *   - every city page with enough supply (thin and empty city pages are left out),
 *   - every ride type + city page for index-eligible cities (other cities' ride-type pages are one
 *     click away on the city page itself),
 *   - every ride listing from operators based in the state (/s/{id}),
 *   - national ride-type and event hubs.
 */
import { CATEGORY_PAGES } from "../content/category-pages";
import { CITIES, CLASS_LABELS, duplicateGateReason, inventoryCityPath, PSEO_INVENTORY, RIDES, cityStats, type City } from "../inventory";
import { rideTypeCopy } from "../inventory/ride-type-copy";
import { OCCASIONS, US_STATES, type UsState } from "../taxonomy";
import { paths } from "./routes";

export interface DirLink { href: string; label: string; count?: number }
export interface DirCity extends DirLink { eligible: boolean; rideTypes: DirLink[] }

const supplyCities = (code: string) =>
  CITIES.filter((c) => c.state === code)
    .map((c) => ({ c, stats: cityStats(c) }))
    .filter((x) => x.stats.total >= PSEO_INVENTORY.cityMinRides)
    .sort((a, b) => a.c.name.localeCompare(b.c.name));

export function directoryStates(): (DirLink & { state: UsState })[] {
  return US_STATES.map((s) => ({ state: s, href: paths.directoryState(s.slug), label: s.name, count: supplyCities(s.code).length }));
}

export function directoryForState(st: UsState) {
  const cities: DirCity[] = supplyCities(st.code).map(({ c, stats }) => {
    const eligible = !duplicateGateReason(inventoryCityPath(c));
    return {
      href: paths.city(st.slug, c.slug),
      label: c.name,
      count: stats.total,
      eligible,
      rideTypes: eligible
        ? stats.byType.filter((t) => t.count >= PSEO_INVENTORY.rideCityMinRides).map((t) => ({ href: paths.rideCity(t.type.id, st.slug, c.slug), label: rideTypeCopy(t.type.id, t.type.name).label, count: t.count }))
        : [],
    };
  });
  const rides: DirLink[] = RIDES.filter((r) => r.homeState === st.code)
    .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))
    .map((r) => ({ href: paths.rideListing(r.id), label: r.rideClass ? `${r.title} (${CLASS_LABELS.get(r.rideClass) ?? r.rideClass})` : r.title }));
  return { cities, rides };
}

export const DIRECTORY_RIDE_TYPES: DirLink[] = [...CATEGORY_PAGES.map((c) => ({ href: paths.category(c.id), label: c.name })), { href: paths.rides(), label: "All ride types" }];
export const DIRECTORY_EVENTS: DirLink[] = OCCASIONS.map((o) => ({ href: paths.occasion(o.id), label: o.plural.charAt(0).toUpperCase() + o.plural.slice(1) }));
export type { City };
