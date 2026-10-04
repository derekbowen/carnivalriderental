import Link from "next/link";
import { notFound } from "next/navigation";
import { catalog } from "@/lib/catalog";
import { isIndexable } from "@/lib/catalog/publication";
import { breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { paths } from "@/lib/urls";
import { FixtureBanner } from "@/components/Badges";
import { HowItWorks, JsonLd } from "@/components/Marketing";
import { RideDetail } from "@/components/RideDetail";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ state: string; city: string; ride: string }> };

async function load(params: Props["params"]) {
  const { state, city, ride } = await params;
  return catalog.cityRide(state, city, ride);
}

export async function generateMetadata({ params }: Props) {
  const x = await load(params);
  if (!x) return {};
  const where = `${x.city.name}, ${x.city.state.toUpperCase()}`;
  return pageMetadata({
    title: `${x.ride.name} in ${where}`,
    description: `Request a ${x.ride.name.toLowerCase()} for your event in ${where}. We source an operator and send a written quote, subject to availability.`,
    path: paths.cityRide(x.city.state, x.city.slug, x.ride.slug),
    indexable: isIndexable(x.page, x.ride, x.city),
  });
}

export default async function CityRidePage({ params }: Props) {
  const x = await load(params);
  if (!x) notFound();
  const { ride, city, page } = x;
  const fixture = [ride, city, page].some((r) => r.dataset === "fixture");
  return (
    <main>
      {fixture ? <FixtureBanner /> : null}
      <JsonLd
        data={breadcrumbJsonLd([
          { name: `${city.name}, ${city.stateName}`, path: paths.city(city.state, city.slug) },
          { name: ride.name, path: paths.cityRide(city.state, city.slug, ride.slug) },
        ])}
      />
      <div className="container-page pt-6 text-sm text-ink-muted">
        <Link href={paths.city(city.state, city.slug)} className="underline">{city.name}, {city.state.toUpperCase()}</Link>
        {" · "}
        <Link href={paths.ride(ride.slug)} className="underline">{ride.name}</Link>
      </div>
      <RideDetail ride={ride} city={{ ...city, localNotes: [...city.localNotes, ...page.localNotes] }} />
      <HowItWorks />
    </main>
  );
}
