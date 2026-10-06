import type { CatalogSnapshot } from "@/lib/catalog/source";
import { getContent } from "@/lib/content";
import { supplyFor } from "@/lib/seo/pseo";
import { paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";
import { cardFromCatalog, structuredDataCards } from "@/lib/catalog/card";
import { COMMON_FAQ, groupOf, occasionById, US_STATES, type Occasion, type UsState } from "@/lib/taxonomy";
import { Breadcrumbs, categoryLabel, FaqSection, JsonLd, LinkGrid, SupplyList, SupplySource } from "./pseo";
import { PricingNotice } from "./PricingNotice";
import { RequestCta } from "./RequestCta";

export function occasionCopy(o: Occasion, s?: UsState) {
  const where = s ? ` in ${s.name}` : "";
  return {
    title: `Carnival ride rentals for ${o.plural}${where}`,
    description: `Rent carnival rides for ${o.plural}${where}. Ferris wheels, carousels, swing, kiddie and family rides, sourced with an operating crew and quoted per event.`,
  };
}

/**
 * Template for /events/{occasion} and /events/{occasion}/{state}. Section order is the
 * page template defined in docs/PSEO_TEMPLATES.md — keep them in sync.
 */
export function OccasionPage({ o, s, snap }: { o: Occasion; s?: UsState; snap: CatalogSnapshot }) {
  const path = s ? paths.occasionState(o.id, s.slug) : paths.occasion(o.id);
  const { title, description } = occasionCopy(o, s);
  const crumbs = [
    { name: "Home", path: paths.home() },
    { name: "Events", path: paths.occasions() },
    { name: o.name, path: paths.occasion(o.id) },
    ...(s ? [{ name: s.name, path }] : []),
  ];
  const suggested = supplyFor(snap, { stateCode: s?.code, categories: o.suggestedCategories });
  const other = supplyFor(snap, { stateCode: s?.code }).filter((r) => !o.suggestedCategories.includes(r.categoryId));
  const suggestedCards = suggested.map((r) => cardFromCatalog(r));
  const otherCards = other.map((r) => cardFromCatalog(r));
  // ItemList = every card shown, in display order (suggested first, then other rides).
  const ldCards = structuredDataCards([...suggestedCards, ...otherCards], snap);
  const requestHref = paths.connect({ state: s?.slug, occasion: o.id });
  const group = groupOf(o);
  const related = o.related.map(occasionById).filter((x): x is Occasion => !!x);
  const cities = s ? getContent().locations.filter((l) => l.stateSlug === s.slug) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd
        nodes={pageGraph({
          path,
          name: title,
          description,
          type: "CollectionPage",
          crumbs,
          service: { areaServed: s ? { type: "State", name: s.name } : undefined },
          list: { name: `Rides for ${o.plural}${s ? ` in ${s.name}` : ""}`, cards: ldCards },
          faq: COMMON_FAQ,
        })}
      />
      <Breadcrumbs items={crumbs} />
      <p className="eyebrow mt-6">{group.name}</p>
      <h1 className="mt-2 text-4xl">{title}</h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-soft">{o.intro}</p>
      {s && <p className="mt-2 max-w-3xl text-ink-soft">We arrange rides for events across {s.name}, subject to operator availability for your date and site.</p>}

      <section className="mt-10">
        <h2 className="text-2xl">Rides for {o.plural}{s ? ` in ${s.name}` : ""}</h2>
        <p className="mt-1 text-sm text-muted">Often chosen for {o.plural}: {o.suggestedCategories.map(categoryLabel).join(", ")}. Every ride is sourced for your date; nothing is booked until you accept a quote.</p>
        <div className="mt-4">
          <SupplyList cards={suggestedCards} requestHref={requestHref} emptyText={`No ride offerings are published for ${o.plural}${s ? ` in ${s.name}` : ""} yet. Send a request and we will look for an operator.`} />
        </div>
        <SupplySource snap={snap} />
        <PricingNotice className="mt-6" />
      </section>

      {other.length > 0 && (
        <section className="mt-10">
          <h2 className="text-2xl">Other rides you can request{s ? ` in ${s.name}` : ""}</h2>
          <div className="mt-4"><SupplyList cards={otherCards} requestHref={requestHref} emptyText="" /></div>
        </section>
      )}

      <div className="mt-12">
        <RequestCta href={requestHref} title="Planning this event?" body="Tell us the date and city. We count the independent operators with matching equipment and a working contact channel, then Event Access gives you their direct contact details." />
      </div>

      <section className="mt-12">
        <h2 className="text-2xl">Planning notes</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-ink-soft">{group.planningNotes.map((n) => <li key={n}>{n}</li>)}</ul>
      </section>

      {s ? (
        <>
          <LinkGrid title={`Cities in ${s.name}`} links={cities.map((l) => ({ href: paths.city(l.stateSlug, l.citySlug), label: `${l.cityName}, ${l.stateCode}` }))} />
          <LinkGrid title="More in this area" links={[{ href: paths.state(s.slug), label: `All carnival ride rentals in ${s.name}` }, { href: paths.occasion(o.id), label: `Carnival rides for ${o.plural} nationwide` }]} />
          <LinkGrid title={`Related events in ${s.name}`} links={related.map((r) => ({ href: paths.occasionState(r.id, s.slug), label: `Carnival rides for ${r.plural}` }))} />
        </>
      ) : (
        <>
          <LinkGrid title={`Carnival rides for ${o.plural} by state`} links={US_STATES.map((st) => ({ href: paths.occasionState(o.id, st.slug), label: st.name }))} />
          <LinkGrid title="Related events" links={related.map((r) => ({ href: paths.occasion(r.id), label: `Carnival rides for ${r.plural}` }))} />
        </>
      )}

      <FaqSection faq={COMMON_FAQ} />
    </div>
  );
}
