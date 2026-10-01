import { siteUrl } from "../config";

/**
 * THE canonical URL structure. Every page family builds its path here and nowhere
 * else, so canonicals, internal links and sitemap entries cannot drift apart.
 *
 *   /rides                                  browse all ride rental offerings
 *   /rides/{ride}                           ride rental offering
 *   /rides/{ride}/{state}/{city}            ride + location page
 *   /categories/{category}                  ride category
 *   /locations/{state}/{city}               city service page
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
  rideCity: (ride: string, state: string, city: string) => `/rides/${seg(ride)}/${seg(state)}/${seg(city)}`,
  category: (category: string) => `/categories/${seg(category)}`,
  city: (state: string, city: string) => `/locations/${seg(state)}/${seg(city)}`,
  request: (ride?: string, state?: string, city?: string) => {
    const q = new URLSearchParams();
    if (ride) q.set("ride", seg(ride));
    if (state) q.set("state", seg(state));
    if (city) q.set("city", seg(city));
    const s = q.toString();
    return s ? `/request?${s}` : "/request";
  },
};

export function canonicalUrl(path: string): string {
  if (path.includes("?")) throw new Error("Canonical URLs must not contain query strings");
  if (path !== "/" && path.endsWith("/")) throw new Error("Canonical URLs must not end with a slash");
  return `${siteUrl()}${path === "/" ? "" : path}` || siteUrl();
}
