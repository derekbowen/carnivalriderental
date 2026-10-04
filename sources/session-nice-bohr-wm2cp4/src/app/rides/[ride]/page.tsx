import { notFound } from "next/navigation";
import { RideDetail } from "@/components/RideDetail";
import { getCategory, getContent, getRide } from "@/lib/content";
import { seoMetadata } from "@/lib/seo/metadata";
import { rideGate } from "@/lib/seo/publication";
import { paths } from "@/lib/seo/routes";

export const dynamicParams = false;
export const revalidate = 3600;

export function generateStaticParams() {
  return getContent().rides.map((r) => ({ ride: r.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ ride: string }> }) {
  const ride = getRide((await params).ride);
  if (!ride) return {};
  return seoMetadata({ path: paths.ride(ride.slug), title: ride.name, description: ride.summary, gate: rideGate(ride) });
}

export default async function RidePage({ params }: { params: Promise<{ ride: string }> }) {
  const ride = getRide((await params).ride);
  if (!ride) notFound();
  return <RideDetail ride={ride} category={getCategory(ride.categorySlug)} otherLocations={getContent().locations} />;
}
