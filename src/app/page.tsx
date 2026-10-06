import { ArrowRightIcon, ArrowUpRightIcon, CheckIcon, FerrisWheelIcon, MapPinIcon, XIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { HOW_IT_WORKS } from "@/components/RequestCta";
import { PlaceholderImage } from "@/components/RideImage";
import { RideResult } from "@/components/search/RideResult";
import { FaqSection, JsonLd } from "@/components/pseo";
import { activeProduct, DEFAULT_PRODUCT, type AccessProduct } from "@/lib/access/config";

type ProductLimits = Pick<AccessProduct, "unlockLimit" | "validityDays">;
import { accessDb } from "@/lib/access/db";
import { accessAvailability } from "@/lib/access/runtime";
import { getOperatorListing, ipLocation, rideClassShowcase, searchOperatorListings, US_CENTER } from "@/lib/catalog/operator-search";
import { BRAND, SITE_DESCRIPTION } from "@/lib/config";
import { operatorCount, RIDES } from "@/lib/inventory";
import { FOOTER_CITIES, FOOTER_EVENTS } from "@/lib/seo/footer-links";
import { canonicalUrl, paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";
import { US_STATES, type Faq } from "@/lib/taxonomy";

// Live inventory near the visitor (approximate IP location), so the page renders per request.
export const dynamic = "force-dynamic";

const TITLE = `Carnival Ride Rentals Nationwide | ${BRAND.name}`;

export function generateMetadata() {
  return { title: TITLE, description: SITE_DESCRIPTION, alternates: { canonical: canonicalUrl("/") }, openGraph: { title: TITLE, description: SITE_DESCRIPTION, url: canonicalUrl("/") } };
}

const GUIDE = paths.guide("how-to-rent-carnival-rides");

const COMPARISON = [
  { label: "Finding rides", old: "Search many individual company websites", ours: "Browse equipment from operators across the country in one place" },
  { label: "Who serves your area", old: "Guess which companies travel to you", ours: "Search by location and see rides from operators based near you" },
  { label: "Comparing options", old: "Call one company at a time", ours: "Compare several relevant rides and operators side by side" },
  { label: "If they can’t do your date", old: "Start over from scratch", ours: "Move on to the next matching operator on the same pass" },
  { label: "Rental logistics", old: "Work out transport, power and insurance questions yourself", ours: "Use our buyer guide and checklist before you call" },
];

const BEFORE_YOU_RENT = [
  { title: "Know your event", body: "Date, location, operating hours, attendance, age range and the ride types you want. Operators quote faster with the facts in hand." },
  { title: "Know your site", body: "Setup area, surface, truck and trailer access, overhead lines and where power is. These decide what fits as much as budget does." },
  { title: "Ask about logistics", body: "Transport and mobilization, generators and fuel, staffing, setup and teardown time. Requirements vary by ride and operator." },
  { title: "Ask about paperwork", body: "Certificates of insurance, additional-insured requests, permits and inspections. Rules vary by venue, city and state." },
];

/** Limits come from the active product (access_products), never from copy. */
const eventAccessIncludes = (p: ProductLimits) => [
  "Direct contact details for matching carnival operators",
  `Up to ${p.unlockLimit} unique operators per event, chosen by you`,
  "Several comparable equipment options when the area has them",
  "Matching based on your date, location and ride type",
  `${p.validityDays} days of access to your pass`,
  "Buyer guidance and a quote-comparison checklist",
  "You negotiate and book directly with the operator",
  "No percentage commission added to the rental",
];

const faqFor = (p: ProductLimits): Faq[] => [
  { q: "Does Carnival Ride Rental rent the rides?", a: "No. Every ride here belongs to an independent carnival operator. We show their inventory, help you find the rides that fit your event and area, and give you direct contact details for matching operators through Event Access. The rental is arranged and paid directly with the operator." },
  { q: "Is a ride available on my date?", a: "Only the operator knows. A listing means the operator owns the ride and serves the area; it is not a confirmation that the ride is free on your date. Confirm availability with each operator you contact." },
  { q: "How much does it cost to rent a carnival ride?", a: "Operators price per event. Travel distance, hours, crew, power, permits and insurance all change the figure, so operators quote after hearing your date, location and site details. We don't set or collect rental prices." },
  { q: "What does Event Access include?", a: `A one-time fee for one event. It includes direct contact details for up to ${p.unlockLimit} matching operators, ${p.validityDays} days of access, and our buyer guidance. You see how many operators match before you pay, and there is no commission on the rental.` },
  { q: "Can I browse without paying?", a: "Yes. Ride photos, details, service areas, nearby counts, event guides and the buyer guide are free. Event Access is only for reaching the operators directly." },
];

/**
 * Hero: four real operator photos from the public snapshot, one each of a Ferris wheel, a thrill
 * ride, a family ride and a kiddie ride (deduplicated by photo). Deterministic, no network.
 */
function heroShowcase(): { id: string; label: string; photo: { src: string; alt: string } }[] {
  const used = new Set<string>();
  const pick = (label: string, pred: (r: (typeof RIDES)[number]) => boolean) => {
    const r = RIDES.find((x) => x.photo && pred(x) && !used.has(x.photo!));
    if (!r) return null;
    used.add(r.photo!);
    return { id: r.id, label, photo: { src: r.photo!, alt: `${r.title}, a ${label.toLowerCase()} listed by an independent carnival operator` } };
  };
  return [
    pick("Ferris wheel", (r) => r.rideType === "ferris-wheel"),
    pick("Thrill ride", (r) => r.rideClass === "spectacular" || r.rideClass === "major"),
    pick("Family ride", (r) => r.rideClass === "family"),
    pick("Kiddie ride", (r) => r.rideClass === "kiddie"),
  ].filter((x): x is NonNullable<typeof x> => !!x);
}

export default async function HomePage() {
  const approx = ipLocation(await headers());
  const where = approx ?? US_CENTER;
  const classes = await rideClassShowcase();
  const nearby = await searchOperatorListings({ origin: where });
  const product: ProductLimits = (accessAvailability().enabled ? await activeProduct(await accessDb()).catch(() => null) : null) ?? DEFAULT_PRODUCT;
  const FAQ = faqFor(product);
  const total = classes.reduce((n, c) => n + c.count, 0) || RIDES.length;
  const operators = operatorCount(RIDES);
  const heroPhotos = await Promise.all(
    heroShowcase().map(async (h) => {
      const live = await getOperatorListing(h.id).catch(() => null);
      return live?.photoLarge ? { ...h, photo: { src: live.photoLarge.src, alt: h.photo.alt } } : h;
    }),
  );
  const nearbyCards = nearby.error ? [] : nearby.cards.filter((c) => c.photo).slice(0, 8);
  const fmt = (n: number) => n.toLocaleString("en-US");
  return (
    <>
      <JsonLd
        nodes={pageGraph({
          path: paths.home(),
          name: "Carnival Ride Rentals Nationwide",
          description: SITE_DESCRIPTION,
          type: "WebPage",
          service: { name: "Carnival ride discovery and operator access" },
          faq: FAQ,
        })}
      />

      {/* 1. Hero + search */}
      <section className="bg-ink text-white">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-12 lg:gap-14 lg:px-10 lg:pb-24 lg:pt-16">
          <div className="lg:col-span-6">
            <p className="font-display text-lg font-semibold text-accent sm:text-xl">Adding a touch of magic to every event.</p>
            <h1 className="mt-3 text-[42px] leading-[1.02] text-white sm:text-[58px] lg:text-[66px]">Carnival Ride Rentals Nationwide</h1>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-white/80">
              Browse real carnival ride inventory from operators across the country. Find the rides that fit your event, compare nearby options, and connect directly with the companies that own them.
            </p>
            <form action={paths.search()} method="get" className="mt-8 rounded-2xl bg-surface p-5 text-ink shadow-[0_24px_48px_-24px_rgba(0,0,0,0.5)]" aria-label="Find carnival rides near your event">
              <p className="mb-3 font-semibold">What are you looking for?</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="label">Ride type</span>
                  <span className="relative block">
                    <FerrisWheelIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pop" aria-hidden="true" />
                    <select name="class" className="input pl-9" defaultValue="">
                      <option value="">All carnival rides</option>
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                  </span>
                </label>
                <label className="block">
                  <span className="label">Location</span>
                  <span className="relative block">
                    <MapPinIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pop" aria-hidden="true" />
                    <select name="state" className="input pl-9" defaultValue="">
                      <option value="">Near me</option>
                      {US_STATES.map((st) => <option key={st.slug} value={st.slug}>{st.name}</option>)}
                    </select>
                  </span>
                </label>
              </div>
              <button className="btn-primary mt-4 w-full">Find carnival rides <ArrowRightIcon className="h-4 w-4" aria-hidden="true" /></button>
              <p className="mt-3 text-center text-sm text-muted">
                Browse {fmt(total)} carnival rides from {fmt(operators)} independent operators across the U.S. Availability for your date is confirmed with the operator.
              </p>
            </form>
          </div>
          <div className="lg:col-span-6">
            {heroPhotos.length >= 4 ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={heroPhotos[0].photo.src} alt={heroPhotos[0].photo.alt} width={1200} height={900} fetchPriority="high" className="aspect-[4/3] w-full rounded-2xl object-cover" />
                <div className="mt-4 grid grid-cols-3 gap-4">
                  {heroPhotos.slice(1, 4).map((c) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={c.id} src={c.photo.src} alt={c.photo.alt} width={400} height={300} className="aspect-[4/3] w-full rounded-xl object-cover" />
                  ))}
                </div>
                <p className="mt-3 text-xs text-white/55">Real rides from operator listings: {heroPhotos.map((c) => c.label.toLowerCase()).join(", ")}.</p>
              </>
            ) : (
              <PlaceholderImage className="aspect-[4/3] w-full rounded-2xl" label="Carnival rides" />
            )}
          </div>
        </div>
      </section>

      {/* 2. Browse by ride type */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-10 lg:py-20" aria-labelledby="categories-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="categories-heading" className="text-4xl">Browse carnival rides by type</h2>
            <p className="mt-2 max-w-lg text-muted">Real rides from operator listings, nearest to you first. Pick a type to see what is available around your event.</p>
          </div>
          <Link href={paths.search()} className="inline-flex items-center gap-1.5 text-sm font-medium hover:text-accent-strong">See all rides near you <ArrowRightIcon className="h-4 w-4" aria-hidden="true" /></Link>
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
                <span className="shrink-0 whitespace-nowrap text-xs text-muted">{fmt(c.count)} rides</span>
              </div>
              <ArrowUpRightIcon className="absolute right-3 top-3 h-8 w-8 rounded-full bg-surface p-2 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>

      {/* 3. Rides near the visitor */}
      {nearbyCards.length > 0 && (
        <section className="border-y border-line bg-surface" aria-labelledby="featured-heading">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="featured-heading" className="text-4xl">Carnival rides near {approx ? approx.label : "you"}</h2>
                <p className="mt-2 max-w-lg text-muted">Nearest operators first, measured from their home base. Every card is a real ride an operator has listed.</p>
              </div>
              <Link href={paths.search()} className="btn-ghost">See all rides near you</Link>
            </div>
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {nearbyCards.map((c) => <li key={c.id}><RideResult card={c} /></li>)}
            </ul>
          </div>
        </section>
      )}

      {/* 4. How it works */}
      <section id="how-it-works" className="scroll-mt-16 bg-accent text-ink" aria-labelledby="how-heading">
        <div className="awning h-3" aria-hidden="true" />
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-10 lg:py-24">
          <div className="grid gap-6 lg:grid-cols-12">
            <h2 id="how-heading" className="text-4xl lg:col-span-5 lg:text-[52px] lg:leading-[1.02]">How {BRAND.name} works</h2>
            <p className="text-[17px] leading-relaxed text-ink-soft lg:col-span-6 lg:col-start-7">
              Independent carnival operators own, deliver and run the rides. We make their equipment easy to find and compare, then put you in direct contact with the companies that match your event.
            </p>
          </div>
          <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((s, i) => (
              <li key={s.title} className="flex flex-col rounded-2xl bg-surface p-6 shadow-[0_2px_0_0_#0B1B3F]">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-pop font-display text-xl text-white">{i + 1}</span>
                <h3 className="mt-5 font-sans text-lg font-bold leading-snug tracking-normal">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 5. Why finding carnival rides is hard, and the comparison */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-10 lg:py-20" aria-labelledby="trust-heading">
        <div className="max-w-2xl">
          <h2 id="trust-heading" className="text-4xl lg:text-[52px] lg:leading-[1.02]">Finding a carnival ride shouldn’t take a week of phone calls.</h2>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">
            Most carnival companies are small, regional and busy on the road. Their websites are hard to find, their service areas are rarely written down, and the first one you reach may be booked on your date. We put their equipment in one place so you can see what exists near you before you pick up the phone.
          </p>
        </div>
        <div className="mt-12 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[560px] text-left text-[15px]">
            <caption className="sr-only">Finding a ride the traditional way compared with Carnival Ride Rental</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="w-1/4 px-6 py-4"><span className="sr-only">Task</span></th>
                <th scope="col" className="px-6 py-4 text-sm font-semibold text-muted">Traditional search</th>
                <th scope="col" className="bg-ink px-6 py-4 text-sm font-semibold text-accent">{BRAND.name}</th>
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
      </section>

      {/* 6. Event types */}
      <section className="border-y border-line bg-surface" aria-labelledby="events-heading">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 id="events-heading" className="text-4xl">Carnival rides for every kind of event</h2>
              <p className="mt-2 max-w-xl text-muted">Which rides suit a school carnival, a company picnic or a church festival depends on your crowd’s ages and numbers. Each event guide explains what tends to work and what to ask.</p>
            </div>
            <Link href={paths.occasions()} className="inline-flex items-center gap-1.5 text-sm font-medium hover:text-accent-strong">All event types <ArrowRightIcon className="h-4 w-4" aria-hidden="true" /></Link>
          </div>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FOOTER_EVENTS.filter((e) => e.href !== paths.occasions()).map((e) => (
              <li key={e.href}><Link href={e.href} className="flex min-h-14 items-center justify-between rounded-xl border border-line bg-canvas px-5 py-3 font-semibold hover:border-ink">{e.label} <ArrowRightIcon className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" /></Link></li>
            ))}
          </ul>
        </div>
      </section>

      {/* 7. Popular locations */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-10" aria-labelledby="places-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="places-heading" className="text-4xl">Carnival ride rentals by city</h2>
            <p className="mt-2 max-w-xl text-muted">Each city page shows the rides from operators based within driving distance, by type, with the nearest first.</p>
          </div>
          <Link href={paths.directory()} className="inline-flex items-center gap-1.5 text-sm font-medium hover:text-accent-strong">All locations <ArrowRightIcon className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
        <ul className="mt-8 flex flex-wrap gap-2">
          {FOOTER_CITIES.map((c) => (
            <li key={c.href}><Link href={c.href} className="inline-flex min-h-11 items-center rounded-full border border-line-strong bg-surface px-4 text-sm font-medium hover:border-ink">{c.label}</Link></li>
          ))}
          <li><Link href={paths.directory()} className="inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-sm font-semibold text-white">Every state and city →</Link></li>
        </ul>
      </section>

      {/* 8. Buyer education */}
      <section className="bg-ink text-white" aria-labelledby="guide-heading">
        <div className="awning h-3" aria-hidden="true" />
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-10 lg:py-20">
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="eyebrow text-accent">Before you rent</p>
              <h2 id="guide-heading" className="mt-2 text-4xl text-white lg:text-[48px] lg:leading-[1.04]">What to know before you call a carnival company</h2>
              <p className="mt-4 text-[17px] leading-relaxed text-white/75">Renting a ride is a logistics job: trucks, power, crew, insurance and weather. Our free guide walks through the questions operators will ask you, the questions you should ask them, and how to compare quotes.</p>
              <Link href={GUIDE} className="btn-primary mt-6">Read the buyer guide <ArrowRightIcon className="h-4 w-4" aria-hidden="true" /></Link>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
              {BEFORE_YOU_RENT.map((b) => (
                <li key={b.title} className="rounded-2xl border border-white/15 bg-white/5 p-5">
                  <h3 className="font-sans text-lg font-bold tracking-normal text-white">{b.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-white/70">{b.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 9. Event Access */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-10 lg:py-20" aria-labelledby="access-heading">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-5">
            <p className="eyebrow">Event Access</p>
            <h2 id="access-heading" className="mt-2 text-4xl lg:text-[48px] lg:leading-[1.04]">Know who to call and what to ask.</h2>
            <p className="mt-4 text-[17px] leading-relaxed text-muted">
              Browsing is free. When you are ready to talk to operators, Event Access matches your event to the carnival companies with the right equipment nearby and gives you their direct contact details, so you can compare quotes and book with them directly.
            </p>
            <p className="mt-4 text-sm text-muted">You see how many operators match before you pay. We never sell access when there are too few, and nothing here is a booking: availability, price and the contract are agreed with the operator.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href={paths.connect()} className="btn-primary">Connect with operators <ArrowRightIcon className="h-4 w-4" aria-hidden="true" /></Link>
              <Link href={paths.accessPolicy()} className="btn-ghost">How Event Access works</Link>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-7 lg:col-span-7">
            <h3 className="text-2xl">What Event Access includes</h3>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {eventAccessIncludes(product).map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[15px]"><CheckIcon className="mt-1 h-4 w-4 shrink-0 text-ok" aria-hidden="true" />{item}</li>
              ))}
            </ul>
            <dl className="mt-6 grid gap-4 border-t border-line pt-6 text-sm sm:grid-cols-2">
              <div><dt className="font-semibold">Rental prices</dt><dd className="mt-1 text-muted">Set by each operator per event. A ride shows a figure only when its operator has approved one.</dd></div>
              <div><dt className="font-semibold">Booking</dt><dd className="mt-1 text-muted">Only you and the operator can make one. Event Access gets you to the right conversation faster.</dd></div>
            </dl>
          </div>
        </div>
      </section>

      {/* 10. Operator CTA */}
      <section className="border-y border-line bg-surface" aria-labelledby="operators-heading">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-5 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-10">
          <div>
            <p className="eyebrow">For carnival companies</p>
            <h2 id="operators-heading" className="mt-2 text-3xl">Own or operate carnival rides?</h2>
            <p className="mt-2 max-w-xl text-muted">Claim your free listing, keep your equipment and service area accurate, and hear directly from customers looking for rides like yours. No commission, no payment processing, no middleman.</p>
          </div>
          <Link href={paths.operators()} className="btn-dark shrink-0">Claim or list your rides <ArrowRightIcon className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
      </section>

      {/* 11. FAQ */}
      <div className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-10">
        <FaqSection faq={FAQ} />
      </div>
    </>
  );
}
