import { notFound } from "next/navigation";
import { RideDetail } from "@/components/RideDetail";
import { getCategory, getContent, getLocation, getRide, getVerifiedCoverage } from "@/lib/content";
import { seoMetadata } from "@/lib/seo/metadata";
import { rideCityGate } from "@/lib/seo/publication";
import { paths } from "@/lib/seo/routes";

export const dynamicParams = false;
export const revalidate = 3600;

/** /{state}/{city}/{ride} */
type P = { state: string; slug: string; ride: string };

export function generateStaticParams(): P[] {
  const { rides, locations } = getContent();
  return rides.flatMap((r) => locations.map((l) => ({ state: l.stateSlug, slug: l.citySlug, ride: r.slug })));
}

function load(p: P) {
  const ride = getRide(p.ride);
  const location = getLocation(p.state, p.slug);
  return ride && location ? { ride, location } : null;
}

export async function generateMetadata({ params }: { params: Promise<P> }) {
  const d = load(await params);
  if (!d) return {};
  return seoMetadata({
    path: paths.rideCity(d.ride.slug, d.location.stateSlug, d.location.citySlug),
    title: `${d.ride.name} in ${d.location.cityName}, ${d.location.stateCode}`,
    description: `Request ${d.ride.name.toLowerCase()} for an event in ${d.location.cityName}. Find nearby operators with this ride and request it directly.`,
    gate: rideCityGate(d.ride, d.location),
  });
}

export default async function RideCityPage({ params }: { params: Promise<P> }) {
  const d = load(await params);
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
