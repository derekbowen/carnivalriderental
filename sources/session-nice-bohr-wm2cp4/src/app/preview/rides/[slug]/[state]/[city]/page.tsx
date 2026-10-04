import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreviewBanner } from "@/components/PreviewBanner";
import { RideDetail } from "@/components/RideDetail";
import { coversState } from "@/lib/catalog/normalize";
import { getCatalogRecordBySlug } from "@/lib/catalog/source";
import { eligibleLocations, toRideViewModel } from "@/lib/catalog/view";
import { getCategory, getContent, getLocation } from "@/lib/content";
import { appEnv } from "@/lib/config";
import { paths } from "@/lib/seo/routes";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Catalog preview (city)", robots: { index: false, follow: false } };

export default async function PreviewRideCityPage({ params }: { params: Promise<{ slug: string; state: string; city: string }> }) {
  const p = await params;
  // Development previews only: never served in production (cards link nowhere there instead).
  if (appEnv() === "production") notFound();
  const { snap, record } = await getCatalogRecordBySlug(p.slug);
  const location = getLocation(p.state, p.city);
  // Only eligible coverage renders: an offering never appears for a state it does not cover.
  if (!record || !location || !coversState(record, location.stateCode)) notFound();
  return (
    <>
      <PreviewBanner source={snap.source} fetchedAt={snap.fetchedAt} listingId={record.listingId} withheld={record.withheld} />
      <RideDetail
        ride={toRideViewModel(record)}
        category={getCategory(record.categoryId)}
        location={location}
        otherLocations={eligibleLocations(record, getContent().locations).filter((l) => l.citySlug !== location.citySlug)}
        links={{ ride: paths.previewRide, rideCity: paths.previewRideCity }}
        sampleLabel={record.isTestSample ? "Test sample" : undefined}
      />
    </>
  );
}
