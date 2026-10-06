import type { Metadata } from "next";
import Link from "next/link";
import { ConnectForm } from "@/components/access/ConnectForm";
import { Breadcrumbs, JsonLd } from "@/components/pseo";
import { activeProduct } from "@/lib/access/config";
import { accessDb } from "@/lib/access/db";
import { accessAvailability } from "@/lib/access/runtime";
import { priceLabel } from "@/lib/access/service";
import { BRAND } from "@/lib/config";
import { RIDES, rideTypeFor } from "@/lib/inventory";
import { rideTypeCopy } from "@/lib/inventory/ride-type-copy";
import { categoryPageById } from "@/lib/content/category-pages";
import { paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";
import { occasionById, stateBySlug } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Connect with carnival ride operators | ${BRAND.name}`,
  robots: { index: false, follow: false },
};

type SP = { listing?: string; type?: string; class?: string; state?: string; city?: string; occasion?: string; category?: string; error?: string };

/** Category hubs → the ride type or class they stand for. */
const CATEGORY_CONTEXT: Record<string, { rideType?: string; rideClass?: string }> = {
  "ferris-wheels": { rideType: "ferris-wheel" },
  carousels: { rideType: "carousel" },
  "swing-rides": { rideType: "wave-swinger" },
  "kiddie-rides": { rideClass: "kiddie" },
  "thrill-rides": { rideClass: "major" },
};

export default async function ConnectPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const listing = sp.listing && /^[0-9a-f-]{36}$/.test(sp.listing) ? RIDES.find((r) => r.id === sp.listing) ?? null : null;
  const category = sp.category ? CATEGORY_CONTEXT[sp.category] : undefined;
  const rideType = listing?.rideType ?? (sp.type && rideTypeFor(sp.type) ? sp.type : category?.rideType ?? null);
  const rideClass = listing && !listing.rideType ? listing.rideClass : sp.class ?? category?.rideClass ?? null;
  const occasion = sp.occasion ? occasionById(sp.occasion) : undefined;
  const availability = accessAvailability();
  const product = availability.enabled ? await activeProduct(await accessDb()) : null;
  const crumbs = [{ name: "Home", path: paths.home() }, { name: "Connect with operators", path: "/connect" }];
  const typeLabel = rideType ? rideTypeCopy(rideType, rideTypeFor(rideType)?.name ?? rideType).label : null;
  const sourcePath = [sp.listing && paths.rideListing(sp.listing), sp.category && categoryPageById(sp.category) && paths.category(sp.category), sp.occasion && occasion && paths.occasion(occasion.id), sp.state && sp.city && paths.city(sp.state, sp.city), sp.state && !sp.city && paths.state(sp.state)].find(Boolean) as string | undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd nodes={pageGraph({ path: "/connect", name: "Connect with carnival ride operators", description: "Tell us about your event and see how many independent operators with matching equipment you can contact.", type: "WebPage", crumbs })} />
      <Breadcrumbs items={crumbs} />
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div>
          <p className="eyebrow">Event Access</p>
          <h1 className="mt-2 text-4xl">{typeLabel ? `Connect with ${typeLabel.toLowerCase()} operators` : "Connect with carnival ride operators"}</h1>
          <p className="mt-3 max-w-2xl text-ink-soft">
            Tell us where and when. We count the independent operators near your event with matching equipment and a working contact channel, and show you that number before you pay anything.
          </p>
          {!availability.enabled ? (
            <div className="mt-8 card p-6" data-testid="access-unavailable">
              <h2 className="text-xl">Event Access is opening soon</h2>
              <p className="mt-2 text-ink-soft">Payments aren&rsquo;t switched on for this site yet. Browse the inventory meanwhile, or email <a className="font-semibold underline" href={`mailto:support@${BRAND.domain}`}>support@{BRAND.domain}</a> and we&rsquo;ll help by hand.</p>
              <Link href={paths.search()} className="btn-primary mt-4">Browse rides</Link>
            </div>
          ) : (
            <div className="mt-8">
              <ConnectForm prefill={{ listingId: listing?.id ?? null, rideType, rideClass, state: sp.state ? sp.state.length === 2 ? sp.state : stateAbbr(sp.state) : null, city: sp.city ? sp.city.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : null, eventType: occasion ? occasionToEventType(occasion.id) : null, sourcePath }} today={new Date().toISOString().slice(0, 10)} error={sp.error ?? null} />
            </div>
          )}
        </div>
        <aside className="space-y-4 text-sm">
          {listing && (
            <div className="card overflow-hidden" data-testid="connect-context">
              {listing.photo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={listing.photo} alt={listing.title} className="aspect-[4/3] w-full object-cover" />
              )}
              <div className="p-5">
                <p className="text-xs font-semibold text-muted">Starting from this ride</p>
                <h2 className="text-lg">{listing.title}</h2>
                {listing.homeState && <p className="text-ink-soft">Operator based in {listing.homeState.toUpperCase()}</p>}
                <p className="mt-2 text-xs text-muted">We&rsquo;ll match this ride&rsquo;s operator and others with the same equipment near your event.</p>
              </div>
            </div>
          )}
          <div className="card p-5">
            <h2 className="text-lg">What {product?.name ?? "Event Access"} is</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-soft">
              <li>{product ? `${priceLabel(product)} once, for one event.` : "One fee, for one event."}</li>
              <li>Direct contact details (company, phone, email, website) for up to {product?.unlockLimit ?? 5} matching independent operators, for {product?.validityDays ?? 30} days.</li>
              <li>You see how many operators match before paying. We don&rsquo;t sell access when there are fewer than {product?.minimumMatches ?? 3}.</li>
              <li>Not a booking. Price, availability, contract, insurance and payment for the rental are agreed directly with the operator. We can&rsquo;t guarantee an operator is free on your date or replies.</li>
            </ul>
            <p className="mt-3 text-xs text-muted"><Link className="underline" href={paths.accessPolicy()}>Access and refund policy</Link> · <Link className="underline" href={paths.terms()}>Terms</Link></p>
          </div>
        </aside>
      </div>
    </div>
  );
}

const stateAbbr = (slug: string): string | null => stateBySlug(slug.toLowerCase())?.abbr.toUpperCase() ?? null;

function occasionToEventType(id: string): string | null {
  if (/school|pta|field-day|end-of-school|after-prom|project-graduation|homecoming|summer-camp|youth|college/.test(id)) return "school-carnival";
  if (/church|vacation-bible|purim|eid|communion|confirmation/.test(id)) return "church-festival";
  if (/company|corporate|employee|office/.test(id)) return "company-event";
  if (/festival|fair|national-night|farmers|rodeo|fourth|memorial|labor|easter|halloween|neighborhood|block-part|hoa|apartment|shopping|sports-venue|military/.test(id)) return "city-festival";
  if (/birthday|graduation|reunion|retirement|backyard|bar-mitzvah|bat-mitzvah|quincean|sweet-16/.test(id)) return "private-party";
  if (/wedding|engagement|anniversary/.test(id)) return "wedding";
  if (/grand-opening|customer-appreciation|dealership|trade-show/.test(id)) return "grand-opening";
  return null;
}
