import { notFound } from "next/navigation";
import { PricingNotice } from "@/components/PricingNotice";
import { NearbyRides } from "@/components/search/NearbyRides";
import { CITIES, ridesNear, PSEO_INVENTORY } from "@/lib/inventory";
import { HOW_IT_WORKS, RequestCta } from "@/components/RequestCta";
import { Breadcrumbs, FaqSection, JsonLd, LinkGrid, SupplyList, SupplySource } from "@/components/pseo";
import { cardFromCatalog, structuredDataCards } from "@/lib/catalog/card";
import { getCatalog } from "@/lib/catalog/source";
import { getContent } from "@/lib/content";
import { seoMetadata } from "@/lib/seo/metadata";
import { stateGate, supplyFor } from "@/lib/seo/pseo";
import { paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";
import { COMMON_FAQ, OCCASION_GROUPS, OCCASIONS, stateBySlug, US_STATES } from "@/lib/taxonomy";

export const dynamicParams = false;
export const revalidate = 600;

type P = { state: string };

export function generateStaticParams(): P[] {
  return US_STATES.map((s) => ({ state: s.slug }));
}

const copy = (name: string) => ({
  title: `Carnival ride rentals in ${name}`,
  description: `Find carnival rides for events in ${name}: Ferris wheels, carousels, swing rides, kiddie and family rides, nearest operators first. Request a ride from the operator who owns it.`,
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
        nodes={pageGraph({
          path,
          name: title,
          description,
          type: "CollectionPage",
          crumbs,
          service: { areaServed: { type: "State", name: s.name } },
          list: { name: `Carnival rides available to request in ${s.name}`, cards: ldCards },
          faq: COMMON_FAQ,
        })}
      />
      <Breadcrumbs items={crumbs} />
      <p className="eyebrow mt-6">{s.name}</p>
      <h1 className="mt-2 text-4xl">{title}</h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-soft">
        Planning an event in {s.name}? Find rides from operators near you and send a request. Operators on Carnival Ride Rental reply directly; for operators who haven&rsquo;t joined yet, our request desk contacts them for you.
      </p>

      <section className="mt-10">
        <h2 className="text-2xl">Rides you can request in {s.name}</h2>
        <div className="mt-4">
          <SupplyList cards={cards} requestHref={paths.request(undefined, s.slug)} emptyText={`We have not published ride offerings for ${s.name} yet. You can still send a request and we will look for an operator.`} />
        </div>
        <SupplySource snap={snap} />
        <PricingNotice className="mt-6" />
      </section>

      <NearbyRides stateCode={s.code} stateSlug={s.slug} label={s.name} />

      <LinkGrid
        title={`Carnival rides by city in ${s.name}`}
        links={CITIES.filter((c) => c.state === s.code && ridesNear(c.lat, c.lng).length >= PSEO_INVENTORY.cityMinRides)
          .sort((a, b) => b.pop - a.pop)
          .slice(0, 60)
          .map((c) => ({ href: paths.city(s.slug, c.slug), label: c.name }))}
      />

      <div className="mt-12">
        <RequestCta href={paths.request(undefined, s.slug)} title={`Planning an event in ${s.name}?`} body="Share your date and site details. Operators reply in your inbox; for operators who have not joined yet, our request desk contacts them for you." />
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
