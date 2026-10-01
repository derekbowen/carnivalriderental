import Link from "next/link";
import { RideCard } from "@/components/RideCard";
import { getContent } from "@/lib/content";
import { seoMetadata } from "@/lib/seo/metadata";
import { paths } from "@/lib/seo/routes";

// Filtered views (?category=) canonicalise to /rides and are never indexed separately.
export function generateMetadata() {
  return seoMetadata({
    path: paths.rides(),
    title: "Carnival ride rentals",
    description: "Browse carnival ride rental offerings and request one for your event.",
    gate: { indexable: false, reasons: ["browse page indexing decided with first published offerings"] },
  });
}

export default async function BrowsePage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const { category } = await searchParams;
  const { rides, categories } = getContent();
  const shown = category ? rides.filter((r) => r.categorySlug === category) : rides;
  const catName = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? "";
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Browse rides</p>
      <h1 className="mt-2 text-4xl">Carnival ride rentals</h1>
      <p className="mt-3 max-w-2xl text-ink-soft">
        Every ride is sourced for your specific event. Prices shown are planning estimates where we have them — your price is the written quote you accept.
      </p>
      <div className="mt-10 grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside aria-label="Filters" className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold font-sans">Category</h2>
            <ul className="mt-3 space-y-1 text-sm">
              <li><Link href={paths.rides()} className={!category ? "font-semibold" : "text-ink-soft hover:underline"}>All rides</Link></li>
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link href={`${paths.rides()}?category=${c.slug}`} className={category === c.slug ? "font-semibold" : "text-ink-soft hover:underline"}>{c.name}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-accent-wash p-4 text-xs text-warn">
            <strong>About availability:</strong> “Sourcing on request” means we will look for equipment for your dates. It is not a confirmation that a unit is available.
          </div>
        </aside>
        <div>
          {shown.length === 0 ? (
            <div className="card p-10 text-center">
              <h2 className="text-xl">No ride offerings in this category yet</h2>
              <p className="mt-2 text-sm text-ink-soft">You can still tell us what you need and we will try to source it.</p>
              <Link href={paths.request()} className="btn-primary mt-6">Start an event request</Link>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {shown.map((r) => <RideCard key={r.slug} ride={r} categoryName={catName(r.categorySlug)} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
