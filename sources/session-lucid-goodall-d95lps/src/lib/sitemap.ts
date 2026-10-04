// Sitemap entries. Empty unless indexing is enabled; then only reviewed,
// published production records (never fixtures) are listed.
import { catalog } from "@/lib/catalog";
import { inSitemap } from "@/lib/catalog/publication";
import { indexingEnabled } from "@/lib/site";
import { absolute, paths } from "@/lib/urls";

export function buildSitemap(): string[] {
  if (!indexingEnabled()) return [];
  const urls = [paths.home(), paths.rides()];
  const raw = catalog.raw;
  for (const c of raw.categories()) if (inSitemap(c)) urls.push(paths.category(c.slug));
  for (const r of raw.rides()) if (inSitemap(r)) urls.push(paths.ride(r.slug));
  for (const c of raw.cities()) if (inSitemap(c)) urls.push(paths.city(c.state, c.slug));
  for (const p of raw.cityRides()) {
    const ride = raw.rides().find((r) => r.slug === p.ride);
    const city = raw.cities().find((c) => c.state === p.state && c.slug === p.city);
    if (ride && city && inSitemap(p, ride, city)) urls.push(paths.cityRide(p.state, p.city, p.ride));
  }
  return urls.map(absolute);
}
