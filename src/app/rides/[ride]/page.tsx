import Link from "next/link";
import { notFound } from "next/navigation";
import { catalog } from "@/lib/catalog";
import { isIndexable } from "@/lib/catalog/publication";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { paths } from "@/lib/urls";
import { FixtureBanner } from "@/components/Badges";
import { JsonLd, HowItWorks } from "@/components/Marketing";
import { RideDetail } from "@/components/RideDetail";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ ride: string }> };

export async function generateMetadata({ params }: Props) {
  const ride = catalog.ride((await params).ride);
  if (!ride) return {};
  return pageMetadata({ title: ride.name, description: ride.summary, path: paths.ride(ride.slug), indexable: isIndexable(ride) });
}

export default async function RidePage({ params }: Props) {
  const ride = catalog.ride((await params).ride);
  if (!ride) notFound();
  const category = catalog.category(ride.category);
  const cityPages = catalog.cities().flatMap((c) => {
    const pair = catalog.cityRide(c.state, c.slug, ride.slug);
    return pair ? [pair.city] : [];
  });
  return (
    <main>
      {ride.dataset === "fixture" ? <FixtureBanner /> : null}
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Rides", path: paths.rides() },
          ...(category ? [{ name: category.name, path: paths.category(category.slug) }] : []),
          { name: ride.name, path: paths.ride(ride.slug) },
        ])}
      />
      <RideDetail ride={ride} />
      {cityPages.length ? (
        <section className="container-page">
          <h2 className="font-display text-2xl">{ride.name} by location</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {cityPages.map((c) => (
              <li key={`${c.state}-${c.slug}`}>
                <Link className="rounded-full border border-line bg-white px-4 py-1.5 text-sm hover:border-ink" href={paths.cityRide(c.state, c.slug, ride.slug)}>
                  {c.name}, {c.state.toUpperCase()}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <HowItWorks />
    </main>
  );
}
