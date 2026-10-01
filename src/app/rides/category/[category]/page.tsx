import { notFound } from "next/navigation";
import { catalog } from "@/lib/catalog";
import { isIndexable } from "@/lib/catalog/publication";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { paths } from "@/lib/urls";
import { FixtureBanner } from "@/components/Badges";
import { JsonLd, RequestCta, RideCard } from "@/components/Marketing";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Props) {
  const c = catalog.category((await params).category);
  if (!c) return {};
  return pageMetadata({ title: `${c.name} for rent`, description: c.summary, path: paths.category(c.slug), indexable: isIndexable(c) });
}

export default async function CategoryPage({ params }: Props) {
  const c = catalog.category((await params).category);
  if (!c) notFound();
  const rides = catalog.ridesInCategory(c.slug);
  return (
    <main>
      {c.dataset === "fixture" ? <FixtureBanner /> : null}
      <JsonLd data={breadcrumbJsonLd([{ name: "Rides", path: paths.rides() }, { name: c.name, path: paths.category(c.slug) }])} />
      <div className="container-page py-12">
        <p className="eyebrow">Ride category</p>
        <h1 className="mt-2 font-display text-4xl">{c.name} for rent</h1>
        <p className="mt-3 max-w-2xl text-ink-muted">{c.summary}</p>
        {rides.length ? (
          <div className="mt-8 grid gap-6 md:grid-cols-3">{rides.map((r) => <RideCard key={r.slug} ride={r} />)}</div>
        ) : (
          <div className="card mt-8 p-8 text-center text-sm text-ink-muted">No ride pages in this category yet — we can still source one for your event.</div>
        )}
      </div>
      <RequestCta />
    </main>
  );
}
