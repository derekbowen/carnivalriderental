import { notFound } from "next/navigation";
import { HOW_IT_WORKS, RequestCta } from "@/components/RequestCta";
import { Breadcrumbs, FaqSection, JsonLd, LinkGrid, SupplyList, SupplySource } from "@/components/pseo";
import { cardFromCatalog, structuredDataCards } from "@/lib/catalog/card";
import { getCatalog } from "@/lib/catalog/source";
import { getContent } from "@/lib/content";
import { seoMetadata } from "@/lib/seo/metadata";
import { stateGate, supplyFor } from "@/lib/seo/pseo";
import { paths } from "@/lib/seo/routes";
import { breadcrumbs, faqPage, itemList, rentalService, webPage } from "@/lib/seo/structured-data";
import { COMMON_FAQ, OCCASION_GROUPS, OCCASIONS, stateBySlug, US_STATES } from "@/lib/taxonomy";

export const dynamicParams = false;
export const revalidate = 600;

type P = { state: string };

export function generateStaticParams(): P[] {
  return US_STATES.map((s) => ({ state: s.slug }));
}

const copy = (name: string) => ({
  title: `Carnival ride rentals in ${name}`,
  description: `Rent carnival rides for events anywhere in ${name}: Ferris wheels, carousels, swing rides, kiddie and family rides. We source the ride and operating crew and send one written quote.`,
});

export async function generateMetadata({ params }: { params: Promise<P> }) {
  const s = stateBySlug((await params).state);
  if (!s) return {};
  return seoMetadata({ path: paths.state(s.slug), ...copy(s.name), gate: stateGate(s, await getCatalog()) });
}

export default async function StatePage({ params }: { params: Promise<P> }) {
  const s = stateBySlug((await params).state);
  if (!s) notFound();
  const snap = await getCatalog();
  const supply = supplyFor(snap, { stateCode: s.code });
  const cards = supply.map((r) => cardFromCatalog(r));
  const ldCards = structuredDataCards(cards, snap);
  const cities = getContent().locations.filter((l) => l.stateSlug === s.slug);
  const path = paths.state(s.slug);
  const crumbs = [{ name: "Home", path: paths.home() }, { name: s.name, path }];
  const { title, description } = copy(s.name);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd
        nodes={[
          webPage({ path, name: title, description, hasItemList: ldCards.length > 0, hasService: true }),
          breadcrumbs(crumbs),
          rentalService({ path, name: title, description, areaServed: { type: "State", name: s.name } }),
          ...(ldCards.length ? [itemList({ path, name: `Carnival rides available to request in ${s.name}`, cards: ldCards })] : []),
          faqPage(COMMON_FAQ, path),
        ]}
      />
      <Breadcrumbs items={crumbs} />
      <p className="eyebrow mt-6">{s.name}</p>
      <h1 className="mt-2 text-4xl">{title}</h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-soft">
        Planning an event in {s.name}? Tell us the date, location and the kind of ride you want. We find a carnival operator who can bring the ride and run it, then send you one written quote.
      </p>

      <section className="mt-10">
        <h2 className="text-2xl">Rides you can request in {s.name}</h2>
        <div className="mt-4">
          <SupplyList cards={cards} requestHref={paths.request(undefined, s.slug)} emptyText={`We have not published ride offerings for ${s.name} yet. You can still send a request and we will look for an operator.`} />
        </div>
        <SupplySource snap={snap} />
      </section>

      <div className="mt-12">
        <RequestCta href={paths.request(undefined, s.slug)} title={`Planning an event in ${s.name}?`} body="Share your dates and site details. We handle sourcing, the quote and coordination." />
      </div>

      {OCCASION_GROUPS.map((g) => (
        <LinkGrid
          key={g.id}
          title={`${g.name} in ${s.name}`}
          links={OCCASIONS.filter((o) => o.group === g.id).map((o) => ({ href: paths.occasionState(o.id, s.slug), label: `Carnival rides for ${o.plural}` }))}
        />
      ))}

      <LinkGrid title={`Cities in ${s.name}`} links={cities.map((l) => ({ href: paths.city(l.stateSlug, l.citySlug), label: `${l.cityName}, ${l.stateCode}` }))} />

      <section className="mt-12">
        <h2 className="text-2xl">How it works</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((h, i) => (
            <li key={h.title} className="card p-5"><p className="text-xs font-semibold text-muted">Step {i + 1}</p><p className="mt-1 font-semibold">{h.title}</p><p className="mt-1 text-sm text-ink-soft">{h.body}</p></li>
          ))}
        </ol>
      </section>

      <FaqSection faq={COMMON_FAQ} />
    </div>
  );
}
