import { notFound } from "next/navigation";
import { CategoryHub } from "@/components/CategoryHub";
import { cardFromCatalog, cardFromFixture } from "@/lib/catalog/card";
import { getCatalog } from "@/lib/catalog/source";
import { getContent } from "@/lib/content";
import { categoryPageById } from "@/lib/content/category-pages";
import { seoMetadata } from "@/lib/seo/metadata";
import { categoryHubGate } from "@/lib/seo/pseo";
import { paths } from "@/lib/seo/routes";

/**
 * Category hubs: one template, five pilot configs. Supply = live catalog; fixtures only outside production.
 * Rendered on first request, then cached and refreshed every 10 minutes (ISR), so supply is never
 * frozen at build time. Unknown ids 404.
 */
export const dynamicParams = true;
export const revalidate = 600;

type P = { category: string };

export function generateStaticParams(): P[] {
  return [];
}

export async function generateMetadata({ params }: { params: Promise<P> }) {
  const page = categoryPageById((await params).category);
  if (!page) return {};
  return seoMetadata({ path: paths.category(page.id), title: page.metaTitle, description: page.metaDescription, gate: categoryHubGate(page, await getCatalog()) });
}

export default async function CategoryPage({ params }: { params: Promise<P> }) {
  const page = categoryPageById((await params).category);
  if (!page) notFound();
  const snap = await getCatalog();
  const content = getContent(); // demo fixtures are only present outside production
  return (
    <CategoryHub
      page={page}
      snap={snap}
      catalogCards={snap.records.filter((r) => r.categoryId === page.id).map((r) => cardFromCatalog(r))}
      fixtureCards={content.rides.filter((r) => r.categorySlug === page.id && r.isDemo).map(cardFromFixture)}
      cities={content.locations}
    />
  );
}
