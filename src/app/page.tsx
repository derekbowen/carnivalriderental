import { ArrowRightIcon, ArrowUpRightIcon, CheckIcon, FerrisWheelIcon, MapPinIcon, XIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { HOW_IT_WORKS } from "@/components/RequestCta";
import { PlaceholderImage } from "@/components/RideImage";
import { RideResult } from "@/components/search/RideResult";
import { JsonLd } from "@/components/pseo";
import { ipLocation, rideClassShowcase, searchOperatorListings, US_CENTER } from "@/lib/catalog/operator-search";
import { US_STATES } from "@/lib/taxonomy";
import { canonicalUrl, paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";

// Live inventory near the visitor (approximate IP location), so the page renders per request.
export const dynamic = "force-dynamic";

export function generateMetadata() {
  return { alternates: { canonical: canonicalUrl("/") } };
}

const COMPARISON = [
  { label: "Finding rides", old: "Search dozens of carnival websites", ours: "Rides from operators across the US, nearest to you first" },
  { label: "Getting a price", old: "Call around and wait for callbacks", ours: "Rate-card estimate up front; the operator confirms the total" },
  { label: "Who you deal with", old: "Calls, texts and emails everywhere", ours: "The operator who owns the ride, every message in one inbox" },
  { label: "If an operator can’t do your date", old: "Start over", ours: "Request another nearby ride in a minute" },
];

const COMMITMENTS = [
  { title: "Straight to the operator", body: "Requests go to the operator who owns the ride. If they haven’t joined yet, our request desk contacts them and says so." },
  { title: "Honest about who has your request", body: "We never say an operator received or accepted something unless they did." },
  { title: "Estimates are labelled as estimates", body: "Rate-card estimates help you budget. The operator confirms the total." },
  { title: "Confirmed means confirmed", body: "A request is not a booking. A ride is booked only when the operator accepts and payment is completed through the marketplace." },
];

export default async function HomePage() {
  const approx = ipLocation(await headers());
  const where = approx ?? US_CENTER;
  const [classes, nearby] = await Promise.all([rideClassShowcase(), searchOperatorListings({ origin: where })]);
  const total = classes.reduce((n, c) => n + c.count, 0);
  const heroOrder = ["major", "spectacular", "coaster", "family", "kiddie"];
  const heroPhotos = [...classes].filter((c) => c.photo).sort((a, b) => (heroOrder.indexOf(a.id) + 99) % 99 - (heroOrder.indexOf(b.id) + 99) % 99).slice(0, 4);
  const nearbyCards = nearby.error ? [] : nearby.cards.filter((c) => c.photo).slice(0, 8);
  return (
    <>
      <JsonLd
        nodes={pageGraph({
          path: paths.home(),
          name: "Carnival ride rentals for events",
          description: "Find carnival rides near your event and request them from the operators who own them.",
          type: "WebPage",
          service: { name: "Carnival ride rentals" },
        })}
      />
      <section className="bg-ink text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-12 lg:gap-14 lg:px-10 lg:pb-24 lg:pt-16">
          <div className="lg:col-span-6">
            <h1 className="text-[44px] leading-[0.98] text-white sm:text-[60px] lg:text-[68px]">
              Carnival rides for your event. <span className="text-accent">Straight from the operators.</span>
            </h1>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-white/80">
              Find carnival rides near your event, nearest first, and request the one you want. Operators on Carnival Ride Rental reply directly; for operators who haven’t joined yet, our request desk contacts them for you.
            </p>
            <form action={paths.search()} method="get" className="mt-8 rounded-2xl bg-surface p-5 text-ink shadow-[0_24px_48px_-24px_rgba(0,0,0,0.5)]" aria-label="Find rides near your event">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="label">Ride type</span>
                  <span className="relative block">
                    <FerrisWheelIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pop" aria-hidden="true" />
                    <select name="class" className="input pl-9" defaultValue="">
                      <option value="">All rides</option>
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </span>
                </label>
                <label className="block">
                  <span className="label">Event state</span>
                  <span className="relative block">
                    <MapPinIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pop" aria-hidden="true" />
                    <select name="state" className="input pl-9" defaultValue="">
                      <option value="">Near me</option>
                      {US_STATES.map((st) => <option key={st.slug} value={st.slug}>{st.name}</option>)}
                    </select>
                  </span>
                </label>
              </div>
              <button className="btn-primary mt-4 w-full">Find rides <ArrowRightIcon className="h-4 w-4" aria-hidden="true" /></button>
              <p className="mt-3 text-center text-sm text-muted">
                {total > 0 ? `${total.toLocaleString("en-US")} rides from operators across the US. ` : ""}Not sure what you need? <Link href={paths.request()} className="font-semibold underline">Send a general request</Link>.
              </p>
            </form>
          </div>
          <div className="lg:col-span-6">
            {heroPhotos.length >= 4 ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={heroPhotos[0].photo!.src} alt={heroPhotos[0].photo!.alt} className="aspect-[4/3] w-full rounded-2xl object-cover" />
                <div className="mt-4 grid grid-cols-3 gap-4">
                  {heroPhotos.slice(1, 4).map((c) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={c.id} src={c.photo!.src} alt={c.photo!.alt} className="aspect-[4/3] w-full rounded-xl object-cover" />
                  ))}
                </div>
              </>
            ) : (
              <PlaceholderImage className="aspect-[4/3] w-full rounded-2xl" label="Carnival rides" />
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-10" aria-labelledby="categories-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="categories-heading" className="text-4xl">Browse by ride type</h2>
            <p className="mt-2 max-w-lg text-muted">Every ride type, with real rides from operators. Pick one to see the nearest first.</p>
          </div>
          <Link href={paths.search()} className="inline-flex items-center gap-1.5 text-sm font-medium hover:text-accent-strong">Find rides near you <ArrowRightIcon className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {classes.map((c, i) => (
            <Link key={c.id} href={paths.search({ rideClass: c.id })} className={`group relative flex flex-col ${i === 0 ? "sm:col-span-2 lg:row-span-2" : ""}`}>
              {c.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.photo.src} alt={c.photo.alt} loading="lazy" className={`w-full rounded-xl object-cover ${i === 0 ? "aspect-[4/3] lg:aspect-auto lg:min-h-[360px] lg:flex-1" : "aspect-[16/10]"}`} />
              ) : (
                <PlaceholderImage className="aspect-[16/10] w-full rounded-xl" compact label={c.label} />
              )}
              <div className="mt-3 flex items-baseline justify-between gap-3">
                <h3 className={i === 0 ? "text-3xl" : "text-xl"}>{c.label}</h3>
                <span className="shrink-0 whitespace-nowrap text-xs text-muted">{c.count.toLocaleString("en-US")} rides</span>
              </div>
              <ArrowUpRightIcon className="absolute right-3 top-3 h-8 w-8 rounded-full bg-surface p-2 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-16 bg-accent text-ink" aria-labelledby="how-heading">
        <div className="awning h-3" aria-hidden="true" />
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-10 lg:py-24">
          <div className="grid gap-6 lg:grid-cols-12">
            <h2 id="how-heading" className="text-4xl lg:col-span-5 lg:text-[52px] lg:leading-[1.02]">How it works</h2>
            <p className="text-[17px] leading-relaxed text-ink-soft lg:col-span-6 lg:col-start-7">
              Carnival Ride Rental is a marketplace. Operators own, deliver and run their rides; we make them easy to find, request and book, with every message in one inbox.
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
            Nothing is booked until step 4. A request is not a booking, and prices read <span className="font-bold text-ink">“Estimate”</span> until the operator confirms the total.
          </p>
        </div>
      </section>

      {nearbyCards.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-10" aria-labelledby="featured-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="featured-heading" className="text-4xl">Rides near {approx ? approx.label : "you"}</h2>
            <Link href={paths.search()} className="btn-ghost">See all rides near you</Link>
          </div>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {nearbyCards.map((c) => <li key={c.id}><RideResult card={c} /></li>)}
          </ul>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-10" aria-labelledby="trust-heading">
        <div className="max-w-2xl">
          <h2 id="trust-heading" className="text-4xl lg:text-[52px] lg:leading-[1.02]">Stop chasing carnival companies.</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">Renting a ride usually means days of searching, calling and waiting. Find the nearest rides here and send one request.</p>
        </div>
        <div className="mt-12 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[560px] text-left text-[15px]">
            <caption className="sr-only">Booking a ride the old way versus with us</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="w-1/4 px-6 py-4"><span className="sr-only">Task</span></th>
                <th scope="col" className="px-6 py-4 text-sm font-semibold text-muted">The old way</th>
                <th scope="col" className="bg-ink px-6 py-4 text-sm font-semibold text-accent">Carnival Ride Rental</th>
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
              <div className="flex gap-4"><dt className="w-36 shrink-0"><span className="rounded bg-accent-wash px-2 py-0.5 text-xs font-semibold text-accent-strong">Estimated from</span></dt><dd className="text-muted">Our rate card for that ride size, per day (4-hour rental). Not the final price: generator, transportation, permits and fuel can add to it.</dd></div>
              <div className="flex gap-4"><dt className="w-36 shrink-0"><span className="rounded bg-ink px-2 py-0.5 text-xs font-semibold text-white">Request a quote</span></dt><dd className="text-muted">No confirmed rate for that ride size yet. Send a request and the operator prices your event.</dd></div>
            </dl>
          </div>
          <div className="bg-surface p-7">
            <h3 className="text-2xl">What &ldquo;booked&rdquo; means</h3>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex gap-4"><dt className="w-36 shrink-0 font-semibold">Request sent</dt><dd className="text-muted">Saved in your inbox. Not a booking, and no payment taken.</dd></div>
              <div className="flex gap-4"><dt className="w-36 shrink-0 font-semibold">Booked</dt><dd className="text-muted">Only when the operator accepts and payment is completed through the marketplace.</dd></div>
            </dl>
          </div>
        </div>
      </section>
    </>
  );
}
