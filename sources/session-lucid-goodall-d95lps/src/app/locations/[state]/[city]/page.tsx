import Link from "next/link";
import { notFound } from "next/navigation";
import { catalog } from "@/lib/catalog";
import { isIndexable } from "@/lib/catalog/publication";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { paths } from "@/lib/urls";
import { FixtureBanner } from "@/components/Badges";
import { HowItWorks, JsonLd, RequestCta } from "@/components/Marketing";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ state: string; city: string }> };

async function load(params: Props["params"]) {
  const { state, city } = await params;
  return catalog.city(state, city);
}

export async function generateMetadata({ params }: Props) {
  const c = await load(params);
  if (!c) return {};
  return pageMetadata({
    title: `Carnival ride rentals in ${c.name}, ${c.state.toUpperCase()}`,
    description: `We arrange carnival ride rental requests for events in ${c.name}, ${c.stateName}, subject to operator availability.`,
    path: paths.city(c.state, c.slug),
    indexable: isIndexable(c),
  });
}

export default async function CityPage({ params }: Props) {
  const c = await load(params);
  if (!c) notFound();
  const where = `${c.name}, ${c.state.toUpperCase()}`;
  const pairs = catalog.cityRidesFor(c.state, c.slug);
  return (
    <main>
      {c.dataset === "fixture" ? <FixtureBanner /> : null}
      <JsonLd data={breadcrumbJsonLd([{ name: `${c.name}, ${c.stateName}`, path: paths.city(c.state, c.slug) }])} />
      <div className="container-page py-12">
        <p className="eyebrow">{c.stateName}</p>
        <h1 className="mt-2 font-display text-4xl">Carnival ride rentals in {where}</h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-muted">
          We arrange carnival ride requests for events in {c.name}, subject to operator availability. Send us your event
          details and we look for an operator who can serve your date, then reply with a written quote.
        </p>
        <div className="card mt-6 max-w-2xl p-5 text-sm">
          <div className="font-semibold">Request sourcing for {c.name}</div>
          <p className="mt-1 text-ink-muted">
            This is a sourcing service, not a listing of equipment located in {c.name}. We don&apos;t show local inventory
            until an operator and ride have been verified.
          </p>
        </div>

        {c.localNotes.length ? (
          <ul className="mt-6 list-disc space-y-1 pl-5 text-sm">
            {c.localNotes.map((n) => <li key={n.text}>{n.text} <span className="text-ink-muted">({n.source})</span></li>)}
          </ul>
        ) : null}

        <h2 className="mt-10 font-display text-2xl">Rides we source for {c.name} events</h2>
        {pairs.length ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {pairs.map((p) => {
              const ride = catalog.ride(p.ride)!;
              return (
                <li key={p.ride}>
                  <Link href={paths.cityRide(c.state, c.slug, ride.slug)} className="card block p-5 hover:shadow-md">
                    <div className="font-display text-xl">{ride.name} in {c.name}</div>
                    <p className="mt-1 text-sm text-ink-muted">{ride.summary}</p>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-ink-muted">
            No ride pages for {c.name} yet. <Link className="underline" href={paths.rides()}>Browse all rides</Link> — we
            can source any of them for an event here.
          </p>
        )}
      </div>
      <HowItWorks />
      <RequestCta where={where} />
    </main>
  );
}
