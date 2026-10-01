// The one place public URLs are built. Every canonical, sitemap entry and
// internal link goes through these helpers so a route has exactly one form:
// lowercase slugs, no trailing slash, no query string.
import { siteUrl } from "@/lib/site";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STATE = /^[a-z]{2}$/;

function slug(s: string): string {
  if (!SLUG.test(s)) throw new Error(`Invalid slug: ${JSON.stringify(s)}`);
  return s;
}
function state(s: string): string {
  if (!STATE.test(s)) throw new Error(`Invalid state code: ${JSON.stringify(s)}`);
  return s;
}

export const paths = {
  home: () => "/",
  rides: () => "/rides",
  category: (category: string) => `/rides/category/${slug(category)}`,
  ride: (ride: string) => `/rides/${slug(ride)}`,
  city: (st: string, city: string) => `/locations/${state(st)}/${slug(city)}`,
  cityRide: (st: string, city: string, ride: string) =>
    `/locations/${state(st)}/${slug(city)}/${slug(ride)}`,
  request: (ride?: string) => (ride ? `/request?ride=${encodeURIComponent(slug(ride))}` : "/request"),
  requestStatus: (reference: string, token: string) =>
    `/requests/${encodeURIComponent(reference)}?t=${encodeURIComponent(token)}`,
};

export function absolute(path: string): string {
  if (!path.startsWith("/")) throw new Error(`Path must start with "/": ${path}`);
  const clean = path === "/" ? "" : path.replace(/\/+$/, "");
  return `${siteUrl()}${clean}`;
}
