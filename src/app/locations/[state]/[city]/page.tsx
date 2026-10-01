import Link from "next/link";
import { notFound } from "next/navigation";
import { RequestCta } from "@/components/RequestCta";
import { DemoBadge, EstimateLabel } from "@/components/badges";
import { getContent, getLocation } from "@/lib/content";
import { seoMetadata } from "@/lib/seo/metadata";
import { cityGate } from "@/lib/seo/publication";
import { paths } from "@/lib/seo/routes";

export const dynamicParams = false;
export const revalidate = 3600;

type P = { state: string; city: string };

export function generateStaticParams(): P[] {
  return getContent().locations.map((l) => ({ state: l.stateSlug, city: l.citySlug }));
}

export async function generateMetadata({ params }: { params: Promise<P> }) {
  const p = await params;
  const l = getLocation(p.state, p.city);
  if (!l) return {};
  return seoMetadata({
    path: paths.city(l.stateSlug, l.citySlug),
    title: `Carnival ride rentals in ${l.cityName}, ${l.stateCode}`,
    description: `Request carnival rides for events in ${l.cityName}, ${l.stateName}. We source rides and operating crews, subject to availability.`,
    gate: cityGate(l),
  });
}

export default async function CityPage({ params }: { params: Promise<P> }) {
  const p = await params;
  const l = getLocation(p.state, p.city);
  if (!l) notFound();
  const { rides, coverage } = getContent();
  const verifiedHere = coverage.filter((c) => c.stateSlug === l.stateSlug && c.citySlug === l.citySlug);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Service area</p>
      <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-4xl">Carnival ride rentals in {l.cityName}, {l.stateCode}</h1>{l.isDemo && <DemoBadge />}</div>
      <p className="mt-4 max-w-3xl text-lg text-ink-soft">
        We arrange carnival ride requests for events in {l.cityName}, {l.stateName}, subject to availability. Tell us about your event and our team will contact operators who may be able to serve your site.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="card p-6">
          <h2 className="text-xl">Request sourcing for {l.cityName}</h2>
          <p className="mt-2 text-sm text-ink-soft">Available for any ride type below. We confirm an operator and unit for your dates before sending a quote.</p>
        </section>
        <section className="card p-6">
          <h2 className="text-xl">Verified equipment in {l.cityName}</h2>
          {verifiedHere.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">None recorded yet. We do not claim local inventory we have not verified.</p>
          ) : (
            <ul className="mt-2 list-disc pl-5 text-sm">{verifiedHere.map((c) => <li key={c.note}>{c.note}</li>)}</ul>
          )}
        </section>
      </div>

      {l.localNotes.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-2xl">Local planning notes</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-ink-soft">{l.localNotes.map((n) => <li key={n.text}>{n.text} <span className="text-xs text-muted">({n.source})</span></li>)}</ul>
        </section>
      ) : (
        <p className="mt-10 rounded-xl bg-canvas text-sm text-muted">We have not yet published local planning notes (permits, venue rules) for {l.cityName}. Ask us in your request.</p>
      )}

      <section className="mt-12">
        <h2 className="text-2xl">Rides you can request in {l.cityName}</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rides.map((r) => (
            <li key={r.slug} className="card flex flex-col gap-3 p-5">
              <Link href={paths.rideCity(r.slug, l.stateSlug, l.citySlug)} className="font-display text-lg hover:underline">{r.name} in {l.cityName}</Link>
              <EstimateLabel estimate={r.estimate} compact />
              <Link href={paths.request(r.slug, l.stateSlug, l.citySlug)} className="mt-auto text-sm font-semibold text-accent-strong hover:underline">Request this ride →</Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-16"><RequestCta href={paths.request(undefined, l.stateSlug, l.citySlug)} title={`Planning an event in ${l.cityName}?`} body="Share your dates and site details. We handle sourcing, the quote and coordination." /></div>
    </div>
  );
}
