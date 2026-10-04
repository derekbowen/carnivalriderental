import { Breadcrumbs, JsonLd, LinkGrid } from "@/components/pseo";
import { seoMetadata } from "@/lib/seo/metadata";
import { paths } from "@/lib/seo/routes";
import { breadcrumbs, webPage } from "@/lib/seo/structured-data";
import { OCCASION_GROUPS, OCCASIONS } from "@/lib/taxonomy";

export const revalidate = 3600;

const title = "Carnival ride rentals for every kind of event";

/** Index of occasion hubs. A navigation page: it is never in the sitemap and stays noindex. */
export const metadata = seoMetadata({
  path: paths.occasions(),
  title,
  description: "Carnival ride rentals for birthdays, bar and bat mitzvahs, weddings, school carnivals, company picnics, festivals and more.",
  gate: { indexable: false, reasons: ["navigation index"] },
});

export default function EventsIndex() {
  const crumbs = [{ name: "Home", path: paths.home() }, { name: "Events", path: paths.occasions() }];
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd nodes={[webPage({ path: paths.occasions(), name: title, description: "Carnival ride rentals by event type.", type: "WebPage" }), breadcrumbs(crumbs)]} />
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-6 text-4xl">{title}</h1>
      {OCCASION_GROUPS.map((g) => (
        <LinkGrid key={g.id} title={g.name} links={OCCASIONS.filter((o) => o.group === g.id).map((o) => ({ href: paths.occasion(o.id), label: `Carnival rides for ${o.plural}` }))} />
      ))}
    </div>
  );
}
