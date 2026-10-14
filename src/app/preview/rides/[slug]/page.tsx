import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreviewBanner } from "@/components/PreviewBanner";
import { RideDetail } from "@/components/RideDetail";
import { getCatalogRecordBySlug } from "@/lib/catalog/source";
import { eligibleLocations, toRideViewModel } from "@/lib/catalog/view";
import { getCategory, getContent } from "@/lib/content";
import { appEnv } from "@/lib/config";
import { paths } from "@/lib/seo/routes";

// Live Sharetribe-backed preview: rendered per request from the cached catalog snapshot.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Catalog preview", robots: { index: false, follow: false } };

export default async function PreviewRidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  // Development previews only: never served in production (cards link nowhere there instead).
  if (appEnv() === "production") notFound();
  const { snap, record } = await getCatalogRecordBySlug(slug);
  if (!record) notFound();
  const ride = toRideViewModel(record);
  return (
    <>
      <PreviewBanner source={snap.source} fetchedAt={snap.fetchedAt} listingId={record.listingId} withheld={record.withheld} />
      <RideDetail
        ride={ride}
        category={getCategory(record.categoryId)}
        otherLocations={eligibleLocations(record, getContent().locations)}
        links={{ ride: paths.previewRide, rideCity: paths.previewRideCity }}
        sampleLabel={record.isTestSample ? "Test sample" : undefined}
      />
    </>
  );
}
