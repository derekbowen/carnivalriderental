import Link from "next/link";
import { RideCard } from "@/components/RideCard";
import { HOW_IT_WORKS } from "@/components/RequestCta";
import { getContent } from "@/lib/content";
import { canonicalUrl, paths } from "@/lib/seo/routes";

export function generateMetadata() {
  return { alternates: { canonical: canonicalUrl("/") } };
}

export default function HomePage() {
  const { rides, categories } = getContent();
  const catName = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? "";
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
        <p className="eyebrow">Managed carnival ride rentals</p>
        <h1 className="mt-4 max-w-3xl text-4xl leading-tight sm:text-6xl">Carnival ride rentals for serious events.</h1>
        <p className="mt-5 max-w-2xl text-lg text-ink-soft">
          Tell us about your event. We source a suitable ride and professional operating crew, send you a written quote, and manage the booking through to your event day.
        </p>
        <form action="/request" method="get" className="card mt-10 grid gap-3 p-4 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end sm:p-5">
          <label className="block">
            <span className="label">Event city</span>
            <input name="cityName" className="input" placeholder="e.g. Austin, TX" autoComplete="address-level2" />
          </label>
          <label className="block">
            <span className="label">Event date</span>
            <input name="date" type="date" className="input" />
          </label>
          <button className="btn-primary h-[46px]">Start an event request</button>
        </form>
        <p className="mt-3 text-xs text-muted">Submitting a request is free and does not book anything.</p>
      </section>

      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Ride categories</p>
            <h2 className="mt-2 text-3xl">What would you like at your event?</h2>
          </div>
          <Link href={paths.rides()} className="btn-ghost hidden sm:inline-flex">Browse all rides</Link>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rides.map((r) => <RideCard key={r.slug} ride={r} categoryName={catName(r.categorySlug)} />)}
        </div>
        <p className="mt-4 text-sm text-muted">Complete carnival packages are planned for later.</p>
      </section>

      <section id="how-it-works" className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <p className="eyebrow">How managed booking works</p>
        <h2 className="mt-2 text-3xl">One point of contact, from request to event day.</h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-4">
          {HOW_IT_WORKS.map((s, i) => (
            <li key={s.title} className="card p-6">
              <div className="font-display text-3xl text-accent-strong">{i + 1}</div>
              <h3 className="mt-3 text-lg">{s.title}</h3>
              <p className="mt-2 text-sm text-ink-soft">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
        <div className="card grid gap-8 p-8 md:grid-cols-3">
          <div>
            <h3 className="text-lg">Plain status, always</h3>
            <p className="mt-2 text-sm text-ink-soft">Your request page shows exactly where things stand — reviewing, sourcing, quoted, committed or confirmed. We never call something booked before it is.</p>
          </div>
          <div>
            <h3 className="text-lg">Estimates are labelled as estimates</h3>
            <p className="mt-2 text-sm text-ink-soft">Planning ranges help you budget. Your price is the written quote you accept.</p>
          </div>
          <div>
            <h3 className="text-lg">Built for event organisers</h3>
            <p className="mt-2 text-sm text-ink-soft">Corporate planners, municipalities, schools, colleges, festivals and private events.</p>
          </div>
        </div>
      </section>
    </>
  );
}
