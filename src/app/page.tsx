import Link from "next/link";
import { catalog } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";
import { indexingEnabled } from "@/lib/site";
import { paths } from "@/lib/urls";
import { FixtureBanner } from "@/components/Badges";
import { HowItWorks, RequestCta, RideCard } from "@/components/Marketing";
import { PlaceholderImage } from "@/components/design/PlaceholderImage";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return pageMetadata({
    title: "Carnival ride rentals for events",
    description:
      "Ferris wheels, carousels and swing rides for festivals, municipal, school and corporate events. We source an operator, send a written quote and coordinate the booking.",
    path: paths.home(),
    indexable: indexingEnabled(),
  });
}

const EVENT_TYPES = ["Corporate events", "Municipal celebrations", "Schools & colleges", "Festivals", "Private events"];

export default function Home() {
  const categories = catalog.categories();
  const rides = catalog.rides();
  const usesFixtures = [...categories, ...rides].some((r) => r.dataset === "fixture");
  return (
    <main>
      {usesFixtures ? <FixtureBanner /> : null}
      <section className="bg-ink text-canvas">
        <div className="container-page grid gap-12 pb-16 pt-12 lg:grid-cols-12 lg:gap-14 lg:pb-24 lg:pt-20">
          <div className="flex flex-col justify-center lg:col-span-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-marquee">Managed event ride rentals</p>
            <h1 className="mt-5 font-display text-4xl font-normal leading-[1.06] tracking-tight sm:text-5xl xl:text-[3.6rem]">
              Carnival ride rentals for your event — <span className="italic text-marquee-bright">we source, quote and coordinate</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-canvas/70">
              Tell us where and when. Our team sources a ride and operating crew from established carnival operators and
              sends you a written quote. Nothing is booked until you accept the scope and an operator commits.
            </p>
            <form action={paths.request()} method="get" aria-label="Start an event request" className="mt-10 rounded-xl bg-canvas p-2 text-ink shadow-2xl shadow-black/30">
              <div className="grid gap-2 sm:grid-cols-[1fr_5.5rem_1fr]">
                <label className="flex flex-col rounded-lg bg-white px-4 py-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-marquee">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Event city</span>
                  <input name="city" placeholder="City" className="bg-transparent text-[15px] placeholder:text-ink-muted/60 focus:outline-none" />
                </label>
                <label className="flex flex-col rounded-lg bg-white px-4 py-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-marquee">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">State</span>
                  <input name="state" maxLength={2} placeholder="TX" className="bg-transparent text-[15px] uppercase placeholder:text-ink-muted/60 focus:outline-none" />
                </label>
                <label className="flex flex-col rounded-lg bg-white px-4 py-3 ring-1 ring-line focus-within:ring-2 focus-within:ring-marquee">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Event date</span>
                  <input name="date" type="date" className="bg-transparent text-[15px] focus:outline-none" />
                </label>
                <button type="submit" className="inline-flex items-center justify-center rounded-lg bg-ink px-6 py-4 sm:col-span-3 text-sm font-semibold text-canvas hover:bg-ink-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-marquee">
                  Start an event request →
                </button>
              </div>
            </form>
            <p className="mt-4 text-sm text-canvas/50">A request is not a booking. You&apos;ll receive a written quote before anything is confirmed.</p>
          </div>
          <div className="relative lg:col-span-6">
            <PlaceholderImage glyph="ferris" size="lg" caption="Hero — Ferris wheel at an evening event" className="aspect-[4/3] rounded-2xl ring-1 ring-canvas/10 lg:aspect-auto lg:h-full lg:min-h-[540px]" />
          </div>
        </div>
      </section>

      <section className="container-page mt-16">
        <p className="eyebrow">Ride categories</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {categories.map((c) => (
            <Link key={c.slug} href={paths.category(c.slug)} className="card p-5 hover:shadow-md">
              <div className="font-display text-xl">{c.name}</div>
              <p className="mt-1 text-sm text-ink-muted">{c.summary}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-page mt-16">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-3xl">Ride rentals</h2>
          <Link href={paths.rides()} className="text-sm font-semibold underline">Browse all</Link>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {rides.slice(0, 3).map((r) => <RideCard key={r.slug} ride={r} />)}
        </div>
      </section>

      <HowItWorks />

      <section className="container-page mt-16">
        <p className="eyebrow">Who we work with</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {EVENT_TYPES.map((t) => (
            <li key={t} className="rounded-full border border-line bg-white px-4 py-2 text-sm">{t}</li>
          ))}
        </ul>
      </section>

      <RequestCta />
    </main>
  );
}
