import { CheckIcon, PlugIcon, RulerIcon, TruckIcon, UsersIcon } from "lucide-react";
import type { ListingCardModel } from "@/lib/catalog/card";
import { structuredDataCards } from "@/lib/catalog/card";
import type { CatalogSnapshot } from "@/lib/catalog/source";
import type { CategoryPage, CategoryTheme } from "@/lib/content/category-pages";
import { categoryPageById } from "@/lib/content/category-pages";
import type { ServiceLocation } from "@/lib/content/types";
import { paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";
import { stateByCode } from "@/lib/taxonomy";
import { Breadcrumbs, FaqSection, JsonLd, LinkGrid, SupplyList, SupplySource } from "./pseo";
import { HOW_IT_WORKS, RequestCta } from "./RequestCta";
import { ListingCard } from "./ListingCard";
import { PricingNotice } from "./PricingNotice";

/**
 * THE category hub template (/categories/{id}). Five pilot categories share it; only the config
 * (copy, theme, illustration) differs. Section order follows docs/PSEO_TEMPLATES.md §3b.
 */
export function categoryHubPath(page: CategoryPage) {
  return paths.category(page.id);
}

/** Subtle, decorative, theme-specific motif. aria-hidden; no animation. */
function Motif({ theme }: { theme: CategoryTheme }) {
  const common = "pointer-events-none absolute select-none";
  switch (theme) {
    case "ferris":
      return (
        <svg aria-hidden="true" className={`${common} -right-24 -top-24 hidden h-[420px] w-[420px] opacity-[0.12] sm:block`} viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="96" fill="none" stroke="#ffc629" strokeWidth="2" />
          <circle cx="100" cy="100" r="70" fill="none" stroke="#ffc629" strokeWidth="1" />
          {Array.from({ length: 12 }, (_, i) => (
            <line key={i} x1="100" y1="100" x2={100 + 96 * Math.cos((i * Math.PI) / 6)} y2={100 + 96 * Math.sin((i * Math.PI) / 6)} stroke="#ffc629" strokeWidth="1" />
          ))}
        </svg>
      );
    case "carousel":
      return (
        <svg aria-hidden="true" className={`${common} inset-x-0 top-0 h-6 w-full`} viewBox="0 0 400 12" preserveAspectRatio="none">
          {Array.from({ length: 20 }, (_, i) => <path key={i} d={`M${i * 20} 0 a10 10 0 0 0 20 0 Z`} fill={i % 2 ? "#7a2335" : "#b08d3c"} />)}
        </svg>
      );
    case "swing":
      return (
        <svg aria-hidden="true" className={`${common} -right-10 bottom-0 hidden h-56 w-[640px] opacity-40 sm:block`} viewBox="0 0 640 220">
          <path d="M10 210 Q320 -40 630 210" fill="none" stroke="#2f7fc1" strokeWidth="2" />
          <path d="M70 210 Q320 20 570 210" fill="none" stroke="#2f7fc1" strokeWidth="1.5" />
        </svg>
      );
    case "thrill":
      return (
        <svg aria-hidden="true" className={`${common} -right-10 top-0 hidden h-full w-72 opacity-80 sm:block`} viewBox="0 0 200 400" preserveAspectRatio="none">
          <path d="M120 0 L200 0 L80 400 L0 400 Z" fill="#e5352b" opacity=".35" />
          <path d="M175 0 L200 0 L120 400 L95 400 Z" fill="#ffc629" opacity=".5" />
        </svg>
      );
    case "kiddie":
      return (
        <svg aria-hidden="true" className={`${common} right-4 top-4 hidden h-40 w-64 opacity-70 lg:block`} viewBox="0 0 260 160">
          {[[20, 30, 10, "#e5352b"], [70, 110, 7, "#1f9d8b"], [140, 40, 12, "#2f7fc1"], [210, 100, 8, "#ffc629"], [240, 30, 6, "#e5352b"]].map(([x, y, r, c]) => (
            <circle key={`${x}-${y}`} cx={x as number} cy={y as number} r={r as number} fill={c as string} />
          ))}
        </svg>
      );
  }
}

const PLANNING = [
  { key: "venueAccess", title: "Venue access", icon: TruckIcon },
  { key: "setupSpace", title: "Setup space", icon: RulerIcon },
  { key: "power", title: "Power", icon: PlugIcon },
  { key: "audience", title: "Your audience", icon: UsersIcon },
] as const;

export function CategoryHub({
  page,
  snap,
  catalogCards,
  fixtureCards,
  cities,
}: {
  page: CategoryPage;
  snap: CatalogSnapshot;
  /** Live catalog cards (real supply and labelled test samples). */
  catalogCards: ListingCardModel[];
  /** Development fixtures: only passed outside production; always labelled, never supply. */
  fixtureCards: ListingCardModel[];
  cities: ServiceLocation[];
}) {
  const path = paths.category(page.id);
  const crumbs = [{ name: "Home", path: paths.home() }, { name: "Rides", path: paths.rides() }, { name: page.name, path }];
  const requestHref = paths.request(undefined, undefined, undefined, undefined, page.id);
  const shown = [...catalogCards, ...fixtureCards];
  const ldCards = structuredDataCards(shown, snap);
  const states = [...new Set(catalogCards.flatMap((c) => c.states))].map((code) => stateByCode(code)).filter((s) => !!s).sort((a, b) => a!.name.localeCompare(b!.name));
  const related = page.related.map((id) => categoryPageById(id)).filter((p): p is CategoryPage => !!p);

  return (
    <div data-cat-theme={page.theme}>
      <JsonLd
        nodes={pageGraph({
          path,
          name: page.h1,
          description: page.metaDescription,
          type: "CollectionPage",
          crumbs,
          service: { serviceType: `${page.singular.charAt(0).toUpperCase()}${page.singular.slice(1)} rental` },
          list: { name: `${page.name} you can request`, cards: ldCards },
          faq: page.faqs,
        })}
      />

      {/* 1–2. Breadcrumbs + themed hero */}
      <section className="relative overflow-hidden bg-[var(--cat-hero-bg)] text-[var(--cat-hero-ink)]">
        <Motif theme={page.theme} />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:pb-16">
          <div>
            <div className="[&_a]:text-[var(--cat-hero-muted)] [&_a:hover]:text-[var(--cat-hero-ink)] [&_nav]:text-[var(--cat-hero-muted)]"><Breadcrumbs items={crumbs} /></div>
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--cat-hero-muted)]">Carnival ride rentals</p>
            <h1 className="mt-2 text-4xl leading-[1.05] text-[var(--cat-hero-ink)] sm:text-5xl">{page.h1}</h1>
            <p className="mt-4 max-w-xl text-lg text-[var(--cat-hero-muted)]">{page.intro}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={requestHref} className="btn-primary">Start an event request</a>
              <a href="#listings" className="inline-flex min-h-11 items-center rounded-lg border border-current px-5 text-[15px] font-semibold text-[var(--cat-hero-ink)]">See listings</a>
            </div>
          </div>
          <figure className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/illustrations/categories/${page.id}.svg`} alt={page.heroAlt} width={800} height={600} className="aspect-[4/3] w-full rounded-2xl border border-[var(--cat-rule)] object-cover shadow-[0_18px_40px_-24px_rgba(11,27,63,0.5)]" loading="eager" fetchPriority="high" />
            <figcaption className="absolute bottom-3 left-3 rounded bg-ink/75 px-2 py-0.5 text-[11px] font-medium text-white">Illustration — not a specific ride</figcaption>
          </figure>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        {/* 3. Photo-led listing cards, early */}
        <section id="listings" aria-labelledby="listings-heading" className="scroll-mt-24">
          <h2 id="listings-heading" className="text-3xl">{page.name} you can request</h2>
          <p className="mt-1 text-sm text-muted">A request is not a booking. Nothing is booked until the operator accepts and payment is completed.</p>
          <div className="mt-6">
            <SupplyList cards={catalogCards} requestHref={requestHref} emptyText={`No ${page.singular} listings are published yet. Send a request and we will look for an operator for your date.`} />
          </div>
          <SupplySource snap={snap} />
          <PricingNotice className="mt-6" />
          {fixtureCards.length > 0 && (
            <div data-testid="fixture-cards" className="mt-8 rounded-2xl border border-dashed border-demo/40 p-4 sm:p-5">
              <p className="text-sm font-semibold text-demo">Demo records — development fixtures, not live listings</p>
              <ul className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{fixtureCards.map((c) => <li key={c.key}><ListingCard card={c} /></li>)}</ul>
            </div>
          )}
        </section>

        {/* 4. Category-specific planning guidance */}
        <section aria-labelledby="planning-heading" className="mt-16">
          <h2 id="planning-heading" className="text-3xl">Planning a {page.singular} for your event</h2>
          <p className="mt-1 max-w-2xl text-ink-soft">General guidance. The operator confirms the requirements of the specific ride before you get a quote.</p>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PLANNING.map(({ key, title, icon: Icon }) => (
              <li key={key} className="rounded-2xl border border-line border-t-4 border-t-[var(--cat-accent)] bg-surface p-5">
                <p className="flex items-center gap-2 font-semibold"><Icon className="h-5 w-5 text-[var(--cat-accent)]" aria-hidden="true" />{title}</p>
                <p className="mt-2 text-sm text-ink-soft">{page.planning[key]}</p>
              </li>
            ))}
            <li className="rounded-2xl border border-[var(--cat-rule)] bg-[var(--cat-wash)] p-5 sm:col-span-2 lg:col-span-2">
              <p className="font-semibold">What we need for a quote</p>
              <ul className="mt-2 grid gap-1.5 text-sm text-ink-soft sm:grid-cols-2">
                {page.quoteChecklist.map((q) => <li key={q} className="flex gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--cat-accent)]" aria-hidden="true" />{q}</li>)}
              </ul>
              <p className="mt-3 text-xs text-muted">Not sure about something? Say so in the request — “not sure” is a fine answer.</p>
            </li>
          </ul>
        </section>

        {/* 5. Sourcing and quote confirmation */}
        <section aria-labelledby="sourcing-heading" className="mt-16 rounded-2xl bg-[var(--cat-wash)] p-6 sm:p-8">
          <h2 id="sourcing-heading" className="text-3xl">How sourcing and quotes work</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS.map((h, i) => (
              <li key={h.title} className="rounded-xl border border-line bg-surface p-5">
                <p className="text-xs font-semibold text-muted">Step {i + 1}</p>
                <p className="mt-1 font-semibold">{h.title}</p>
                <p className="mt-1 text-sm text-ink-soft">{h.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 6. FAQs (JSON-LD mirrors these exactly) */}
        <FaqSection faq={page.faqs} />

        {/* 7. Related categories and locations */}
        <LinkGrid title="Related ride types" links={related.map((r) => ({ href: paths.category(r.id), label: r.h1 }))} />
        <LinkGrid
          title={`Where to request a ${page.singular}`}
          links={[
            ...states.map((s) => ({ href: paths.state(s!.slug), label: `Carnival ride rentals in ${s!.name}` })),
            ...cities.map((l) => ({ href: paths.city(l.stateSlug, l.citySlug), label: `${l.cityName}, ${l.stateCode}` })),
          ]}
        />

        {/* 8. Final request CTA */}
        <div className="mt-16">
          <RequestCta href={requestHref} title={`Want a ${page.singular} at your event?`} body="Share your date and site details. Requests for operators who haven’t joined yet go to our request desk, and replies arrive in your marketplace inbox." />
        </div>
      </div>
    </div>
  );
}
