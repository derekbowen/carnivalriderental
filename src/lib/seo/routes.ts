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
 *   /directory, /directory/{state}          site directory (every location, ride type, listing)
 *   /connect, /connect/{eventRequest}       Event Access funnel (noindex, no-store)
 *   /pass/{pass}                            a customer's access pass (private, no-store, noindex)
 *   /terms, /privacy, /access-policy, /contact
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
  /** Operator ride search, nearest first (noindex; query strings only for paging/filters). */
  search: (q: { rideClass?: string; page?: number; near?: string; state?: string } = {}) => {
    const p = new URLSearchParams();
    if (q.rideClass) p.set("class", seg(q.rideClass));
    if (q.near) p.set("near", q.near);
    else if (q.state) p.set("state", seg(q.state));
    if (q.page && q.page > 1) p.set("page", String(q.page));
    const s = p.toString();
    return s ? `/s?${s}` : "/s";
  },
  /** Our own ride detail page for one operator listing (no operator identity shown). */
  rideListing: (listingId: string) => {
    if (!/^[0-9a-f-]{36}$/.test(listingId)) throw new Error(`Invalid listing id: "${listingId}"`);
    return `/s/${listingId}`;
  },
  /** Event Access entry. Context from the originating page is carried as query params (never canonical). */
  connect: (ctx: { listing?: string; rideType?: string; rideClass?: string; state?: string; city?: string; occasion?: string; category?: string } = {}) => {
    const q = new URLSearchParams();
    if (ctx.listing) {
      if (!/^[0-9a-f-]{36}$/.test(ctx.listing)) throw new Error(`Invalid listing id: "${ctx.listing}"`);
      q.set("listing", ctx.listing);
    }
    if (ctx.rideType) q.set("type", seg(ctx.rideType));
    if (ctx.rideClass) q.set("class", seg(ctx.rideClass));
    if (ctx.state) q.set("state", seg(ctx.state));
    if (ctx.city) q.set("city", seg(ctx.city));
    if (ctx.occasion) q.set("occasion", seg(ctx.occasion));
    if (ctx.category) q.set("category", seg(ctx.category));
    const s = q.toString();
    return s ? `/connect?${s}` : "/connect";
  },
  /** "Connect with operators" for one listing. */
  connectListing: (listingId: string) => paths.connect({ listing: listingId }),
  connectMatches: (eventRequestId: string) => `/connect/${seg(eventRequestId)}`,
  pass: (passId: string) => `/pass/${seg(passId)}`,
  passRecover: () => "/pass/recover",
  terms: () => "/terms",
  privacy: () => "/privacy",
  accessPolicy: () => "/access-policy",
  contact: () => "/contact",
  directory: () => "/directory",
  directoryState: (state: string) => `/directory/${seg(state)}`,
  occasions: () => "/events",
  occasion: (occasion: string) => `/events/${seg(occasion)}`,
  occasionState: (occasion: string, state: string) => `/${seg(state)}/${seg(occasion)}`,
  /** Legacy alias (2026-10-06): the request flow became Event Access; /request redirects to /connect. */
  request: (ride?: string, state?: string, city?: string, occasion?: string, category?: string) =>
    paths.connect({ rideType: ride && ride !== "ferris-wheel-rental" ? undefined : ride ? "ferris-wheel" : undefined, state, city, occasion, category }),
};

export function canonicalUrl(path: string): string {
  if (path.includes("?")) throw new Error("Canonical URLs must not contain query strings");
  if (path !== "/" && path.endsWith("/")) throw new Error("Canonical URLs must not end with a slash");
  return `${siteUrl()}${path === "/" ? "" : path}` || siteUrl();
}
