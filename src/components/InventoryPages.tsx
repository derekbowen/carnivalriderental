import Link from "next/link";
import { Breadcrumbs, FaqSection, JsonLd, LinkGrid } from "@/components/pseo";
import { RequestCta } from "@/components/RequestCta";
import { RideResult } from "@/components/search/RideResult";
import { cityStats, nearbyCities, PSEO_INVENTORY, ridesNear, toCard, type City, type RideType } from "@/lib/inventory";
import { countNoun, rideTypeCopy, titleCase } from "@/lib/inventory/ride-type-copy";
import { canonicalUrl, paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";
import type { Faq } from "@/lib/taxonomy";

/**
 * Inventory-backed pSEO templates (city; ride type + city). Customer-facing intro first, inventory
 * facts on a separate secondary line, computed from the ride snapshot. Nothing identifies an
 * operator. Prices follow src/lib/pricing/public-price.ts ("Request a quote" unless an approved
 * operator rate exists), so no dollar figures appear in copy, FAQs, metadata or structured data.
 *
 * Structured data is limited to what the page visibly shows: CollectionPage, BreadcrumbList, the
 * site's rental Service (as on every page), FAQPage for the visible FAQ, and an ItemList naming the
 * visible ride cards. No Offer, price, availability, rating, review, address or Event.
 */
type PlaceCity = City & { stateName: string; stateAbbr: string; stateSlug: string };

const R = PSEO_INVENTORY.radiusMiles;
const fmt = (n: number) => n.toLocaleString("en-US");
const DISTANCE_NOTE = "Distance is measured from operator home bases. Event availability and delivery must be confirmed.";
const CTA_BODY = "Share your event date, location and site details. A request is not a booking and takes no payment.";

function rideItemList(path: string, name: string, titles: string[]) {
  return {
    "@type": "ItemList",
    "@id": `${canonicalUrl(path)}#rides`,
    name,
    numberOfItems: titles.length,
    itemListElement: titles.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t })),
  };
}

const REQUEST_FAQ: Faq = {
  q: "Is sending a request the same as booking?",
  a: "No. A request takes no payment and is not a booking. Pricing, date availability and delivery are confirmed for your event before anything is booked.",
};
const PRICE_FAQ: Faq = {
  q: "How is a ride priced?",
  a: "Rides are priced per event. Send your date, location, hours and site details with a quote request; costs such as delivery distance, power, permits or staffing vary by event and are confirmed in the quote.",
};

// ------------------------------------------------------------------------------ city

export function cityCopy(c: PlaceCity) {
  const s = cityStats(c);
  return {
    title: `Carnival Ride Rentals Near ${c.name}, ${c.stateAbbr}`,
    description: s.total > 0
      ? `Carnival rides for your ${c.name} event. Browse ${fmt(s.total)} ride listings from operators based within ${R} miles and request a quote for your date and location.`
      : `Carnival rides for your ${c.name} event. Send a request and we'll look for operators who can serve your date and location.`,
  };
}

export function InventoryCityPage({ c }: { c: PlaceCity }) {
  const s = cityStats(c);
  const near = ridesNear(c.lat, c.lng);
  const path = paths.city(c.stateSlug, c.slug);
  const crumbs = [{ name: "Home", path: paths.home() }, { name: c.stateName, path: paths.state(c.stateSlug) }, { name: c.name, path }];
  const { title, description } = cityCopy(c);
  const types = s.byType.filter((t) => t.count >= PSEO_INVENTORY.rideCityMinRides);
  const nearCities = nearbyCities(c, 12);
  const searchHere = (rideClass?: string) => paths.search({ near: `${c.lat.toFixed(2)},${c.lng.toFixed(2)}`, rideClass });
  const faq: Faq[] = [
    { q: `How many rides can I browse near ${c.name}?`, a: `${fmt(s.total)} ride listings from operators based within ${R} miles of ${c.name}, ${c.stateAbbr}. A listing is not a confirmation that a ride is free on your date; availability and delivery are confirmed when you request a quote.` },
    PRICE_FAQ,
    REQUEST_FAQ,
  ];
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd nodes={[...pageGraph({ path, name: title, description, type: "CollectionPage", crumbs, service: { areaServed: { type: "City", name: `${c.name}, ${c.stateAbbr}` } }, faq: s.total > 0 ? faq : undefined }), ...(near.length ? [rideItemList(path, `Ride listings near ${c.name}`, near.slice(0, 12).map((r) => r.title))] : [])]} />
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-6 text-4xl">Carnival rides for your {c.name} event.</h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-soft">
        Bring the fun to your school fundraiser, company party, festival, or celebration. Explore ride listings and request pricing for your event date and location.
      </p>
      {s.total > 0 ? (
        <p className="mt-3 text-sm text-muted" data-testid="inventory-line">Browse {fmt(s.total)} listings from operators based within {R} miles of {c.name}.</p>
      ) : (
        <p className="mt-3 text-sm text-muted" data-testid="inventory-line">We don&rsquo;t list operators based within {R} miles of {c.name} yet. You can still send a request to our request desk.</p>
      )}

      {s.byClass.length > 0 && (
        <nav aria-label="Ride types near this city" className="mt-6 flex flex-wrap gap-2">
          {s.byClass.map((k) => (
            <Link key={k.id} href={searchHere(k.id)} className="inline-flex min-h-11 items-center rounded-full border border-line-strong bg-surface px-4 text-sm hover:border-ink">
              {k.label} <span className="ml-1.5 text-muted">{fmt(k.count)}</span>
            </Link>
          ))}
        </nav>
      )}

      {near.length > 0 && (
        <section className="mt-10" aria-labelledby="nearest">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="nearest" className="text-2xl">Ride listings near {c.name}</h2>
            <Link href={searchHere()} className="btn-ghost">Browse all {fmt(s.total)}</Link>
          </div>
          <p className="mt-2 text-sm text-muted">{DISTANCE_NOTE}</p>
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {near.slice(0, 12).map((r) => <li key={r.id}><RideResult card={toCard(r)} /></li>)}
          </ul>
        </section>
      )}

      {types.length > 0 && (
        <LinkGrid
          title={`Browse by ride type near ${c.name}`}
          links={types.slice(0, 24).map((t) => {
            const copy = rideTypeCopy(t.type.id, t.type.name);
            return { href: paths.rideCity(t.type.id, c.stateSlug, c.slug), label: `${copy.label} rentals (${fmt(t.count)})` };
          })}
        />
      )}

      <div className="mt-12">
        <RequestCta href={paths.request()} title={`Planning an event in ${c.name}?`} body={CTA_BODY} />
      </div>

      {s.total > 0 && <FaqSection faq={faq} />}

      <LinkGrid title="Nearby cities" links={nearCities.map((x) => ({ href: paths.city(x.stateSlug, x.slug), label: `${x.name}, ${x.state.toUpperCase()}` }))} />
      <LinkGrid title="More" links={[{ href: paths.state(c.stateSlug), label: `Carnival rides in ${c.stateName}` }, { href: paths.search(), label: "Search all rides" }]} />
    </div>
  );
}

// ------------------------------------------------------------------------------ ride type + city

export function rideCityCopy(c: PlaceCity, t: RideType) {
  const copy = rideTypeCopy(t.id, t.name);
  const n = ridesNear(c.lat, c.lng).filter((r) => r.rideType === t.id).length;
  return {
    title: `${titleCase(copy.label)} Rentals Near ${c.name}, ${c.stateAbbr}`,
    description: `${copy.label} rentals for your ${c.name} event. Browse ${countNoun(n, copy)} from operators based within ${R} miles and request a quote for your date and location.`,
  };
}

export function InventoryRideCityPage({ c, t }: { c: PlaceCity; t: RideType }) {
  const copy = rideTypeCopy(t.id, t.name);
  const matches = ridesNear(c.lat, c.lng).filter((r) => r.rideType === t.id);
  const path = paths.rideCity(t.id, c.stateSlug, c.slug);
  const crumbs = [{ name: "Home", path: paths.home() }, { name: c.stateName, path: paths.state(c.stateSlug) }, { name: c.name, path: paths.city(c.stateSlug, c.slug) }, { name: `${copy.label} rentals`, path }];
  const { title, description } = rideCityCopy(c, t);
  const otherTypes = cityStats(c).byType.filter((x) => x.type.id !== t.id && x.count >= PSEO_INVENTORY.rideCityMinRides).slice(0, 16);
  const sameRideElsewhere = nearbyCities(c, 30)
    .filter((x) => ridesNear(x.lat, x.lng).filter((r) => r.rideType === t.id).length >= PSEO_INVENTORY.rideCityMinRides)
    .slice(0, 12);
  const lowerLabel = copy.label.charAt(0).toLowerCase() + copy.label.slice(1);
  const intro = `${copy.hook} Explore ${/^[A-Z]/.test(copy.label) && !/^(Ferris|Scrambler|Zipper)/.test(copy.label) ? lowerLabel : copy.label} listings and request a quote for your event date and location.`;
  const faq: Faq[] = [
    { q: `How many ${copy.many} can I browse near ${c.name}?`, a: `${countNoun(matches.length, copy)} from operators based within ${R} miles of ${c.name}, ${c.stateAbbr}. Availability on your date and delivery are confirmed when you request a quote.` },
    PRICE_FAQ,
    REQUEST_FAQ,
  ];
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd nodes={[...pageGraph({ path, name: title, description, type: "CollectionPage", crumbs, service: { name: `${copy.label} rental`, serviceType: `${copy.label} rental`, areaServed: { type: "City", name: `${c.name}, ${c.stateAbbr}` } }, faq }), rideItemList(path, `${copy.label} listings near ${c.name}`, matches.slice(0, 24).map((r) => r.title))]} />
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-6 text-4xl">{copy.label} rentals for your {c.name} event.</h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-soft">{intro}</p>
      <p className="mt-3 text-sm text-muted" data-testid="inventory-line">
        Browse {countNoun(matches.length, copy)} from operators based within {R} miles of {c.name}.
      </p>
      <p className="mt-1 text-sm text-muted">{DISTANCE_NOTE}</p>
      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {matches.slice(0, 24).map((r) => <li key={r.id}><RideResult card={toCard(r)} /></li>)}
      </ul>

      <div className="mt-12">
        <RequestCta href={paths.request()} title={`Planning an event in ${c.name}?`} body={CTA_BODY} />
      </div>

      <FaqSection faq={faq} />

      <LinkGrid title={`More ride types near ${c.name}`} links={otherTypes.map((x) => ({ href: paths.rideCity(x.type.id, c.stateSlug, c.slug), label: `${rideTypeCopy(x.type.id, x.type.name).label} rentals (${fmt(x.count)})` }))} />
      <LinkGrid title={`${copy.label} rentals in nearby cities`} links={sameRideElsewhere.map((x) => ({ href: paths.rideCity(t.id, x.stateSlug, x.slug), label: `${x.name}, ${x.state.toUpperCase()}` }))} />
      <LinkGrid title="More" links={[{ href: paths.city(c.stateSlug, c.slug), label: `All carnival rides near ${c.name}` }, { href: paths.state(c.stateSlug), label: `Carnival rides in ${c.stateName}` }]} />
    </div>
  );
}
