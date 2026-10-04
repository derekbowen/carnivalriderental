import { siteUrl } from "../config";

/**
 * THE canonical URL structure. Every page family builds its path here and nowhere
 * else, so canonicals, internal links and sitemap entries cannot drift apart.
 *
 * Local pages hang directly off the domain (no /locations or /p prefix):
 *   /{state}                                state hub (cities, occasions, live supply)
 *   /{state}/{city}                         city service page
 *   /{state}/{city}/{ride}                  ride + city page
 *   /{state}/{occasion}                     occasion + state ("bar mitzvahs in Texas")
 * National hubs keep a short prefix (a bare /{slug} is reserved for states):
 *   /rides, /rides/{ride}                   ride rental offerings
 *   /categories/{category}                  ride category
 *   /events, /events/{occasion}             occasion index (noindex) + occasion hub
 *   /operators                              operator program (early access)
 *
 * City slugs and occasion ids share the /{state}/… namespace; checkSlugNamespaces()
 * fails the build on a collision. Old /locations, /rides/{ride}/{state}/{city} and
 * /events/{occasion}/{state} URLs redirect permanently (next.config.ts).
 *
 * Rules: lowercase, hyphenated slugs, no trailing slash, no query strings in
 * canonicals (filtered /rides?category=… views canonicalise to /rides).
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function seg(s: string): string {
  if (!SLUG.test(s)) throw new Error(`Invalid slug for canonical route: "${s}"`);
  return s;
}

export const paths = {
  home: () => "/",
  rides: () => "/rides",
  ride: (ride: string) => `/rides/${seg(ride)}`,
  rideCity: (ride: string, state: string, city: string) => `/${seg(state)}/${seg(city)}/${seg(ride)}`,
  /** Development previews of Sharetribe-backed catalog records (always noindex). */
  previewRide: (ride: string) => `/preview/rides/${seg(ride)}`,
  previewRideCity: (ride: string, state: string, city: string) => `/preview/rides/${seg(ride)}/${seg(state)}/${seg(city)}`,
  category: (category: string) => `/categories/${seg(category)}`,
  state: (state: string) => `/${seg(state)}`,
  city: (state: string, city: string) => `/${seg(state)}/${seg(city)}`,
  operators: () => "/operators",
  occasions: () => "/events",
  occasion: (occasion: string) => `/events/${seg(occasion)}`,
  occasionState: (occasion: string, state: string) => `/${seg(state)}/${seg(occasion)}`,
  request: (ride?: string, state?: string, city?: string, occasion?: string) => {
    const q = new URLSearchParams();
    if (ride) q.set("ride", seg(ride));
    if (state) q.set("state", seg(state));
    if (city) q.set("city", seg(city));
    if (occasion) q.set("occasion", seg(occasion));
    const s = q.toString();
    return s ? `/request?${s}` : "/request";
  },
};

export function canonicalUrl(path: string): string {
  if (path.includes("?")) throw new Error("Canonical URLs must not contain query strings");
  if (path !== "/" && path.endsWith("/")) throw new Error("Canonical URLs must not end with a slash");
  return `${siteUrl()}${path === "/" ? "" : path}` || siteUrl();
}
