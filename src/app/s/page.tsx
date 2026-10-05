import type { Metadata } from "next";
import { ImageOffIcon, MapPinIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { NearMeButton } from "@/components/search/NearMeButton";
import { ipLocation, isRideClass, marketplaceListingUrl, parseNear, RIDE_CLASSES, searchOperatorListings, US_CENTER, type OperatorCard } from "@/lib/catalog/operator-search";
import { BRAND } from "@/lib/config";
import { ESTIMATE_DISCLAIMER } from "@/lib/pricing/rate-card";
import { paths } from "@/lib/seo/routes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Carnival rides near you | ${BRAND.name}`,
  description: "Carnival rides from operators across the US, nearest to you first.",
  robots: { index: false, follow: true },
};

type SP = { class?: string; page?: string; near?: string };

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const exact = parseNear(sp.near);
  const approx = exact ? null : ipLocation(await headers());
  const origin = exact ?? approx ?? US_CENTER;
  const where = exact ? "your location" : (approx ?? US_CENTER).label;
  const rideClass = isRideClass(sp.class) ? sp.class : undefined;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const near = exact ? sp.near : undefined;
  const res = await searchOperatorListings({ origin, page, rideClass });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Find a ride</p>
      <h1 className="mt-2 text-4xl">Carnival rides near {where}</h1>
      <p className="mt-2 text-ink-soft">
        {res.totalItems > 0 ? `${res.totalItems.toLocaleString("en-US")} rides, nearest first.` : "Nearest first."} Distances are to each operator&rsquo;s home base.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Suspense>
          <NearMeButton />
        </Suspense>
        <nav aria-label="Ride type" className="flex flex-wrap gap-2">
          <Chip href={paths.search({ near })} active={!rideClass}>All rides</Chip>
          {RIDE_CLASSES.map((c) => (
            <Chip key={c.id} href={paths.search({ rideClass: c.id, near })} active={rideClass === c.id}>{c.label}</Chip>
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

      <p className="mt-6 text-xs text-muted">{ESTIMATE_DISCLAIMER}</p>

      {res.totalPages > 1 && (
        <nav aria-label="Pages" className="mt-8 flex items-center justify-between gap-3">
          {page > 1 ? <Link className="btn-ghost" href={paths.search({ rideClass, near, page: page - 1 })}>Previous</Link> : <span />}
          <span className="text-sm text-muted">Page {page} of {Math.min(res.totalPages, 100)}</span>
          {page < Math.min(res.totalPages, 100) ? <Link className="btn-ghost" href={paths.search({ rideClass, near, page: page + 1 })}>Next</Link> : <span />}
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

function RideResult({ card }: { card: OperatorCard }) {
  return (
    <article data-testid="ride-result" className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="aspect-[4/3] w-full overflow-hidden bg-placeholder">
        {card.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.photo.src} alt={card.photo.alt} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div role="img" aria-label="No photo yet" className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-soft">
            <ImageOffIcon className="h-6 w-6 opacity-60" aria-hidden="true" />
            <span className="text-xs">No photo yet</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {card.rideClassLabel && <p className="text-xs font-semibold text-muted">{card.rideClassLabel}</p>}
        <h2 className="mt-1 text-xl leading-tight">{card.title}</h2>
        {card.company && <p className="mt-1 text-sm text-ink-soft">{card.company}</p>}
        {(card.base || card.miles !== null) && (
          <p className="mt-1 flex items-center gap-1 text-sm text-ink-soft">
            <MapPinIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {[card.base, card.miles !== null ? `~${card.miles.toLocaleString("en-US")} mi` : null].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="mt-auto pt-4">
          <p className="text-sm font-semibold">{card.estimate ?? "Price on request"}</p>
          {card.bookable ? (
            <a href={marketplaceListingUrl(card)} className="btn-primary mt-3 w-full">Book this ride</a>
          ) : (
            <Link href={paths.requestRide(card.id)} className="btn-primary mt-3 w-full">Request this ride</Link>
          )}
        </div>
      </div>
    </article>
  );
}
