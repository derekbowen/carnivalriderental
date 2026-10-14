import { notFound } from "next/navigation";
import { CityPage, cityCopy } from "@/components/CityPage";
import { InventoryCityPage, cityCopy as inventoryCityCopy } from "@/components/InventoryPages";
import { cityBySlugs, inventoryCityGate, inventoryMetadata } from "@/lib/inventory";
import { OccasionPage, occasionCopy } from "@/components/OccasionPage";
import { getCatalog } from "@/lib/catalog/source";
import { getContent, getLocation } from "@/lib/content";
import { seoMetadata } from "@/lib/seo/metadata";
import { assertSlugNamespaces } from "@/lib/seo/namespaces";
import { occasionStateGate } from "@/lib/seo/pseo";
import { cityGate } from "@/lib/seo/publication";
import { paths } from "@/lib/seo/routes";
import { occasionById, stateBySlug } from "@/lib/taxonomy";

/**
 * /{state}/{slug}: a city page or an occasion + state page. City slugs and occasion ids
 * never overlap (checked at build). Cities are prerendered; the 75 × 51 occasion pages
 * render on first request and are cached (ISR).
 */
export const dynamicParams = true;
export const revalidate = 600;

type P = { state: string; slug: string };

export function generateStaticParams(): P[] {
  assertSlugNamespaces();
  return getContent().locations.map((l) => ({ state: l.stateSlug, slug: l.citySlug }));
}

async function resolve(params: Promise<P>) {
  const p = await params;
  const state = stateBySlug(p.state);
  if (!state) return null;
  // Real US cities (Census) with live operator inventory come first; demo locations only otherwise.
  const place = cityBySlugs(p.state, p.slug);
  if (place) return { kind: "place" as const, place };
  const city = getLocation(p.state, p.slug);
  if (city) return { kind: "city" as const, city };
  const occasion = occasionById(p.slug);
  if (occasion) return { kind: "occasion" as const, state, occasion };
  return null;
}

export async function generateMetadata({ params }: { params: Promise<P> }) {
  const r = await resolve(params);
  if (!r) return {};
  if (r.kind === "place") return inventoryMetadata({ path: paths.city(r.place.stateSlug, r.place.slug), ...inventoryCityCopy(r.place), gate: inventoryCityGate(r.place) });
  if (r.kind === "city") return seoMetadata({ path: paths.city(r.city.stateSlug, r.city.citySlug), ...cityCopy(r.city), gate: cityGate(r.city) });
  return seoMetadata({ path: paths.occasionState(r.occasion.id, r.state.slug), ...occasionCopy(r.occasion, r.state), gate: occasionStateGate(r.occasion, r.state, await getCatalog()) });
}

export default async function StateSlugPage({ params }: { params: Promise<P> }) {
  const r = await resolve(params);
  if (!r) notFound();
  if (r.kind === "place") return <InventoryCityPage c={r.place} />;
  if (r.kind === "city") return <CityPage l={r.city} />;
  return <OccasionPage o={r.occasion} s={r.state} snap={await getCatalog()} />;
}
