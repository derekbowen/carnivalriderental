import { ArrowRightIcon, CircleDashedIcon, InfoIcon } from "lucide-react";
import Link from "next/link";
import type { RideCategory, RideOffering, ServiceLocation, VerifiedCoverage } from "@/lib/content/types";
import { categoryPageById } from "@/lib/content/category-pages";
import { paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";
import { Breadcrumbs, JsonLd } from "./pseo";
import { AvailabilityBadge, DemoBadge, EstimateLabel } from "./badges";
import { PRICE_COPY, PRICING_POLICY } from "@/lib/pricing/policy";
import { PricingNotice } from "./PricingNotice";
import { CTA_BODY, RequestCta } from "./RequestCta";
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
  const requestHref = paths.connect({ state: location?.stateSlug, city: location?.citySlug, category: ride.categorySlug });
  const verified = coverage.length > 0;
  const ridePath = links.ride(ride.slug);
  const currentPath = location ? links.rideCity(ride.slug, location.stateSlug, location.citySlug) : ridePath;
  // Visible breadcrumbs and BreadcrumbList are the same list. Category hubs exist only for configured categories.
  const hub = category && categoryPageById(category.slug);
  const crumbs = [
    { name: "Home", path: paths.home() },
    { name: "Rides", path: paths.rides() },
    ...(hub ? [{ name: hub.name, path: paths.category(hub.id) }] : []),
    { name: ride.name, path: ridePath },
    ...(location ? [{ name: `${location.cityName}, ${location.stateCode}`, path: currentPath }] : []),
  ];
  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 lg:px-10 lg:pb-10">
      <JsonLd
        nodes={pageGraph({
          path: currentPath,
          name: `${ride.name}${where}`,
          description: ride.summary,
          type: "ItemPage",
          crumbs,
          service: { name: `${ride.name}${where}: operator discovery`, serviceType: `${ride.name} operator discovery and contact access`, areaServed: location ? { type: "City", name: `${location.cityName}, ${location.stateName}` } : undefined },
        })}
      />
      <Breadcrumbs items={crumbs} />

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
              <h2 id="local-heading" className="text-3xl">{ride.name} rentals in {location.cityName}</h2>
              {verified ? (
                <ul className="mt-4 space-y-2 text-ink-soft">{coverage.map((c) => <li key={c.note}>{c.note} <span className="text-xs text-muted">(source: {c.verification.source})</span></li>)}</ul>
              ) : (
                <p className="mt-4 max-w-2xl leading-relaxed text-ink-soft">
                  Independent operators serving {location.cityName}, {location.stateName} list this kind of ride. We don&rsquo;t yet have verified equipment committed to this area, so confirm travel, fit and availability for your date directly with the operator before you commit.
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

          <PricingNotice compact />

          <section aria-labelledby="specs-heading">
            <h2 id="specs-heading" className="text-3xl">Specifications</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">Specifications depend on the specific unit the operator brings. We only show values we have verified.</p>
            {ride.specs.length === 0 ? (
              <p data-testid="specs-unknown" className="mt-4 text-sm text-muted">No verified specifications on file for this offering. Confirm them with the operator for the specific unit.</p>
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
              <h2 id="locations-heading" className="text-2xl">This ride type in other locations</h2>
              <ul className="mt-4 flex flex-wrap gap-2 text-sm">
                {otherLocations.map((l) => (
                  <li key={l.citySlug}><Link className="inline-block rounded-full border border-line-strong bg-surface px-3 py-1.5 hover:border-ink" href={links.rideCity(ride.slug, l.stateSlug, l.citySlug)}>{l.cityName}, {l.stateCode}</Link></li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="hidden lg:col-span-4 lg:block" aria-label="Connect with operators">
          <div className="sticky top-24 rounded-2xl border border-line bg-surface p-6 shadow-[0_12px_32px_-20px_rgba(20,33,61,0.25)]">
            <AvailabilityBadge verified={verified} />
            <div className="mt-5"><EstimateLabel estimate={ride.estimate} size="lg" /></div>
            <Link href={requestHref} className="btn-primary mt-6 w-full">Connect with operators <ArrowRightIcon className="h-4 w-4" aria-hidden="true" /></Link>
            <div className="mt-5 flex gap-2.5 rounded-lg bg-canvas p-3.5 text-[13px] leading-relaxed text-ink-soft">
              <InfoIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <p>Operators price per event: ride, transport distance, dates, operating hours and site conditions all matter. Ask each one directly.</p>
            </div>
            <ul className="mt-5 space-y-2 border-t border-line pt-5 text-sm text-ink-soft">
              <li className="flex justify-between gap-3"><span>Event Access</span><span className="text-right font-medium text-ink">Direct contact details for matching operators</span></li>
              <li className="flex justify-between gap-3"><span>The rental</span><span className="text-right font-medium text-ink">Agreed and paid directly with the operator</span></li>
            </ul>
          </div>
        </aside>
      </div>

      <div className="mt-16"><RequestCta href={requestHref} title={`Planning an event${where}?`} body={CTA_BODY} /></div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-4 py-3 lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <p className="min-w-0 truncate text-sm font-semibold">Priced by the operator</p>
          <Link href={requestHref} aria-label="Connect with operators (mobile)" className="btn-primary shrink-0 !px-4 !py-2.5 text-sm">Connect</Link>
        </div>
      </div>
    </div>
  );
}
