import type { Metadata } from "next";
import { ImageOffIcon, MapPinIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { NearMeButton } from "@/components/search/NearMeButton";
import { RideResult } from "@/components/search/RideResult";
import { ipLocation, isRideClass, parseNear, RIDE_CLASSES, searchOperatorListings, US_CENTER, type OperatorCard } from "@/lib/catalog/operator-search";
import { STATE_CENTERS } from "@/lib/taxonomy/state-centers";
import { US_STATES } from "@/lib/taxonomy";
import { BRAND } from "@/lib/config";
import { Breadcrumbs } from "@/components/pseo";
import { paths } from "@/lib/seo/routes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Carnival rides near you | ${BRAND.name}`,
  description: "Carnival rides from operators across the US, nearest to you first.",
  robots: { index: false, follow: true },
};

type SP = { class?: string; page?: string; near?: string; state?: string };

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  // Search origin, in order: the visitor's exact location (opt-in), a state they picked, their
  // approximate IP location, the centre of the US. Results are sorted by Sharetribe from this point
  // across the whole inventory (not just the current page).
  const exact = parseNear(sp.near);
  const picked = !exact && sp.state ? US_STATES.find((s) => s.slug === sp.state) : undefined;
  const pickedCenter = picked ? STATE_CENTERS[picked.code] : undefined;
  const approx = exact || pickedCenter ? null : ipLocation(await headers());
  const origin = exact ?? (pickedCenter ? { lat: pickedCenter[0], lng: pickedCenter[1] } : null) ?? approx ?? US_CENTER;
  const where = exact ? "your location" : picked && pickedCenter ? picked.name : (approx ?? US_CENTER).label;
  const stateSlug = picked && pickedCenter ? picked.slug : undefined;
  const rideClass = isRideClass(sp.class) ? sp.class : undefined;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const near = exact ? sp.near : undefined;
  const loc = { near, state: stateSlug };
  const res = await searchOperatorListings({ origin, page, rideClass });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Breadcrumbs items={[{ name: "Home", path: paths.home() }, { name: "Find a ride", path: paths.search() }]} />
      <p className="eyebrow mt-6">Find a ride</p>
      <h1 className="mt-2 text-4xl">{approx || exact || picked ? `Carnival rides near ${where}` : "Carnival rides across the United States"}</h1>
      <p className="mt-2 text-ink-soft">
        {res.totalItems > 0 ? `${res.totalItems.toLocaleString("en-US")} rides, nearest first.` : "Nearest first."} Distances are approximate, measured to each operator&rsquo;s home base, not to where a ride is today.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Suspense>
          <NearMeButton />
        </Suspense>
        <form action="/s" method="get" className="flex items-center gap-2">
          {rideClass && <input type="hidden" name="class" value={rideClass} />}
          <label htmlFor="state" className="sr-only">Search near a state</label>
          <select id="state" name="state" defaultValue={stateSlug ?? ""} className="input min-h-11 w-auto py-2">
            <option value="">Pick a state…</option>
            {US_STATES.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </select>
          <button type="submit" className="btn-ghost min-h-11">Search</button>
        </form>
        <nav aria-label="Ride type" className="flex flex-wrap gap-2">
          <Chip href={paths.search(loc)} active={!rideClass}>All rides</Chip>
          {RIDE_CLASSES.map((c) => (
            <Chip key={c.id} href={paths.search({ ...loc, rideClass: c.id })} active={rideClass === c.id}>{c.label}</Chip>
          ))}
        </nav>
      </div>

      {res.error ? (
        <p role="alert" className="card mt-8 p-6 text-ink-soft">Ride search is unavailable right now. Please try again in a minute.</p>
      ) : res.cards.length === 0 ? (
        <p className="card mt-8 p-6 text-ink-soft">No rides found for this filter yet.</p>
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {res.cards.map((c) => (
            <li key={c.id}><RideResult card={c} /></li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-muted">Distance is measured from operator home bases. Event availability and delivery must be confirmed.</p>

      {res.totalPages > 1 && (
        <nav aria-label="Pages" className="mt-8 flex items-center justify-between gap-3">
          {page > 1 ? <Link className="btn-ghost" href={paths.search({ ...loc, rideClass, page: page - 1 })}>Previous</Link> : <span />}
          <span className="text-sm text-muted">Page {page} of {Math.min(res.totalPages, 100)}</span>
          {page < Math.min(res.totalPages, 100) ? <Link className="btn-ghost" href={paths.search({ ...loc, rideClass, page: page + 1 })}>Next</Link> : <span />}
        </nav>
      )}
    </div>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium ${active ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-ink hover:border-ink"}`}>
      {children}
    </Link>
  );
}
