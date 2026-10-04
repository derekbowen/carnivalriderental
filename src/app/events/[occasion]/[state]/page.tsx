import { notFound } from "next/navigation";
import { OccasionPage, occasionCopy } from "@/components/OccasionPage";
import { getCatalog } from "@/lib/catalog/source";
import { seoMetadata } from "@/lib/seo/metadata";
import { occasionStateGate } from "@/lib/seo/pseo";
import { paths } from "@/lib/seo/routes";
import { occasionById, stateBySlug } from "@/lib/taxonomy";

// 75 occasions × 51 states: rendered on first request, then cached and refreshed (ISR).
export const dynamicParams = true;
export const revalidate = 600;

type P = { occasion: string; state: string };

export function generateStaticParams(): P[] {
  return [];
}

async function resolve(params: Promise<P>) {
  const p = await params;
  return { o: occasionById(p.occasion), s: stateBySlug(p.state) };
}

export async function generateMetadata({ params }: { params: Promise<P> }) {
  const { o, s } = await resolve(params);
  if (!o || !s) return {};
  return seoMetadata({ path: paths.occasionState(o.id, s.slug), ...occasionCopy(o, s), gate: occasionStateGate(o, s, await getCatalog()) });
}

export default async function OccasionStatePage({ params }: { params: Promise<P> }) {
  const { o, s } = await resolve(params);
  if (!o || !s) notFound();
  return <OccasionPage o={o} s={s} snap={await getCatalog()} />;
}
