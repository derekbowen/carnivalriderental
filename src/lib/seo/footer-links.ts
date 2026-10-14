/**
 * Global footer links, computed once from real pages. Every link is a page that exists and has
 * supply; city links are near-duplicate group heads only (src/lib/inventory/index-eligible.json),
 * so the footer never pushes sitewide links at pages that can't be indexed.
 */
import { CATEGORY_PAGES } from "../content/category-pages";
import { milesBetween } from "../catalog/operator-search";
import { CITIES, PSEO_INVENTORY, RIDES } from "../inventory";
import eligible from "../inventory/index-eligible.json";
import { occasionById, US_STATES } from "../taxonomy";
import { paths } from "./routes";

export interface FooterLink { href: string; label: string }

const eligibleCities = new Set((eligible as { paths: string[] }).paths.filter((p) => p.split("/").length === 3));
const stateOf = (code: string) => US_STATES.find((s) => s.code === code)!;

/** The most populous cities whose page is the head of its near-duplicate group. */
export const FOOTER_CITIES: FooterLink[] = CITIES.filter((c) => eligibleCities.has(`/${stateOf(c.state).slug}/${c.slug}`))
  .sort((a, b) => b.pop - a.pop)
  .slice(0, 12)
  .map((c) => ({ href: paths.city(stateOf(c.state).slug, c.slug), label: `${c.name}, ${stateOf(c.state).abbr}` }));

export const FOOTER_RIDE_TYPES: FooterLink[] = [
  ...CATEGORY_PAGES.map((c) => ({ href: paths.category(c.id), label: c.name })),
  { href: paths.rides(), label: "All ride types" },
];

const EVENT_IDS = ["school-carnivals", "company-picnics", "church-festivals", "community-festivals", "birthday-parties", "graduation-parties", "fall-festivals", "fourth-of-july-celebrations"];
export const FOOTER_EVENTS: FooterLink[] = [
  ...EVENT_IDS.map((id) => occasionById(id)).filter((o): o is NonNullable<typeof o> => !!o).map((o) => ({ href: paths.occasion(o.id), label: o.plural.charAt(0).toUpperCase() + o.plural.slice(1) })),
  { href: paths.occasions(), label: "All events" },
];

/** States with at least one city that has rides nearby. */
const hasSupply = (c: { lat: number; lng: number }) => RIDES.some((r) => milesBetween(c, r) <= PSEO_INVENTORY.radiusMiles);
export const FOOTER_STATES: FooterLink[] = US_STATES.filter((s) => CITIES.some((c) => c.state === s.code && hasSupply(c)))
  .map((s) => ({ href: paths.state(s.slug), label: s.name }));
