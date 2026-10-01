import { ArrowLeftIcon, ArrowRightIcon, CircleDashedIcon, InfoIcon } from "lucide-react";
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
  links = { ride: paths.ride, rideCity: paths.rideCity },
  sampleLabel,
}: {
  ride: RideOffering;
  category: RideCategory | undefined;
  location?: ServiceLocation;
  coverage?: VerifiedCoverage[];
  otherLocations: ServiceLocation[];
  links?: { ride: (slug: string) => string; rideCity: (slug: string, state: string, city: string) => string };
  /** Overrides the demo badge text, e.g. "Test sample". */
  sampleLabel?: string;
}) {
  const where = location ? ` in ${location.cityName}, ${location.stateCode}` : "";
  const requestHref = paths.request(ride.slug, location?.stateSlug, location?.citySlug);
  const verified = coverage.length > 0;
  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 lg:px-10 lg:pb-10">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
        <Link href={paths.rides()} className="hover:text-ink">All rides</Link>
        {category && <>/<Link href={paths.category(category.slug)} className="hover:text-ink">{category.name}</Link></>}
        {location && <>/<Link href={links.ride(ride.slug)} className="hover:text-ink">{ride.name}</Link></>}
      </nav>

      <div className="mt-6 grid gap-12 lg:grid-cols-12">
        <div className="space-y-16 lg:col-span-8">
          <div>
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <RideImage image={ride.images[0]} className="aspect-[4/3] rounded-2xl" priority label={ride.name} />
              {ride.images[1] && <RideImage image={ride.images[1]} className="hidden aspect-[3/4] rounded-2xl sm:flex" compact label={ride.name} />}
            </div>
            <div className="mt-8">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-muted">{category?.name}</p>
                <AvailabilityBadge verified={verified} />
                {ride.isDemo && <DemoBadge label={sampleLabel} />}
              </div>
              <h1 className="mt-2 text-5xl">{ride.name}{where}</h1>
              <p className="mt-4 max-w-2xl text-lg text-ink-soft">{ride.summary}</p>
              <div className="mt-6 max-w-2xl space-y-4 text-[17px] leading-relaxed text-ink-soft">{ride.description.map((p) => <p key={p}>{p}</p>)}</div>
            </div>
          </div>

          {location && (
            <section aria-labelledby="local-heading">
              <h2 id="local-heading" className="text-3xl">Requesting {ride.name.toLowerCase()} in {location.cityName}</h2>
              {verified ? (
                <ul className="mt-4 space-y-2 text-ink-soft">{coverage.map((c) => <li key={c.note}>{c.note} <span className="text-xs text-muted">(source: {c.verification.source})</span></li>)}</ul>
              ) : (
                <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">
                  We arrange requests for events in {location.cityName}, {location.stateName}, subject to availability. We do not currently have verified equipment committed to this area — when you submit a request, our team contacts operators who may be able to travel to your site and confirms fit before quoting.
                </p>
              )}
              {location.localNotes.length > 0 && (
                <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-ink-soft">{location.localNotes.map((n) => <li key={n.text}>{n.text} <span className="text-muted">({n.source})</span></li>)}</ul>
              )}
            </section>
          )}

          {ride.suitability.length > 0 && (
          <section aria-labelledby="suitability-heading">
            <h2 id="suitability-heading" className="text-3xl">Event suitability</h2>
            <ul className="mt-6 flex flex-wrap gap-2">
              {ride.suitability.map((s) => <li key={s} className="rounded-full border border-line-strong bg-surface px-3 py-1.5 text-sm">{s}</li>)}
            </ul>
            <p className="mt-3 text-sm text-muted">General guidance only. Fit for your site is confirmed with the operator.</p>
          </section>
          )}

          <section aria-labelledby="specs-heading">
            <h2 id="specs-heading" className="text-3xl">Specifications</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">Specifications depend on the specific unit sourced for your event. We only show values we have verified.</p>
            {ride.specs.length === 0 ? (
              <p data-testid="specs-unknown" className="mt-4 text-sm text-muted">No verified specifications on file for this offering. They are confirmed for the specific unit sourced for your event.</p>
            ) : (
            <div className="mt-6 overflow-hidden rounded-xl border border-line bg-surface">
              <table className="w-full text-left text-[15px]">
                <caption className="sr-only">Ride specifications</caption>
                <tbody className="divide-y divide-line">
                  {ride.specs.map((s) => (
                    <tr key={s.label}>
                      <th scope="row" className="w-2/5 px-5 py-3.5 font-medium text-ink-soft">{s.label}</th>
                      <td className="px-5 py-3.5">
                        {s.verification.status === "verified" && s.value ? (
                          <span>{s.value}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-muted"><CircleDashedIcon className="h-4 w-4" aria-hidden="true" /> Not yet verified</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </section>

          {otherLocations.length > 0 && (
            <section aria-labelledby="locations-heading">
              <h2 id="locations-heading" className="text-2xl">Request this ride in other locations</h2>
              <ul className="mt-4 flex flex-wrap gap-2 text-sm">
                {otherLocations.map((l) => (
                  <li key={l.citySlug}><Link className="inline-block rounded-full border border-line-strong bg-surface px-3 py-1.5 hover:border-ink" href={links.rideCity(ride.slug, l.stateSlug, l.citySlug)}>{l.cityName}, {l.stateCode}</Link></li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="hidden lg:col-span-4 lg:block" aria-label="Request this ride">
          <div className="sticky top-24 rounded-2xl border border-line bg-surface p-6 shadow-[0_12px_32px_-20px_rgba(20,33,61,0.25)]">
            <AvailabilityBadge verified={verified} />
            <div className="mt-5"><EstimateLabel estimate={ride.estimate} size="lg" /></div>
            <Link href={requestHref} className="btn-primary mt-6 w-full">Request this ride <ArrowRightIcon className="h-4 w-4" aria-hidden="true" /></Link>
            <div className="mt-5 flex gap-2.5 rounded-lg bg-canvas p-3.5 text-[13px] leading-relaxed text-ink-soft">
              <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <p>Your quote depends on the unit sourced, transport distance, dates, operating hours and site conditions — it may fall outside any estimate.</p>
            </div>
            <ul className="mt-5 space-y-2 border-t border-line pt-5 text-sm text-ink-soft">
              <li className="flex justify-between gap-3"><span>Cost to request</span><span className="font-medium text-ink">Free</span></li>
              <li className="flex justify-between gap-3"><span>Booked</span><span className="text-right font-medium text-ink">After operator commits and the agreed payment step</span></li>
            </ul>
          </div>
        </aside>
      </div>

      <div className="mt-16"><RequestCta href={requestHref} title={`Planning an event${where}?`} body="Share your dates and site details. We handle operator sourcing, the quote and coordination." /></div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 py-3 lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <p className="min-w-0 truncate text-sm font-semibold">{ride.estimate ? "Planning estimate shown above — not a quote" : "Priced per event"}</p>
          <Link href={requestHref} aria-label="Request (mobile)" className="btn-primary shrink-0 !px-4 !py-2.5 text-sm">Request</Link>
        </div>
      </div>
    </div>
  );
}
