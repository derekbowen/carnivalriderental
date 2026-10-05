import type { Metadata } from "next";
import { EventRequestForm } from "@/components/request/EventRequestForm";
import { getContent, getLocation, getRide } from "@/lib/content";
import { PricingNotice } from "@/components/PricingNotice";
import { ESTIMATE_DISCLAIMER } from "@/lib/pricing/rate-card";
import { JsonLd } from "@/components/pseo";
import { BRAND } from "@/lib/config";
import { paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";
import { categoryPageById } from "@/lib/content/category-pages";
import { occasionById, stateBySlug } from "@/lib/taxonomy";
import { getOperatorListing, isListingId } from "@/lib/catalog/operator-search";
import { RideRequestForm } from "@/components/request/RideRequestForm";
import { INQUIRY_ALIAS } from "@/lib/operators/claim";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Start an event request | ${BRAND.name}`,
  robots: { index: false, follow: false },
};

type SP = { ride?: string; state?: string; city?: string; cityName?: string; date?: string; occasion?: string; category?: string; listing?: string };

export default async function RequestPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  // From /s "Request this ride": a marketplace inquiry for one operator ride.
  if (sp.listing) return <OperatorRideRequest listingId={sp.listing} />;
  // Marketplace deployments (request desk configured): general requests go to the desk too, so they
  // are saved in Sharetribe. The legacy managed form below stays for local/e2e environments only.
  if (process.env.REQUEST_DESK_LISTING_ID) return <OperatorRideRequest listingId={null} />;
  const ride = sp.ride ? getRide(sp.ride) : undefined;
  const loc = sp.state && sp.city ? getLocation(sp.state, sp.city) : undefined;
  // Homepage free-text "City, ST"
  const m = sp.cityName?.match(/^\s*([^,]+?)\s*(?:,\s*([A-Za-z]{2}))?\s*$/);
  // From state and occasion pages: state slug alone, occasion id → contract eventType.
  const stateOnly = !loc && sp.state ? stateBySlug(sp.state) : undefined;
  const occasion = sp.occasion ? occasionById(sp.occasion) : undefined;
  // From category hubs: the ride type goes into the notes (the ride picker lists offerings, not categories).
  const category = sp.category ? categoryPageById(sp.category) : undefined;
  const noteLines = [category && `Ride type: ${category.name}`, occasion && `Occasion: ${occasion.name}`].filter(Boolean);
  const prefill = {
    rideSlug: ride?.slug,
    city: loc?.cityName ?? m?.[1],
    state: loc?.stateCode ?? stateOnly?.abbr ?? m?.[2]?.toUpperCase(),
    eventType: occasion?.eventType,
    notes: noteLines.length ? noteLines.join("\n") : undefined,
    date: sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : undefined,
  };
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_320px]">
      <div>
        <JsonLd nodes={pageGraph({ path: paths.request(), name: "Start an event request", description: "Tell us about your event so we can source a carnival ride and crew.", type: "WebPage" })} />
        <p className="eyebrow">Event request</p>
        <h1 className="mt-2 text-4xl">Tell us about your event</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">About three minutes. We use this brief to find a suitable ride and operating crew, then send you a written quote.</p>
        <div className="mt-8">
          <EventRequestForm rides={getContent().rides.map((r) => ({ slug: r.slug, name: r.name }))} prefill={prefill} />
        </div>
      </div>
      <aside className="space-y-4 text-sm lg:pt-28">
        <PricingNotice compact />
        <div className="card p-5">
          <h2 className="text-lg">What a request is</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
            <li>A brief our team works from — not a booking.</li>
            <li>No payment details are collected yet — online payment is not open.</li>
            <li>You get a private status page to follow progress.</li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

const ANY_RIDE = { id: "", title: "Help me choose a ride", homeState: null, photo: null, rideClassLabel: null, estimate: null, claimed: false } as const;

async function OperatorRideRequest({ listingId }: { listingId: string | null }) {
  const ride = listingId === null ? ANY_RIDE : isListingId(listingId) ? await getOperatorListing(listingId) : null;
  const clientId = process.env.SHARETRIBE_CLIENT_ID;
  const desk = process.env.REQUEST_DESK_LISTING_ID;
  const marketplaceUrl = (process.env.SHARETRIBE_MARKETPLACE_URL ?? "").replace(/\/$/, "");
  if (!ride || !clientId || !desk || !marketplaceUrl) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl">{ride ? "Requests are unavailable right now" : "We couldn't find that ride"}</h1>
        <p className="mt-3 text-ink-soft">{ride ? "Please try again shortly." : "It may have been removed."} Nothing was sent.</p>
        <Link className="btn-primary mt-6" href={paths.search()}>Back to ride search</Link>
      </div>
    );
  }
  // Claimed (verified) operators receive requests on their own listing; everything else goes to the desk.
  const toDesk = !ride.claimed;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_320px]">
      <div>
        <p className="eyebrow">Ride request</p>
        <h1 className="mt-2 text-4xl">{ride.id ? `Request ${ride.title}` : "Tell us about your event"}</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          {!ride.id
            ? "Not sure which ride? Your request goes to the Carnival Ride Rental request desk. We suggest rides and operators near your event and reply in your marketplace inbox."
            : toDesk
            ? "This ride's operator hasn't joined Carnival Ride Rental yet, so your request goes to our request desk, not to them. We contact the operator and reply in your marketplace inbox."
            : "Your request goes to the ride's operator, who replies in your marketplace inbox."}
        </p>
        <div className="mt-8">
          <RideRequestForm
            target={{ listingId: toDesk ? desk : ride.id, processAlias: INQUIRY_ALIAS, toDesk, ride: { id: ride.id, title: ride.title } }}
            clientId={clientId}
            marketplaceUrl={marketplaceUrl}
            today={today}
          />
        </div>
      </div>
      <aside className="space-y-4 text-sm lg:pt-28">
        {!ride.id ? (
          <Link className="btn-ghost w-full" href={paths.search()}>Browse rides near you first</Link>
        ) : (
        <div className="card overflow-hidden">
          {ride.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ride.photo.src} alt={ride.photo.alt} className="aspect-[4/3] w-full object-cover" />
          )}
          <div className="p-5">
            {ride.rideClassLabel && <p className="text-xs font-semibold text-muted">{ride.rideClassLabel}</p>}
            <h2 className="text-lg">{ride.title}</h2>
            {ride.homeState && <p className="text-ink-soft">Operator based in {ride.homeState}</p>}
            <p className="mt-2 font-semibold">{ride.estimate ?? "Request a quote"}</p>
            {ride.estimate && <p className="text-xs text-muted">{ESTIMATE_DISCLAIMER}</p>}
          </div>
        </div>
        )}
      </aside>
    </div>
  );
}
