import Link from "next/link";
import { Breadcrumbs, FaqSection, JsonLd, LinkGrid } from "@/components/pseo";
import { RequestCta } from "@/components/RequestCta";
import { RideResult } from "@/components/search/RideResult";
import { cityStats, nearbyCities, PSEO_INVENTORY, ridesNear, toCard, type City, type RideType } from "@/lib/inventory";
import { ESTIMATE_DISCLAIMER } from "@/lib/pricing/rate-card";
import { canonicalUrl, paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";

/**
 * Structured data limited to what the page visibly shows: CollectionPage, BreadcrumbList, the
 * site's rental Service (Carnival Ride Rental's, as on every page) for this city, FAQPage for the
 * visible FAQ, and an ItemList naming the visible ride cards. No Offer, price, availability,
 * rating, review, address or Event: none of those are facts these pages hold.
 */
function rideItemList(path: string, name: string, titles: string[]) {
  return {
    "@type": "ItemList",
    "@id": `${canonicalUrl(path)}#rides`,
    name,
    numberOfItems: titles.length,
    itemListElement: titles.map((t, i) => ({ "@type": "ListItem", position: i + 1, name: t })),
  };
}
import type { Faq } from "@/lib/taxonomy";

/**
 * Inventory-backed pSEO templates (city, ride type + city). Every number on these pages is computed
 * from the live ride snapshot; nothing identifies an operator (no company, city or description).
 */
type PlaceCity = City & { stateName: string; stateAbbr: string; stateSlug: string };

const R = PSEO_INVENTORY.radiusMiles;
const fmt = (n: number) => n.toLocaleString("en-US");
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export function cityCopy(c: PlaceCity) {
  const s = cityStats(c);
  return {
    title: `Carnival ride rentals near ${c.name}, ${c.stateAbbr}`,
    description: `${fmt(s.total)} carnival rides from operators within ${R} miles of ${c.name}, ${c.stateAbbr}${s.nearestMiles !== null ? `; the nearest operator is about ${s.nearestMiles} miles away` : ""}. Compare ride types and request one for your event.`,
  };
}

function cityFaq(c: PlaceCity, total: number, nearest: number | null): Faq[] {
  return [
    { q: `How many carnival rides are available near ${c.name}?`, a: `We list ${fmt(total)} rides from operators based within ${R} miles of ${c.name}, ${c.stateAbbr}.${nearest !== null ? ` The closest operator base is about ${nearest} miles away.` : ""} Operators travel to events, so rides from further away may also serve ${c.name}.` },
    { q: "How much does it cost to rent a carnival ride?", a: "Ride listings show an estimate from our rate card where we have a confirmed rate for that ride size, per day for a 4-hour rental. It is not the final price: generator, transportation, special permits and fuel can add to it, and the operator confirms the total for your event." },
    { q: "Is sending a request the same as booking?", a: "No. Sending a request takes no payment. A ride is booked only when the operator accepts and payment is completed through the marketplace." },
    { q: "Who brings and runs the ride?", a: "The ride's operator delivers it, sets it up and runs it. Operators who have not joined Carnival Ride Rental yet are contacted by our request desk on your behalf." },
  ];
}

export function InventoryCityPage({ c }: { c: PlaceCity }) {
  const s = cityStats(c);
  const near = ridesNear(c.lat, c.lng);
  const path = paths.city(c.stateSlug, c.slug);
  const crumbs = [{ name: "Home", path: paths.home() }, { name: c.stateName, path: paths.state(c.stateSlug) }, { name: c.name, path }];
  const { title, description } = cityCopy(c);
  const faq = cityFaq(c, s.total, s.nearestMiles);
  const near100 = near.filter((r) => r.miles <= 100).length;
  const types = s.byType.filter((t) => t.count >= PSEO_INVENTORY.rideCityMinRides);
  const nearCities = nearbyCities(c, 12);
  const searchHere = (rideClass?: string) => paths.search({ near: `${c.lat.toFixed(2)},${c.lng.toFixed(2)}`, rideClass });
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd nodes={[...pageGraph({ path, name: title, description, type: "CollectionPage", crumbs, service: { areaServed: { type: "City", name: `${c.name}, ${c.stateAbbr}` } }, faq: s.total > 0 ? faq : undefined }), ...(near.length ? [rideItemList(path, `Nearest rides to ${c.name}`, near.slice(0, 12).map((r) => r.title))] : [])]} />
      <Breadcrumbs items={crumbs} />
      <p className="eyebrow mt-6">{c.name}, {c.stateName}</p>
      <h1 className="mt-2 text-4xl">{title}</h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-soft">
        {s.total > 0 ? (
          <>
            {fmt(s.total)} rides from operators based within {R} miles of {c.name}
            {near100 > 0 ? `, ${fmt(near100)} of them within 100 miles` : ""}.{" "}
            {s.nearestMiles !== null && `The nearest operator base is about ${s.nearestMiles} miles away. `}
            Operators are based in {s.operatorStates.length === 1 ? s.operatorStates[0] : `${s.operatorStates.slice(0, -1).join(", ")} and ${s.operatorStates.at(-1)}`}.
          </>
        ) : (
          <>We don&rsquo;t list operators within {R} miles of {c.name} yet. Send a request and our request desk will look further afield.</>
        )}
      </p>

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
            <h2 id="nearest" className="text-2xl">Nearest rides to {c.name}</h2>
            <Link href={searchHere()} className="btn-ghost">See all {fmt(s.total)} rides</Link>
          </div>
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {near.slice(0, 12).map((r) => <li key={r.id}><RideResult card={toCard(r)} /></li>)}
          </ul>
          <p className="mt-4 text-xs text-muted">Distances are straight-line to each operator&rsquo;s home base, not where a ride is today. {ESTIMATE_DISCLAIMER}</p>
        </section>
      )}

      {types.length > 0 && (
        <LinkGrid
          title={`Popular ride types near ${c.name}`}
          links={types.slice(0, 24).map((t) => ({ href: paths.rideCity(t.type.id, c.stateSlug, c.slug), label: `${t.type.name} (${fmt(t.count)})` }))}
        />
      )}

      <div className="mt-12">
        <RequestCta href={paths.request()} title={`Planning an event in ${c.name}?`} body="Share your date and site details. Operators reply in your inbox; for operators who have not joined yet, our request desk contacts them for you." />
      </div>

      {s.total > 0 && <FaqSection faq={faq} />}

      <LinkGrid title={`Carnival rides near other cities`} links={nearCities.map((x) => ({ href: paths.city(x.stateSlug, x.slug), label: `${x.name}, ${x.state.toUpperCase()}` }))} />
      <LinkGrid title="More" links={[{ href: paths.state(c.stateSlug), label: `Carnival rides in ${c.stateName}` }, { href: paths.search(), label: "Search all rides" }]} />
    </div>
  );
}

export function rideCityCopy(c: PlaceCity, t: RideType) {
  const n = ridesNear(c.lat, c.lng).filter((r) => r.rideType === t.id).length;
  return {
    title: `${t.name} rental near ${c.name}, ${c.stateAbbr}`,
    description: `${fmt(n)} ${lower(t.name)} rides from operators within ${R} miles of ${c.name}, ${c.stateAbbr}. See the nearest, estimated prices where available, and request one for your event.`,
  };
}

export function InventoryRideCityPage({ c, t }: { c: PlaceCity; t: RideType }) {
  const all = ridesNear(c.lat, c.lng);
  const matches = all.filter((r) => r.rideType === t.id);
  const path = paths.rideCity(t.id, c.stateSlug, c.slug);
  const crumbs = [{ name: "Home", path: paths.home() }, { name: c.stateName, path: paths.state(c.stateSlug) }, { name: c.name, path: paths.city(c.stateSlug, c.slug) }, { name: t.name, path }];
  const { title, description } = rideCityCopy(c, t);
  const estimates = [...new Set(matches.map((r) => toCard(r).estimate).filter((e): e is string => !!e))];
  const otherTypes = cityStats(c).byType.filter((x) => x.type.id !== t.id && x.count >= PSEO_INVENTORY.rideCityMinRides).slice(0, 16);
  const sameRideElsewhere = nearbyCities(c, 30)
    .filter((x) => ridesNear(x.lat, x.lng).filter((r) => r.rideType === t.id).length >= PSEO_INVENTORY.rideCityMinRides)
    .slice(0, 12);
  const faq: Faq[] = [
    { q: `How many ${lower(t.name)} rides are near ${c.name}?`, a: `We list ${fmt(matches.length)} from operators based within ${R} miles of ${c.name}, ${c.stateAbbr}${matches[0] ? `; the nearest is about ${matches[0].miles} miles away` : ""}.` },
    { q: `How much does ${lower(t.name)} rental cost?`, a: estimates.length ? `Listings near ${c.name} show ${estimates.map((e) => lower(e)).join(" or ")}. That is our rate-card estimate, not the final price: generator, transportation, special permits and fuel can add to it, and the operator confirms the total.` : `We don't have a confirmed rate for this ride size yet, so these listings say "Request a quote". Send your event details and the operator prices your event.` },
    { q: "Is sending a request the same as booking?", a: "No. Sending a request takes no payment. A ride is booked only when the operator accepts and payment is completed through the marketplace." },
  ];
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd nodes={[...pageGraph({ path, name: title, description, type: "CollectionPage", crumbs, service: { name: `${t.name} rental`, serviceType: `${t.name} rental`, areaServed: { type: "City", name: `${c.name}, ${c.stateAbbr}` } }, faq }), rideItemList(path, `${t.name} rides near ${c.name}`, matches.slice(0, 24).map((r) => r.title))]} />
      <Breadcrumbs items={crumbs} />
      <p className="eyebrow mt-6">{c.name}, {c.stateName}</p>
      <h1 className="mt-2 text-4xl">{title}</h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-soft">
        {fmt(matches.length)} {lower(t.name)} rides from operators based within {R} miles of {c.name}
        {matches[0] ? `, the nearest about ${matches[0].miles} miles away` : ""}. Each is run by the operator who owns it; send a request with your date and site details.
      </p>
      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {matches.slice(0, 24).map((r) => <li key={r.id}><RideResult card={toCard(r)} /></li>)}
      </ul>
      <p className="mt-4 text-xs text-muted">Distances are straight-line to each operator&rsquo;s home base. {ESTIMATE_DISCLAIMER}</p>

      <div className="mt-12">
        <RequestCta href={paths.request()} title={`Want a ${lower(t.name)} in ${c.name}?`} body="Share your date and site details. Operators reply in your inbox; for operators who have not joined yet, our request desk contacts them for you." />
      </div>

      <FaqSection faq={faq} />

      <LinkGrid title={`Other rides near ${c.name}`} links={otherTypes.map((x) => ({ href: paths.rideCity(x.type.id, c.stateSlug, c.slug), label: `${x.type.name} (${fmt(x.count)})` }))} />
      <LinkGrid title={`${t.name} rental in nearby cities`} links={sameRideElsewhere.map((x) => ({ href: paths.rideCity(t.id, x.stateSlug, x.slug), label: `${x.name}, ${x.state.toUpperCase()}` }))} />
      <LinkGrid title="More" links={[{ href: paths.city(c.stateSlug, c.slug), label: `All carnival rides near ${c.name}` }, { href: paths.state(c.stateSlug), label: `Carnival rides in ${c.stateName}` }]} />
    </div>
  );
}
