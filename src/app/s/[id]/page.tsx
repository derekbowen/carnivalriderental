import type { Metadata } from "next";
import { ImageOffIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getOperatorListing, type OperatorRideDetail } from "@/lib/catalog/operator-search";
import { Breadcrumbs, JsonLd, LinkGrid } from "@/components/pseo";
import { linkedNearbyCities, linkedRideCities, PSEO_INVENTORY, RIDES, rideHome, ridesNear, toCard } from "@/lib/inventory";
import { rideTypeCopy } from "@/lib/inventory/ride-type-copy";
import { pageGraph } from "@/lib/seo/structured-data";
import { BRAND } from "@/lib/config";
import { REQUEST_A_QUOTE } from "@/lib/pricing/public-price";
import { paths } from "@/lib/seo/routes";

export const revalidate = 60;

type P = { id: string };

/** Live listing, or the public inventory snapshot when the marketplace API is unreachable. */
async function loadRide(id: string): Promise<OperatorRideDetail | null> {
  const live = await getOperatorListing(id);
  if (live) return live;
  const r = RIDES.find((x) => x.id === id);
  return r ? { ...toCard(r), facts: r.facts } : null;
}

export async function generateMetadata({ params }: { params: Promise<P> }): Promise<Metadata> {
  const ride = await loadRide((await params).id);
  return { title: ride ? `${ride.title} | ${BRAND.name}` : BRAND.name, robots: { index: false, follow: true } };
}

/**
 * Our ride detail page. Shows only approved public facts: never the operator's company name,
 * city or description text (founder decision 2026-10-05: no bypassing the marketplace).
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
  const ride = await loadRide(id);
  if (!ride) notFound();
  const place = placement(id);
  const crumbs = [...(place?.crumbs ?? [{ name: "Home", path: paths.home() }, { name: "Find a ride", path: paths.search() }]), { name: ride.title, path: paths.rideListing(id) }];
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd nodes={pageGraph({ path: paths.rideListing(id), name: ride.title, description: `${ride.title}: connect with the operator that owns it.`, type: "WebPage", crumbs })} />
      <Breadcrumbs items={crumbs} />
    <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_340px]">
      <div>
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
          <p className="text-lg font-semibold">{ride.price ?? REQUEST_A_QUOTE}</p>
          {!ride.price && <p className="mt-1 text-xs text-muted">The operator prices your event once they know your date, location, hours and site.</p>}
          <Link href={paths.connectListing(ride.id)} className="btn-primary mt-4 w-full">Connect with operators</Link>
          <p className="mt-2 text-xs text-muted">Event Access shows how many matching operators can be contacted before you pay, then reveals their direct contact details. The rental is agreed with the operator; nothing here is a booking.</p>
        </div>
      </aside>
    </div>
      {place && place.links.length > 0 && <LinkGrid title="Find more near this ride" links={place.links} />}
    </div>
  );
}
