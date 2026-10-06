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
  { label: "Reaching the owner", old: "Call around and wait for callbacks", ours: "Direct contact details for matching operators, after you see how many there are" },
  { label: "Who you deal with", old: "Calls, texts and emails everywhere", ours: "The operator who owns the ride, directly, on their terms" },
  { label: "If an operator can’t do your date", old: "Start over", ours: "Unlock the next matching operator from the same pass" },
];

const COMMITMENTS = [
  { title: "You deal with the operator", body: "We sell access to the company that owns the ride, not the rental. Price, availability, contract and payment are between you and them." },
  { title: "Honest match counts", body: "Before you pay, we show exactly how many contactable operators match your event, and we don’t sell access when there are too few." },
  { title: "No made-up prices or availability", body: "A ride shows a price only when its operator has approved one. We never claim a ride is free on your date; only the operator knows." },
  { title: "Nothing here is a booking", body: "Event Access unlocks contact details. A booking exists only when you and the operator agree one directly." },
];

export default async function HomePage() {
  const approx = ipLocation(await headers());
  const where = approx ?? US_CENTER;
  const classes = await rideClassShowcase();
  const nearby = await searchOperatorListings({ origin: where });
  const total = classes.reduce((n, c) => n + c.count, 0);
  const heroOrder = ["major", "spectacular", "coaster", "family", "kiddie"];
  const heroPhotos = [...classes].filter((c) => c.photo).sort((a, b) => (heroOrder.indexOf(a.id) + 99) % 99 - (heroOrder.indexOf(b.id) + 99) % 99).slice(0, 4);
  const nearbyCards = nearby.error ? [] : nearby.cards.filter((c) => c.photo).slice(0, 8);
  return (
    <>
      <JsonLd
        nodes={pageGraph({
          path: paths.home(),
          name: "Carnival ride inventory and operator access",
          description: "Browse carnival ride inventory from independent operators nationwide and get direct contact details for the operators who match your event.",
          type: "WebPage",
          service: { name: "Carnival ride operator discovery" },
        })}
      />
      <section className="bg-ink text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-12 lg:gap-14 lg:px-10 lg:pb-24 lg:pt-16">
          <div className="lg:col-span-6">
            <h1 className="text-[44px] leading-[0.98] text-white sm:text-[60px] lg:text-[68px]">
              Find the ride. <span className="text-accent">Connect with the company that owns it.</span>
            </h1>
            <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-white/80">
              Browse carnival ride inventory from independent operators nationwide, nearest first. Event Access gives you direct contact details for the operators who match your event; the rental is agreed with them.
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
                {total > 0 ? `${total.toLocaleString("en-US")} rides from operators across the US. ` : ""}Not sure what you need? <Link href={paths.connect()} className="font-semibold underline">Start with your event</Link>.
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
              Carnival Ride Rental is a discovery and operator-access platform. Independent operators own, deliver and run their rides; we make them easy to find and put you in direct contact with the ones who match your event.
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
            Nothing on this site is a booking. Event Access is a one-time fee for contact details; the rental itself is agreed and paid directly with the operator.
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
              <div className="flex gap-4"><dt className="w-36 shrink-0"><span className="rounded bg-ink px-2 py-0.5 text-xs font-semibold text-white">Priced by the operator</span></dt><dd className="text-muted">Most rides. Operators quote per event once they know your date, location, hours and site. Delivery, power, permits and crew vary.</dd></div>
              <div className="flex gap-4"><dt className="w-36 shrink-0"><span className="rounded bg-accent-wash px-2 py-0.5 text-xs font-semibold text-accent-strong">$ per day</span></dt><dd className="text-muted">Shown only when the ride&rsquo;s operator has approved a figure for that rental length. Still not a quote.</dd></div>
            </dl>
          </div>
          <div className="bg-surface p-7">
            <h3 className="text-2xl">What Event Access is</h3>
            <dl className="mt-5 space-y-4 text-sm">
              <div className="flex gap-4"><dt className="w-36 shrink-0 font-semibold">One fee</dt><dd className="text-muted">Paid to Carnival Ride Rental, for one event. You see the number of matching, contactable operators before paying.</dd></div>
              <div className="flex gap-4"><dt className="w-36 shrink-0 font-semibold">What you get</dt><dd className="text-muted">Company name, phone, email and website for the operators you choose to unlock, for the life of your pass.</dd></div>
              <div className="flex gap-4"><dt className="w-36 shrink-0 font-semibold">What you don&rsquo;t</dt><dd className="text-muted">A booking, a guaranteed reply, a price, or availability. Those come from the operator.</dd></div>
            </dl>
          </div>
        </div>
      </section>
    </>
  );
}
