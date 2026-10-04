import Link from "next/link";
import type { RideType } from "@/lib/catalog/types";
import { paths } from "@/lib/urls";
import { PriceTag } from "./PriceTag";
import { Chip, SourcingChip } from "./Badges";
import { RideImage } from "./RideImage";

export const STEPS = [
  { title: "Tell us about your event", body: "Date, location, crowd, site and budget. “Not sure” is fine for technical questions." },
  { title: "We source matching operators", body: "Our team contacts established carnival operators who can cover your date and region." },
  { title: "You receive a written quote", body: "One price covering the ride, transport, setup, operating crew and teardown — with the scope spelled out." },
  { title: "Accept the scope and price", body: "Nothing is booked until you accept the quote in writing." },
  { title: "Booking confirmed when an operator commits", body: "We confirm only once an operator has committed to your event." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="container-page mt-20">
      <p className="eyebrow">How a managed booking works</p>
      <h2 className="mt-2 font-display text-3xl">We handle the sourcing. You approve the quote.</h2>
      <ol className="mt-8 grid gap-4 md:grid-cols-5">
        {STEPS.map((s, i) => (
          <li key={s.title} className="card p-5">
            <div className="font-display text-2xl text-marquee-deep">{i + 1}</div>
            <div className="mt-2 font-semibold">{s.title}</div>
            <p className="mt-1 text-sm text-ink-muted">{s.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function RideCard({ ride }: { ride: RideType }) {
  return (
    <Link href={paths.ride(ride.slug)} className="card group block overflow-hidden transition hover:shadow-lg">
      <RideImage image={ride.image} className="aspect-[3/2]" />
      <div className="p-5">
        <div className="flex flex-wrap gap-2">
          <SourcingChip />
          {ride.dataset === "fixture" ? <Chip tone="amber">Demo record</Chip> : null}
        </div>
        <h3 className="mt-3 font-display text-xl group-hover:underline">{ride.name}</h3>
        <p className="mt-1 text-sm text-ink-muted">{ride.summary}</p>
        <div className="mt-4">
          <PriceTag
            price={
              ride.estimate
                ? { kind: "estimate", lowCents: ride.estimate.lowCents, highCents: ride.estimate.highCents, placeholder: ride.estimate.placeholder }
                : { kind: "none" }
            }
          />
        </div>
      </div>
    </Link>
  );
}

export function RequestCta({ ride, where }: { ride?: RideType; where?: string }) {
  return (
    <section className="container-page mt-16">
      <div className="rounded-2xl bg-ink px-6 py-10 text-white sm:px-10">
        <h2 className="font-display text-2xl sm:text-3xl">
          {ride ? `Request a ${ride.name.toLowerCase().replace(/ rental$/, "")}` : "Tell us about your event"}
          {where ? ` for ${where}` : ""}
        </h2>
        <p className="mt-2 max-w-2xl text-white/80">
          Send us your event brief. We source an operator and reply with a written quote. Nothing is booked until you
          accept it and an operator commits.
        </p>
        <Link href={paths.request(ride?.slug)} className="mt-6 inline-flex rounded-md bg-marquee px-5 py-3 text-sm font-semibold text-ink hover:bg-marquee-soft">
          Start an event request
        </Link>
      </div>
    </section>
  );
}

export function JsonLd({ data }: { data: object }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
