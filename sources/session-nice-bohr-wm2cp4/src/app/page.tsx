import { ArrowRightIcon, ArrowUpRightIcon, CalendarIcon, CheckIcon, FerrisWheelIcon, MapPinIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { AvailabilityBadge } from "@/components/badges";
import { HOW_IT_WORKS } from "@/components/RequestCta";
import { RideCard } from "@/components/RideCard";
import { PlaceholderImage } from "@/components/RideImage";
import { getContent } from "@/lib/content";
import { JsonLd } from "@/components/pseo";
import { canonicalUrl, paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";

export function generateMetadata() {
  return { alternates: { canonical: canonicalUrl("/") } };
}

const COMPARISON = [
  { label: "Finding rides", old: "Search dozens of carnival websites", ours: "Browse ride types here and send one request" },
  { label: "Getting a price", old: "Call around and wait for callbacks", ours: "Planning estimate up front, then one written quote from us" },
  { label: "Who you deal with", old: "Several vendors and contracts", ours: "One team from request to teardown" },
  { label: "If an operator can’t do your date", old: "Start over", ours: "We move to the next suitable operator and tell you" },
];

const COMMITMENTS = [
  { title: "One quote, one point of contact", body: "You get a single written scope and price from us. We deal with the operator so you don’t have to." },
  { title: "A no isn’t a dead end", body: "If the closest operator can’t do your date, we go to the next suitable one and tell you before anything changes." },
  { title: "Estimates are labelled as estimates", body: "Planning ranges help you budget. Your price is the written quote you accept." },
  { title: "Confirmed means confirmed", body: "A ride type on this site is not a booking. We only call it confirmed once an operator has committed and the agreed payment step is done." },
];

export default function HomePage() {
  const { rides, categories } = getContent();
  const catName = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? "";
  return (
    <>
      <JsonLd
        nodes={pageGraph({
          path: paths.home(),
          name: "Carnival ride rentals for events",
          description: "Request a carnival ride for your event. We source the ride and operating crew and manage the booking.",
          type: "WebPage",
          service: { name: "Carnival ride rentals" },
        })}
      />
      <section className="bg-ink text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-12 lg:gap-14 lg:px-10 lg:pb-24 lg:pt-16">
          <div className="lg:col-span-6">
            <h1 className="text-[44px] leading-[0.98] text-white sm:text-[60px] lg:text-[68px]">
              Carnival rides for your event. <span className="text-accent">One team books it.</span>
            </h1>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-white/80">
              Tell us the ride and your date. We find an operator with that ride, send you one written quote and manage the booking through to your event day.
            </p>
            <form action={paths.request()} method="get" className="mt-8 rounded-2xl bg-surface p-5 text-ink shadow-[0_24px_48px_-24px_rgba(0,0,0,0.5)]" aria-label="Start an event request">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="label">Ride</span>
                  <span className="relative block">
                    <FerrisWheelIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pop" aria-hidden="true" />
                    <select name="ride" className="input pl-9" defaultValue="">
                      <option value="">Not sure yet</option>
                      {rides.map((r) => <option key={r.slug} value={r.slug}>{r.name}</option>)}
                    </select>
                  </span>
                </label>
                <label className="block">
                  <span className="label">Event city</span>
                  <span className="relative block">
                    <MapPinIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pop" aria-hidden="true" />
                    <input name="cityName" className="input pl-9" placeholder="City, ST" autoComplete="address-level2" />
                  </span>
                </label>
                <label className="block">
                  <span className="label">Event date</span>
                  <span className="relative block">
                    <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pop" aria-hidden="true" />
                    <input name="date" type="date" className="input pl-9" />
                  </span>
                </label>
              </div>
              <button className="btn-primary mt-4 w-full">Start an event request <ArrowRightIcon className="h-4 w-4" aria-hidden="true" /></button>
              <p className="mt-3 text-center text-sm text-muted">Estimated prices are not final. Nothing is booked by submitting a request.</p>
            </form>
          </div>
          <div className="lg:col-span-6">
            <PlaceholderImage className="aspect-[4/3] w-full rounded-2xl" label="Lit-up Ferris wheel at an evening event" />
            <div className="mt-4 grid grid-cols-3 gap-4">
              <PlaceholderImage className="aspect-[4/3] rounded-xl" compact label="Carousel detail" />
              <PlaceholderImage className="aspect-[4/3] rounded-xl" compact label="Swing ride at dusk" />
              <PlaceholderImage className="aspect-[4/3] rounded-xl" compact label="Crew setting up a ride" />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-10" aria-labelledby="categories-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="categories-heading" className="text-4xl">Browse by ride type</h2>
            <p className="mt-2 max-w-lg text-muted">Pick a ride type and tell us about your event. We source the specific unit and operator.</p>
          </div>
          <Link href={paths.rides()} className="inline-flex items-center gap-1.5 text-sm font-medium hover:text-accent-strong">View all rides <ArrowRightIcon className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
          {categories.map((c, i) => {
            const featured = i === 0;
            const count = rides.filter((r) => r.categorySlug === c.slug).length;
            return (
              <Link key={c.slug} href={paths.category(c.slug)} className={`group relative flex flex-col ${featured ? "lg:col-span-2 lg:row-span-2" : ""}`}>
                <PlaceholderImage className={`w-full rounded-xl ${featured ? "aspect-[4/3] lg:aspect-auto lg:min-h-[360px] lg:flex-1" : "aspect-[16/10]"}`} compact={!featured} label={c.name} />
                <div className="mt-4 flex items-start justify-between gap-3">
                  <div>
                    <h3 className={featured ? "text-3xl" : "text-xl"}>{c.name}</h3>
                    <p className="mt-1 text-sm text-muted">{c.summary}</p>
                  </div>
                  <span className="mt-1 shrink-0 whitespace-nowrap text-xs text-muted">{count} {count === 1 ? "offering" : "offerings"}</span>
                </div>
                <ArrowUpRightIcon className="absolute right-3 top-3 h-8 w-8 rounded-full bg-surface p-2 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
              </Link>
            );
          })}
          <div className="flex flex-col opacity-70" aria-disabled="true">
            <PlaceholderImage className="aspect-[16/10] w-full rounded-xl" compact label="Full carnival packages" />
            <div className="mt-4 flex items-start justify-between gap-3">
              <div><h3 className="text-xl">Full carnival packages</h3><p className="mt-1 text-sm text-muted">Multiple rides under one booking.</p></div>
              <span className="shrink-0 whitespace-nowrap rounded-full border border-line-strong px-2.5 py-1 text-xs font-medium text-muted">Coming later</span>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-16 bg-accent text-ink" aria-labelledby="how-heading">
        <div className="awning h-3" aria-hidden="true" />
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-10 lg:py-24">
          <div className="grid gap-6 lg:grid-cols-12">
            <h2 id="how-heading" className="text-4xl lg:col-span-5 lg:text-[52px] lg:leading-[1.02]">How managed booking works</h2>
            <p className="text-[17px] leading-relaxed text-ink-soft lg:col-span-6 lg:col-start-7">
              You deal with one team from first request to final teardown. We hold the relationship with the operator, so scope, price and accountability sit in one place.
            </p>
          </div>
          <ol className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((s, i) => (
              <li key={s.title} className="flex flex-col rounded-2xl bg-surface p-6 shadow-[0_2px_0_0_#0B1B3F]">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-pop font-display text-xl text-white">{i + 1}</span>
                <h3 className="mt-5 font-sans text-lg font-bold leading-snug tracking-normal">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-12 text-sm font-medium text-ink-soft">
            Nothing is booked until step 4. Until then, availability reads <span className="font-bold text-ink">“Sourcing on request”</span> and prices read <span className="font-bold text-ink">“Estimate”</span>.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-10" aria-labelledby="featured-heading">
        <h2 id="featured-heading" className="text-4xl">Ride rental offerings</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rides.map((r) => <RideCard key={r.slug} ride={r} categoryName={catName(r.categorySlug)} />)}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-10" aria-labelledby="trust-heading">
        <div className="max-w-2xl">
          <h2 id="trust-heading" className="text-4xl lg:text-[52px] lg:leading-[1.02]">Stop chasing carnival companies.</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">Renting a ride usually means days of searching, calling and waiting. Send us one request instead.</p>
        </div>
        <div className="mt-12 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[560px] text-left text-[15px]">
            <caption className="sr-only">Booking a ride the old way versus with us</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="w-1/4 px-6 py-4"><span className="sr-only">Task</span></th>
                <th scope="col" className="px-6 py-4 text-sm font-semibold text-muted">The old way</th>
                <th scope="col" className="bg-ink px-6 py-4 text-sm font-semibold text-accent">Managed booking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {COMPARISON.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="px-6 py-4 font-semibold">{row.label}</th>
                  <td className="px-6 py-4 text-muted"><span className="flex items-start gap-2"><XIcon className="mt-0.5 h-4 w-4 shrink-0 text-pop" aria-hidden="true" />{row.old}</span></td>
                  <td className="bg-ink/[0.03] px-6 py-4 font-medium"><span className="flex items-start gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden="true" />{row.ours}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-16 grid gap-x-12 gap-y-8 md:grid-cols-2">
          {COMMITMENTS.map((c) => (
            <li key={c.title} className="border-t-2 border-ink pt-5">
              <h3 className="font-sans text-lg font-bold tracking-normal">{c.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{c.body}</p>
            </li>
          ))}
        </ul>
        <div className="mt-16 grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-2">
          <div className="bg-surface p-7">
            <h3 className="text-2xl">Reading our prices</h3>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex gap-4"><dt className="w-32 shrink-0"><span className="rounded bg-accent-wash px-2 py-0.5 text-xs font-semibold text-accent-strong">Estimate</span></dt><dd className="text-muted">A planning range for the ride type. Not a quote.</dd></div>
              <div className="flex gap-4"><dt className="w-32 shrink-0"><span className="rounded bg-ink px-2 py-0.5 text-xs font-semibold text-white">Quote</span></dt><dd className="text-muted">Our written scope and price for your event, awaiting your acceptance.</dd></div>
              <div className="flex gap-4"><dt className="w-32 shrink-0"><span className="rounded bg-ok-wash px-2 py-0.5 text-xs font-semibold text-ok">Accepted quote</span></dt><dd className="text-muted">The quote you accepted. Your final price for that scope.</dd></div>
            </dl>
          </div>
          <div className="bg-surface p-7">
            <h3 className="text-2xl">Reading our availability</h3>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-4"><dt className="sm:w-60 sm:shrink-0"><AvailabilityBadge /></dt><dd className="text-muted">We will look for an operator and unit for your dates. Not a confirmation.</dd></div>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-4"><dt className="sm:w-60 sm:shrink-0"><AvailabilityBadge verified /></dt><dd className="text-muted">Shown only where we have verified equipment serving that area. Your dates still need confirming.</dd></div>
            </dl>
          </div>
        </div>
      </section>
    </>
  );
}
