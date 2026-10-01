import Link from "next/link";
import type { RideCategory, RideOffering, ServiceLocation, VerifiedCoverage } from "@/lib/content/types";
import { paths } from "@/lib/seo/routes";
import { AvailabilityBadge, DemoBadge, EstimateLabel } from "./badges";
import { RequestCta } from "./RequestCta";
import { RideImage } from "./RideImage";

/** Shared body for /rides/{ride} and /rides/{ride}/{state}/{city}. */
export function RideDetail({
  ride,
  category,
  location,
  coverage = [],
  otherLocations,
}: {
  ride: RideOffering;
  category: RideCategory | undefined;
  location?: ServiceLocation;
  coverage?: VerifiedCoverage[];
  otherLocations: ServiceLocation[];
}) {
  const where = location ? ` in ${location.cityName}, ${location.stateCode}` : "";
  const requestHref = paths.request(ride.slug, location?.stateSlug, location?.citySlug);
  const verified = coverage.length > 0;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href={paths.rides()} className="hover:underline">Rides</Link>
        {category && <> / <Link href={paths.category(category.slug)} className="hover:underline">{category.name}</Link></>}
        {location && <> / <Link href={paths.ride(ride.slug)} className="hover:underline">{ride.name}</Link></>}
      </nav>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <AvailabilityBadge verified={verified} />
        {ride.isDemo && <DemoBadge />}
      </div>
      <h1 className="mt-3 text-4xl sm:text-5xl">{ride.name}{where}</h1>
      <p className="mt-3 max-w-3xl text-lg text-ink-soft">{ride.summary}</p>

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-12">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
            <RideImage image={ride.images[0]} className="aspect-[4/3] rounded-2xl" priority />
            {ride.images[1] && <RideImage image={ride.images[1]} className="hidden aspect-[3/4] rounded-2xl sm:block" />}
          </div>

          <section>
            <h2 className="text-2xl">About this rental</h2>
            <div className="mt-4 space-y-4 text-ink-soft">{ride.description.map((p) => <p key={p}>{p}</p>)}</div>
          </section>

          {location && (
            <section>
              <h2 className="text-2xl">Requesting {ride.name.toLowerCase()} for an event in {location.cityName}</h2>
              {verified ? (
                <ul className="mt-4 space-y-2 text-ink-soft">{coverage.map((c) => <li key={c.note}>{c.note} <span className="text-xs text-muted">(source: {c.verification.source})</span></li>)}</ul>
              ) : (
                <p className="mt-4 text-ink-soft">
                  We arrange requests for events in {location.cityName}, {location.stateName}, subject to availability. We do not currently have verified equipment
                  committed to this area — when you submit a request, our team contacts operators who may be able to travel to your site and confirms fit before quoting.
                </p>
              )}
              {location.localNotes.length > 0 && (
                <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink-soft">
                  {location.localNotes.map((n) => <li key={n.text}>{n.text} <span className="text-muted">({n.source})</span></li>)}
                </ul>
              )}
            </section>
          )}

          <section>
            <h2 className="text-2xl">Specifications</h2>
            <p className="mt-2 text-sm text-muted">Specifications depend on the specific unit sourced for your event. We only show values we have verified.</p>
            <dl className="card mt-4 divide-y divide-line">
              {ride.specs.map((s) => (
                <div key={s.label} className="grid grid-cols-2 gap-4 px-5 py-3 text-sm">
                  <dt className="font-medium">{s.label}</dt>
                  <dd className={s.verification.status === "verified" ? "" : "text-muted italic"}>
                    {s.verification.status === "verified" && s.value ? s.value : "Not yet verified — confirmed per unit"}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h2 className="text-2xl">Often requested for</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {ride.suitability.map((s) => <li key={s} className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm">{s}</li>)}
            </ul>
            <p className="mt-3 text-xs text-muted">General guidance only. Suitability for your site is confirmed with the operator.</p>
          </section>

          {otherLocations.length > 0 && (
            <section>
              <h2 className="text-xl">Request this ride in other locations</h2>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                {otherLocations.map((l) => (
                  <li key={l.citySlug}><Link className="underline-offset-2 hover:underline" href={paths.rideCity(ride.slug, l.stateSlug, l.citySlug)}>{l.cityName}, {l.stateCode}</Link></li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="card space-y-5 p-6 shadow-sm">
            <EstimateLabel estimate={ride.estimate} />
            <div className="rounded-xl bg-canvas p-4 text-sm">
              <div className="font-semibold">Sourcing status</div>
              <p className="mt-1 text-ink-soft">
                {verified ? "Verified equipment exists for this area. Dates still need confirmation." : "Sourcing on request. We confirm a unit and operator for your dates before quoting."}
              </p>
            </div>
            <Link href={requestHref} className="btn-primary w-full">Request this ride</Link>
            <p className="text-xs text-muted">Free to request. Nothing is booked until you accept a written quote and the booking is confirmed.</p>
          </div>
        </aside>
      </div>

      <div className="mt-16">
        <RequestCta href={requestHref} title={`Planning an event${where}?`} body="Share your dates and site details. We handle operator sourcing, the quote and coordination." />
      </div>
    </div>
  );
}
