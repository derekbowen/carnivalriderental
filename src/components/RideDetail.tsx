import Link from "next/link";
import type { RideType, ServiceCity } from "@/lib/catalog/types";
import { paths } from "@/lib/urls";
import { Chip } from "./Badges";
import { PriceTag } from "./PriceTag";
import { RideImage } from "./RideImage";

/** Shared body for the ride page and the ride + city page. */
export function RideDetail({ ride, city }: { ride: RideType; city?: ServiceCity }) {
  const where = city ? `${city.name}, ${city.state.toUpperCase()}` : null;
  return (
    <div className="container-page grid gap-10 py-10 lg:grid-cols-[1fr_360px]">
      <div className="min-w-0">
        <RideImage image={ride.image} size="lg" priority className="aspect-[3/2] rounded-2xl" />
        {ride.image.kind === "placeholder" ? (
          <p className="mt-2 text-xs text-ink-muted">Development placeholder image — not a photo of an available ride.</p>
        ) : (
          <p className="mt-2 text-xs text-ink-muted">Photo: {ride.image.credit}</p>
        )}

        <h1 className="mt-8 font-display text-4xl">{where ? `${ride.name} in ${where}` : ride.name}</h1>
        <p className="mt-3 text-lg text-ink-muted">{ride.summary}</p>

        {where ? (
          <div className="card mt-6 border-marquee/40 bg-marquee-soft/40 p-5 text-sm">
            We arrange {ride.name.toLowerCase()} requests for events in {where}, subject to operator availability.
            We don&apos;t claim to own or have a ride under contract in {city!.name}; we source one for your date and
            confirm it in a written quote.
          </div>
        ) : null}

        <div className="mt-6 space-y-4 text-ink">
          {ride.description.map((p) => <p key={p}>{p}</p>)}
        </div>

        <h2 className="mt-10 font-display text-2xl">Good fit for</h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {ride.suitability.map((s) => <li key={s}><Chip>{s}</Chip></li>)}
        </ul>

        <h2 className="mt-10 font-display text-2xl">Specifications</h2>
        <div className="card mt-3 divide-y divide-line">
          {ride.specs.map((s) => (
            <div key={s.label} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span className="font-medium">{s.label}</span>
              {s.verified ? (
                <span className="flex items-center gap-2">{s.value} <Chip tone="green">Verified spec</Chip></span>
              ) : (
                <span className="text-ink-muted">{s.note}</span>
              )}
            </div>
          ))}
        </div>

        {city && city.localNotes.length ? (
          <>
            <h2 className="mt-10 font-display text-2xl">Planning notes for {city.name}</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {city.localNotes.map((n) => <li key={n.text}>{n.text} <span className="text-ink-muted">({n.source})</span></li>)}
            </ul>
          </>
        ) : null}
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="card p-6 shadow-sm">
          <PriceTag
            size="lg"
            price={
              ride.estimate
                ? { kind: "estimate", lowCents: ride.estimate.lowCents, highCents: ride.estimate.highCents, placeholder: ride.estimate.placeholder }
                : { kind: "none" }
            }
          />
          {ride.estimate ? <p className="mt-2 text-xs text-ink-muted">{ride.estimate.basis}</p> : null}
          <Link href={paths.request(ride.slug)} className="btn-primary mt-6 w-full">Request this ride</Link>
          <div className="mt-6 border-t border-line pt-5">
            <div className="text-sm font-semibold">Sourcing status</div>
            <p className="mt-1 text-sm text-ink-muted">
              Available on request. We source this ride for your date; availability is confirmed only after an operator
              commits and you accept a written quote.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
