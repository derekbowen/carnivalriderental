import type { Metadata } from "next";
import { EventRequestForm } from "@/components/request/EventRequestForm";
import { getContent, getLocation, getRide } from "@/lib/content";
import { PricingNotice } from "@/components/PricingNotice";
import { JsonLd } from "@/components/pseo";
import { BRAND } from "@/lib/config";
import { paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";
import { categoryPageById } from "@/lib/content/category-pages";
import { occasionById, stateBySlug } from "@/lib/taxonomy";
import { getOperatorListing } from "@/lib/catalog/operator-search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Start an event request | ${BRAND.name}`,
  robots: { index: false, follow: false },
};

type SP = { ride?: string; state?: string; city?: string; cityName?: string; date?: string; occasion?: string; category?: string; listing?: string };

export default async function RequestPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ride = sp.ride ? getRide(sp.ride) : undefined;
  const loc = sp.state && sp.city ? getLocation(sp.state, sp.city) : undefined;
  // Homepage free-text "City, ST"
  const m = sp.cityName?.match(/^\s*([^,]+?)\s*(?:,\s*([A-Za-z]{2}))?\s*$/);
  // From state and occasion pages: state slug alone, occasion id → contract eventType.
  const stateOnly = !loc && sp.state ? stateBySlug(sp.state) : undefined;
  const occasion = sp.occasion ? occasionById(sp.occasion) : undefined;
  // From category hubs: the ride type goes into the notes (the ride picker lists offerings, not categories).
  const category = sp.category ? categoryPageById(sp.category) : undefined;
  // From /s "Request this ride": the operator listing goes into the notes (it is not a managed offering).
  const listing = sp.listing ? await getOperatorListing(sp.listing) : null;
  const noteLines = [
    listing && `Requested ride: ${listing.title}${listing.company ? ` (${listing.company}${listing.base ? `, ${listing.base}` : ""})` : ""} [listing ${listing.id}]`,
    category && `Ride type: ${category.name}`,
    occasion && `Occasion: ${occasion.name}`,
  ].filter(Boolean);
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
