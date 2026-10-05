import { notFound } from "next/navigation";
import { RideDetail } from "@/components/RideDetail";
import { InventoryRideCityPage, rideCityCopy } from "@/components/InventoryPages";
import { cityBySlugs, inventoryMetadata, inventoryRideCityGate, PSEO_INVENTORY, ridesNear, rideTypeFor } from "@/lib/inventory";
import { getCategory, getContent, getLocation, getRide, getVerifiedCoverage } from "@/lib/content";
import { seoMetadata } from "@/lib/seo/metadata";
import { rideCityGate } from "@/lib/seo/publication";
import { paths } from "@/lib/seo/routes";

// Demo ride pages are prerendered; inventory ride + city pages render on first request (ISR).
export const dynamicParams = true;
export const revalidate = 3600;

/** /{state}/{city}/{ride} */
type P = { state: string; slug: string; ride: string };

export function generateStaticParams(): P[] {
  const { rides, locations } = getContent();
  return rides.flatMap((r) => locations.map((l) => ({ state: l.stateSlug, slug: l.citySlug, ride: r.slug })));
}

/** Real city + ride type with enough nearby supply; anything thinner is a 404, not a thin page. */
function loadInventory(p: P) {
  const c = cityBySlugs(p.state, p.slug);
  const t = rideTypeFor(p.ride);
  if (!c || !t) return null;
  const n = ridesNear(c.lat, c.lng).filter((r) => r.rideType === t.id).length;
  return n >= PSEO_INVENTORY.rideCityMinRides ? { c, t } : null;
}

function load(p: P) {
  const ride = getRide(p.ride);
  const location = getLocation(p.state, p.slug);
  return ride && location ? { ride, location } : null;
}

export async function generateMetadata({ params }: { params: Promise<P> }) {
  const p = await params;
  const inv = loadInventory(p);
  if (inv) return inventoryMetadata({ path: paths.rideCity(inv.t.id, inv.c.stateSlug, inv.c.slug), ...rideCityCopy(inv.c, inv.t), gate: inventoryRideCityGate(inv.c, inv.t.id) });
  const d = load(p);
  if (!d) return {};
  return seoMetadata({
    path: paths.rideCity(d.ride.slug, d.location.stateSlug, d.location.citySlug),
    title: `${d.ride.name} in ${d.location.cityName}, ${d.location.stateCode}`,
    description: `Request ${d.ride.name.toLowerCase()} for an event in ${d.location.cityName}. Find nearby operators with this ride and request it directly.`,
    gate: rideCityGate(d.ride, d.location),
  });
}

export default async function RideCityPage({ params }: { params: Promise<P> }) {
  const p = await params;
  const inv = loadInventory(p);
  if (inv) return <InventoryRideCityPage c={inv.c} t={inv.t} />;
  const d = load(p);
  if (!d) notFound();
  const others = getContent().locations.filter((l) => l.citySlug !== d.location.citySlug);
  return (
    <RideDetail
      ride={d.ride}
      category={getCategory(d.ride.categorySlug)}
      location={d.location}
      coverage={getVerifiedCoverage(d.ride.slug, d.location.stateSlug, d.location.citySlug)}
      otherLocations={others}
    />
  );
}
