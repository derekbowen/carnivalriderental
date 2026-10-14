import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs, JsonLd } from "@/components/pseo";
import { directoryGate, inventoryMetadata, PSEO_INVENTORY } from "@/lib/inventory";
import { directoryForState } from "@/lib/seo/directory";
import { paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";
import { stateBySlug, US_STATES } from "@/lib/taxonomy";
import { DirList } from "@/components/DirList";

type P = { state: string };
export const dynamicParams = false;
export function generateStaticParams(): P[] {
  return US_STATES.map((s) => ({ state: s.slug }));
}

const copy = (name: string) => ({ title: `${name} directory`, description: `Every carnival ride rental page for ${name}: cities, ride types near each city, and ride listings from operators based in ${name}.` });

export async function generateMetadata({ params }: { params: Promise<P> }) {
  const st = stateBySlug((await params).state);
  if (!st) return {};
  return inventoryMetadata({ path: paths.directoryState(st.slug), ...copy(st.name), gate: directoryGate() });
}

export default async function StateDirectoryPage({ params }: { params: Promise<P> }) {
  const st = stateBySlug((await params).state);
  if (!st) notFound();
  const { cities, rides } = directoryForState(st);
  const path = paths.directoryState(st.slug);
  const crumbs = [{ name: "Home", path: paths.home() }, { name: "Directory", path: paths.directory() }, { name: st.name, path }];
  const { title, description } = copy(st.name);
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd nodes={pageGraph({ path, name: title, description, type: "CollectionPage", crumbs })} />
      <Breadcrumbs items={crumbs} />
      <h1 className="mt-6 text-4xl">{st.name} directory</h1>
      <p className="mt-3 max-w-3xl text-ink-soft">
        Every carnival ride rental page for {st.name}. Start with the <Link href={paths.state(st.slug)} className="text-accent-strong hover:underline">{st.name} page</Link>, or go straight to a city.
      </p>

      <section className="mt-10" aria-labelledby="dir-cities">
        <h2 id="dir-cities" className="text-2xl">Cities in {st.name}</h2>
        {cities.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">We don&rsquo;t list operators near {st.name} cities yet. <Link href={paths.search()} className="text-accent-strong hover:underline">Search all rides</Link> or check back as the inventory grows.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">Ride listings from operators based within {PSEO_INVENTORY.radiusMiles} miles of each city, with ride-type pages where there are enough listings.</p>
            <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {cities.map((c) => (
                <li key={c.href} className="text-sm">
                  <Link href={c.href} className="font-semibold text-accent-strong hover:underline">Carnival rides near {c.label}</Link>
                  <span className="ml-1 text-muted">({c.count?.toLocaleString("en-US")})</span>
                  {c.rideTypes.length > 0 && (
                    <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
                      {c.rideTypes.map((t) => <li key={t.href}><Link href={t.href} className="text-ink-soft hover:text-ink hover:underline">{t.label} ({t.count})</Link></li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {rides.length > 0 && (
        <section className="mt-12" aria-labelledby="dir-rides">
          <h2 id="dir-rides" className="text-2xl">Ride listings from operators based in {st.name}</h2>
          <p className="mt-1 text-sm text-muted">{rides.length.toLocaleString("en-US")} listings. Pricing is by quote; a request is not a booking.</p>
          <DirList links={rides} cols="sm:grid-cols-2 lg:grid-cols-3" />
        </section>
      )}

      <p className="mt-12 text-sm"><Link href={paths.directory()} className="text-accent-strong hover:underline">← All states</Link></p>
    </div>
  );
}
