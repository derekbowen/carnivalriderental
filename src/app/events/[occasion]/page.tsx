import { notFound } from "next/navigation";
import { OccasionPage, occasionCopy } from "@/components/OccasionPage";
import { getCatalog } from "@/lib/catalog/source";
import { seoMetadata } from "@/lib/seo/metadata";
import { occasionGate } from "@/lib/seo/pseo";
import { paths } from "@/lib/seo/routes";
import { occasionById, OCCASIONS } from "@/lib/taxonomy";

export const dynamicParams = false;
export const revalidate = 600;

type P = { occasion: string };

export function generateStaticParams(): P[] {
  return OCCASIONS.map((o) => ({ occasion: o.id }));
}

export async function generateMetadata({ params }: { params: Promise<P> }) {
  const o = occasionById((await params).occasion);
  if (!o) return {};
  return seoMetadata({ path: paths.occasion(o.id), ...occasionCopy(o), gate: occasionGate(o, await getCatalog()) });
}

export default async function OccasionHub({ params }: { params: Promise<P> }) {
  const o = occasionById((await params).occasion);
  if (!o) notFound();
  return <OccasionPage o={o} snap={await getCatalog()} />;
}
