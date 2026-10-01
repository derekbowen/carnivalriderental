import { notFound } from "next/navigation";
import { RequestCta } from "@/components/RequestCta";
import { RideCard } from "@/components/RideCard";
import { DemoBadge } from "@/components/badges";
import { getCategory, getContent } from "@/lib/content";
import { seoMetadata } from "@/lib/seo/metadata";
import { categoryGate } from "@/lib/seo/publication";
import { paths } from "@/lib/seo/routes";

export const dynamicParams = false;
export const revalidate = 3600;

export function generateStaticParams() {
  return getContent().categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const c = getCategory((await params).category);
  if (!c) return {};
  return seoMetadata({ path: paths.category(c.slug), title: `${c.name} for rent`, description: c.summary, gate: categoryGate(c) });
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const c = getCategory((await params).category);
  if (!c) notFound();
  const rides = getContent().rides.filter((r) => r.categorySlug === c.slug);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Ride category</p>
      <div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-4xl">{c.name}</h1>{c.isDemo && <DemoBadge />}</div>
      <p className="mt-3 max-w-2xl text-lg text-ink-soft">{c.summary}</p>
      <p className="mt-4 max-w-2xl text-ink-soft">{c.description}</p>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {rides.map((r) => <RideCard key={r.slug} ride={r} categoryName={c.name} />)}
      </div>
      {rides.length === 0 && <p className="mt-6 text-ink-soft">No offerings in this category yet — you can still request one.</p>}
      <div className="mt-16"><RequestCta href={paths.request()} title={`Looking for ${c.name.toLowerCase()}?`} body="Tell us about your event and we will source suitable equipment and an operating crew." /></div>
    </div>
  );
}
