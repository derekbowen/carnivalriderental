import { notFound } from "next/navigation";
import { CategoryHub } from "@/components/CategoryHub";
import { accessPriceCopy } from "@/lib/access/copy";
import { CATEGORY_CONTEXT } from "@/lib/access/pricing";
import { accessProductsForDisplay } from "@/lib/access/runtime";
import { cardFromCatalog } from "@/lib/catalog/card";
import { getCatalog } from "@/lib/catalog/source";
import { categoryPageById } from "@/lib/content/category-pages";
import { ridesForCategory, rideTypesInCategory, toCard, typeStats } from "@/lib/inventory";
import { seoMetadata } from "@/lib/seo/metadata";
import { categoryHubGate } from "@/lib/seo/pseo";
import { paths } from "@/lib/seo/routes";

/**
 * Category hubs: one template, five pilot configs. Supply = the operator inventory snapshot (real
 * listings) plus any managed-catalog offerings; never demo fixtures.
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
  const pricing = accessPriceCopy(await accessProductsForDisplay(), CATEGORY_CONTEXT[page.id]?.rideType ?? null);
  return (
    <CategoryHub
      page={page}
      snap={snap}
      pricing={pricing}
      catalogCards={snap.records.filter((r) => r.categoryId === page.id).map((r) => cardFromCatalog(r))}
      inventory={ridesForCategory(page.id, 12).map(toCard)}
      inventoryTypes={rideTypesInCategory(page.id).map(typeStats)}
    />
  );
}
