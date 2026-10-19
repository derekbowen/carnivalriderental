import type { Metadata } from "next";
import { ImageOffIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { accessPriceCopy } from "@/lib/access/copy";
import { accessProductsForDisplay } from "@/lib/access/runtime";
import { getOperatorListing, type OperatorRideDetail } from "@/lib/catalog/operator-search";
import { rideExcerpt, rideOverview } from "@/lib/catalog/ride-description";
import { Breadcrumbs, JsonLd, LinkGrid } from "@/components/pseo";
import { RideResult } from "@/components/search/RideResult";
import { linkedNearbyCities, linkedRideCities, liveListingIdFor, operatorCount, PSEO_INVENTORY, RIDES, rideHome, ridesNear, similarRides, toCard } from "@/lib/inventory";
import { rideTypeCopy } from "@/lib/inventory/ride-type-copy";
import { pageGraph } from "@/lib/seo/structured-data";
import { BRAND } from "@/lib/config";
import { REQUEST_A_QUOTE } from "@/lib/pricing/public-price";
import { paths } from "@/lib/seo/routes";

export const revalidate = 60;

type P = { id: string };

/** A pre-cutover (Test) listing id moves permanently to the same listing in Live; unknown ids 404 as before. */
function redirectIfMoved(id: string) {
  const live = RIDES.some((r) => r.id === id) ? null : liveListingIdFor(id);
  if (live) permanentRedirect(paths.rideListing(live));
}

/** Live listing, or the public inventory snapshot when the marketplace API is unreachable. */
async function loadRide(id: string): Promise<OperatorRideDetail | null> {
  const live = await getOperatorListing(id);
  if (live) return live;
  const r = RIDES.find((x) => x.id === id);
  return r ? { ...toCard(r), facts: r.facts } : null;
}

export async function generateMetadata({ params }: { params: Promise<P> }): Promise<Metadata> {
  const { id } = await params;
  redirectIfMoved(id);
  const ride = await loadRide(id);
  return {
    title: ride ? `${ride.title} | ${BRAND.name}` : BRAND.name,
    description: ride ? rideExcerpt(ride, 155) : undefined,
    robots: { index: false, follow: true },
  };
}

/**
 * Our ride detail page. Shows only approved public facts and screened description text;
 * operator identities, contact details, and identifying locations stay private.
 */
/**
 * Where the ride sits in the site: breadcrumbs (Home › State › nearest city › ride-type page) and
 * links back to the pSEO pages that list it, so every card link has a link in return.
 */
function placement(id: string) {
  const snap = RIDES.find((x) => x.id === id);
  if (!snap) return null;
  const home = rideHome(snap);
  if (!home) return null;
  const copy = snap.rideType ? rideTypeCopy(snap.rideType, snap.rideType) : null;
  const crumbs = [{ name: "Home", path: paths.home() }, { name: home.state.name, path: paths.state(home.state.slug) }];
  if (home.city) crumbs.push({ name: home.city.name, path: paths.city(home.city.stateSlug, home.city.slug) });
  if (home.rideCityPath && copy) crumbs.push({ name: `${copy.label} rentals`, path: home.rideCityPath });
  const links: { href: string; label: string }[] = [];
  if (home.city && copy && snap.rideType) {
    if (home.rideCityPath) links.push({ href: home.rideCityPath, label: `${copy.label} rentals near ${home.city.name}` });
    for (const x of linkedRideCities(home.city, snap.rideType).slice(0, 4)) links.push({ href: paths.rideCity(snap.rideType, x.stateSlug, x.slug), label: `${copy.label} rentals near ${x.name}, ${x.state.toUpperCase()}` });
  }
  if (home.city) {
    links.push({ href: paths.city(home.city.stateSlug, home.city.slug), label: `Carnival rides near ${home.city.name}` });
    for (const x of linkedNearbyCities(home.city).filter((x) => ridesNear(x.lat, x.lng).length >= PSEO_INVENTORY.cityMinRides).slice(0, 3)) links.push({ href: paths.city(x.stateSlug, x.slug), label: `Carnival rides near ${x.name}, ${x.state.toUpperCase()}` });
  }
  links.push({ href: paths.directoryState(home.state.slug), label: `All ride listings from operators based in ${home.state.name}` });
  return { crumbs, links };
}

export default async function RideListingPage({ params }: { params: Promise<P> }) {
  const id = (await params).id;
  redirectIfMoved(id);
  const ride = await loadRide(id);
  if (!ride) notFound();
  const place = placement(id);
  const snap = RIDES.find((x) => x.id === id) ?? null;
  const typeLabel = snap?.rideType ? rideTypeCopy(snap.rideType, snap.rideType) : null;
  const similar = snap ? similarRides(snap) : [];
  const otherOperators = operatorCount(similar);
  const pricing = accessPriceCopy(await accessProductsForDisplay(), snap?.rideType ?? null);
  const crumbs = [...(place?.crumbs ?? [{ name: "Home", path: paths.home() }, { name: "Find a ride", path: paths.search() }]), { name: ride.title, path: paths.rideListing(id) }];
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd nodes={pageGraph({ path: paths.rideListing(id), name: ride.title, description: rideExcerpt(ride, 160), type: "WebPage", crumbs })} />
      <Breadcrumbs items={crumbs} />
    <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_340px]">
      <div>
        <div className="mt-4 aspect-[4/3] w-full overflow-hidden rounded-2xl bg-placeholder">
          {ride.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={(ride.photoLarge ?? ride.photo).src} alt={ride.photo.alt} width={800} height={600} className="h-full w-full object-cover" />
          ) : (
            <div role="img" aria-label="No photo yet" className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-soft">
              <ImageOffIcon className="h-8 w-8 opacity-60" aria-hidden="true" />
              <span className="text-sm">No photo yet</span>
            </div>
          )}
        </div>
        <div className="mt-7 flex flex-wrap items-center gap-2">
          {ride.rideClassLabel && <span className="rounded-full bg-accent-wash px-3 py-1 text-xs font-semibold text-accent-strong">{ride.rideClassLabel}</span>}
          <span className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted">Independent operator listing</span>
        </div>
        <h1 className="mt-3 text-4xl leading-tight sm:text-5xl">{ride.title}</h1>
        {ride.homeState && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-soft"><MapPinIcon className="h-4 w-4" aria-hidden="true" /> Operator based in {ride.homeState}</p>
        )}
        <section className="mt-7 rounded-2xl border border-line bg-surface p-6 sm:p-7" aria-labelledby="ride-description-heading">
          <p className="eyebrow">Ride overview</p>
          <h2 id="ride-description-heading" className="mt-2 text-2xl">About {ride.title}</h2>
          <p className="mt-4 whitespace-pre-line text-base leading-8 text-ink-soft" data-testid="ride-description">{rideOverview(ride)}</p>
          {!ride.description && <p className="mt-3 text-xs text-muted">This listing currently has a limited description. Ask the operator to confirm any requirements specific to the equipment.</p>}
        </section>
        {ride.facts.length > 0 && (
          <section className="mt-7" aria-labelledby="ride-specifications-heading">
            <h2 id="ride-specifications-heading" className="text-2xl">Ride details</h2>
            <dl className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface" data-testid="ride-facts">
              {ride.facts.map((f) => (
                <div key={f.label} className="grid gap-1 px-5 py-4 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] sm:gap-4">
                  <dt className="text-muted">{f.label}</dt>
                  <dd className="font-medium text-ink sm:text-right">{f.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        <p className="mt-4 text-xs text-muted">Specifications are sourced from published ride information. Verify rider requirements, dimensions, travel, availability and site needs directly with the operator.</p>
      </div>
      <aside className="space-y-4 lg:pt-10">
        <div className="card p-5">
          <p className="eyebrow">Get in touch</p>
          <p className="mt-2 text-lg font-semibold">{ride.price ?? REQUEST_A_QUOTE}</p>
          {!ride.price && <p className="mt-1 text-xs text-muted">The operator prices your event once they know your date, location, hours and site.</p>}
          <Link href={paths.connectListing(ride.id)} className="btn-primary mt-4 w-full">Connect with operators</Link>
          <p className="mt-2 text-xs text-muted">Share your event date and location to find matching ride operators.</p>
          <p className="mt-3 text-sm font-semibold" data-testid="access-price">{pricing.ctaLine}</p>
          <p className="mt-2 text-xs text-muted" data-testid="access-terms">{pricing.tier === "ferris" ? "Ferris wheel requests use Ferris Wheel Event Access. " : ""}Event Access gives you direct contact details for {pricing.product ? `up to ${pricing.product.unlockLimit} ` : ""}matching operators, and you see exactly how many match before you pay. You contact them directly, compare quotes and arrange the rental. The fee is for contact access only: no commission or markup on the rental price, and nothing here is a booking.</p>
        </div>
        {otherOperators > 0 && typeLabel && (
          <div className="card p-5" data-testid="similar-operators">
            <p className="font-semibold">More than one option</p>
            <p className="mt-1 text-sm text-ink-soft">Similar {typeLabel.many} are listed by {otherOperators} other operator{otherOperators === 1 ? "" : "s"} serving this region, so you can compare if this one is booked or outside your budget.</p>
          </div>
        )}
        <div className="card p-5 text-sm">
          <p className="font-semibold">Before you call</p>
          <p className="mt-1 text-ink-soft">Have your date, site, attendance and power details ready. <Link href={paths.guide("how-to-rent-carnival-rides")} className="font-semibold text-accent-strong hover:underline">What to ask a carnival operator →</Link></p>
          <p className="mt-2 text-ink-soft">Not sure whether a company owns the ride it quotes? <Link href={paths.guide("ride-owner-vs-rental-broker")} className="font-semibold text-accent-strong hover:underline">Ride owner vs. rental broker →</Link></p>
        </div>
      </aside>
    </div>
      {similar.length > 0 && typeLabel && (
        <section className="mt-12" aria-labelledby="similar-heading">
          <h2 id="similar-heading" className="text-2xl">Similar {typeLabel.many} from other operators</h2>
          <p className="mt-1 text-sm text-muted">Nearest to this ride&rsquo;s home base first. Each card is a different operator&rsquo;s listing.</p>
          <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {similar.slice(0, 4).map((r) => <li key={r.id}><RideResult card={toCard(r)} /></li>)}
          </ul>
        </section>
      )}
      {place && place.links.length > 0 && <LinkGrid title="Find more near this ride" links={place.links} />}
    </div>
  );
}
