import Link from "next/link";
import { InventoryTypeGrid } from "@/components/InventoryTypeGrid";
import { Breadcrumbs, categoryLabel, JsonLd } from "@/components/pseo";
import { CTA_BODY, RequestCta } from "@/components/RequestCta";
import { accessPriceCopy } from "@/lib/access/copy";
import { accessProductsForDisplay } from "@/lib/access/runtime";
import { categoryPageById } from "@/lib/content/category-pages";
import { coreHubGate, operatorCount, RIDE_TYPES, RIDES, typeStats } from "@/lib/inventory";
import { seoMetadata } from "@/lib/seo/metadata";
import { paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";

const RIDES_CRUMBS = [{ name: "Home", path: paths.home() }, { name: "Ride types", path: paths.rides() }];
const DESCRIPTION = "Browse carnival ride types backed by real operator inventory, see how many operators list each one, and connect with the independent operators who rent them.";
/** Category order on the page: the hub categories first, then the rest of the taxonomy. */
const CATEGORY_ORDER = ["ferris-wheels", "carousels", "swing-rides", "kiddie-rides", "family-rides", "thrill-rides"];
const fmt = (n: number) => n.toLocaleString("en-US");

// Filtered views (?category=) canonicalise to /rides and are never indexed separately.
export function generateMetadata() {
  return seoMetadata({
    path: paths.rides(),
    title: "Carnival ride rentals",
    description: DESCRIPTION,
    gate: coreHubGate(paths.rides()),
  });
}

/**
 * Ride types, from the operator inventory snapshot: every type shown has real listings behind it,
 * with counts of listings and distinct operators, and links into the filtered ride search. No demo
 * records, no managed-catalog placeholders.
 */
export default async function BrowsePage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const stats = RIDE_TYPES.map(typeStats).filter((t) => t.count > 0);
  const categories = [...CATEGORY_ORDER, ...new Set(stats.map((t) => t.type.categoryId ?? "other"))].filter((id, i, all) => all.indexOf(id) === i).filter((id) => stats.some((t) => (t.type.categoryId ?? "other") === id));
  const label = (id: string) => (id === "other" ? "More ride types" : categoryPageById(id)?.name ?? categoryLabel(id));
  const shownCategories = category && categories.includes(category) ? [category] : categories;
  const pricing = accessPriceCopy(await accessProductsForDisplay());
  const total = RIDES.filter((r) => r.rideType).length;
  const operators = operatorCount(RIDES);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <JsonLd
        nodes={pageGraph({
          path: paths.rides(),
          name: "Carnival ride rentals",
          description: DESCRIPTION,
          type: "CollectionPage",
          service: {},
          crumbs: RIDES_CRUMBS,
        })}
      />
      <Breadcrumbs items={RIDES_CRUMBS} />
      <p className="eyebrow mt-6">Browse rides</p>
      <h1 className="mt-2 text-4xl">Carnival ride rentals</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Ride types with real operator inventory behind them: {fmt(total)} classified listings from {fmt(operators)} independent operators across the country. Pick a type to see the actual rides nearest you. Each operator prices per event for your date and location.
      </p>
      <div className="mt-10 grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside aria-label="Filters" className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold font-sans">Category</h2>
            <ul className="mt-3 space-y-1 text-sm">
              <li><Link href={paths.rides()} className={!category ? "font-semibold" : "text-ink-soft hover:underline"}>All rides</Link></li>
              {categories.map((c) => (
                <li key={c}>
                  <Link href={`${paths.rides()}?category=${c}`} className={category === c ? "font-semibold" : "text-ink-soft hover:underline"}>{label(c)}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-accent-wash p-4 text-xs text-warn">
            <strong>About availability:</strong> a listing shows what an operator owns and where they serve. It is not a confirmation that a unit is free on your date; the operator confirms that.
          </div>
        </aside>
        <div className="space-y-12">
          {shownCategories.map((c) => {
            const items = stats.filter((t) => (t.type.categoryId ?? "other") === c);
            const hub = categoryPageById(c);
            return (
              <section key={c} aria-labelledby={`cat-${c}`} data-testid="ride-category">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <h2 id={`cat-${c}`} className="text-2xl">{label(c)}</h2>
                  {hub && <Link href={paths.category(hub.id)} className="text-sm font-semibold text-accent-strong hover:underline">{hub.name} guide →</Link>}
                </div>
                <div className="mt-4">
                  <InventoryTypeGrid items={items} hrefFor={(id) => paths.search({ rideType: id })} />
                </div>
              </section>
            );
          })}
        </div>
      </div>
      <div className="mt-16">
        <RequestCta href={paths.connect()} title="Planning an event?" body={CTA_BODY} price={pricing.ctaLine} />
      </div>
    </div>
  );
}
