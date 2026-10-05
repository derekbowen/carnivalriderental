import type { Metadata } from "next";
import { ImageOffIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOperatorListing, marketplaceListingUrl } from "@/lib/catalog/operator-search";
import { BRAND } from "@/lib/config";
import { ESTIMATE_DISCLAIMER } from "@/lib/pricing/rate-card";
import { paths } from "@/lib/seo/routes";

export const revalidate = 60;

type P = { id: string };

export async function generateMetadata({ params }: { params: Promise<P> }): Promise<Metadata> {
  const ride = await getOperatorListing((await params).id);
  return { title: ride ? `${ride.title} | ${BRAND.name}` : BRAND.name, robots: { index: false, follow: true } };
}

/**
 * Our ride detail page. Shows only approved public facts: never the operator's company name,
 * city or description text (founder decision 2026-10-05: no bypassing the marketplace).
 */
export default async function RideListingPage({ params }: { params: Promise<P> }) {
  const ride = await getOperatorListing((await params).id);
  if (!ride) notFound();
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_340px]">
      <div>
        <Link href={paths.search()} className="text-sm text-ink-soft hover:underline">← All rides</Link>
        <div className="mt-4 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-placeholder">
          {ride.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ride.photo.src} alt={ride.photo.alt} className="h-full w-full object-cover" />
          ) : (
            <div role="img" aria-label="No photo yet" className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-soft">
              <ImageOffIcon className="h-8 w-8 opacity-60" aria-hidden="true" />
              <span className="text-sm">No photo yet</span>
            </div>
          )}
        </div>
        {ride.rideClassLabel && <p className="eyebrow mt-6">{ride.rideClassLabel}</p>}
        <h1 className="mt-2 text-4xl">{ride.title}</h1>
        {ride.homeState && (
          <p className="mt-2 flex items-center gap-1 text-ink-soft"><MapPinIcon className="h-4 w-4" aria-hidden="true" /> Operator based in {ride.homeState}</p>
        )}
        {ride.facts.length > 0 && (
          <dl className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface">
            {ride.facts.map((f) => (
              <div key={f.label} className="flex justify-between gap-4 px-5 py-3 text-sm">
                <dt className="text-muted">{f.label}</dt>
                <dd className="text-right font-medium">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="mt-4 text-xs text-muted">Details come from the operator&rsquo;s own published information. Confirm anything critical for your site with the operator through your request.</p>
      </div>
      <aside className="space-y-4 lg:pt-10">
        <div className="card p-5">
          <p className="text-lg font-semibold">{ride.estimate ?? "Request a quote"}</p>
          {ride.estimate && <p className="mt-1 text-xs text-muted">{ESTIMATE_DISCLAIMER}</p>}
          {!ride.claimed && <p className="mt-3 text-sm text-ink-soft">This operator hasn&rsquo;t joined Carnival Ride Rental yet. Requests go to our request desk, which contacts the operator for you.</p>}
          {ride.bookable ? (
            <a href={marketplaceListingUrl(ride)} className="btn-primary mt-4 w-full">Book this ride</a>
          ) : (
            <Link href={paths.requestRide(ride.id)} className="btn-primary mt-4 w-full">Request this ride</Link>
          )}
          <p className="mt-2 text-xs text-muted">No payment is taken to send a request. It is a request, not a booking.</p>
        </div>
      </aside>
    </div>
  );
}
