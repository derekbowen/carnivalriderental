import { catalog } from "@/lib/catalog";
import { pageMetadata } from "@/lib/seo";
import { indexingEnabled } from "@/lib/site";
import { paths } from "@/lib/urls";
import { FixtureBanner } from "@/components/Badges";
import { RequestCta, RideCard } from "@/components/Marketing";
import Link from "next/link";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return pageMetadata({
    title: "Carnival ride rentals",
    description: "Browse carnival ride rentals we source for events. Prices shown are estimates until you accept a written quote.",
    path: paths.rides(),
    indexable: indexingEnabled(),
  });
}

export default async function Rides({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const categories = catalog.categories();
  const rides = category ? catalog.ridesInCategory(category) : catalog.rides();
  return (
    <main>
      {rides.some((r) => r.dataset === "fixture") ? <FixtureBanner /> : null}
      <div className="container-page py-12">
        <h1 className="font-display text-4xl">Carnival ride rentals</h1>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Every ride is sourced for your date from an established operator. Prices here are estimates; your price is set
          in a written quote after sourcing.
        </p>
        <div className="mt-6 flex flex-wrap gap-2" aria-label="Filter by category">
          <Link href={paths.rides()} className={`rounded-full border px-4 py-1.5 text-sm ${!category ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`${paths.rides()}?category=${c.slug}`}
              className={`rounded-full border px-4 py-1.5 text-sm ${category === c.slug ? "border-ink bg-ink text-white" : "border-line bg-white"}`}
            >
              {c.name}
            </Link>
          ))}
        </div>
        {rides.length ? (
          <div className="mt-8 grid gap-6 md:grid-cols-3">{rides.map((r) => <RideCard key={r.slug} ride={r} />)}</div>
        ) : (
          <div className="card mt-8 p-8 text-center">
            <div className="font-semibold">No ride pages here yet</div>
            <p className="mt-1 text-sm text-ink-muted">We can still source rides in this category. Send us your event details.</p>
          </div>
        )}
      </div>
      <RequestCta />
    </main>
  );
}
