import Link from "next/link";
import { searchOperatorListings } from "@/lib/catalog/operator-search";
import { paths } from "@/lib/seo/routes";
import { STATE_CENTERS } from "@/lib/taxonomy/state-centers";
import { RideResult } from "./RideResult";

/**
 * "Rides near …" on state and city pages: the same nearest-first search as /s (one cached query of
 * the first page, never the whole inventory), from the state's centre. Not part of structured data.
 */
export async function NearbyRides({ stateCode, stateSlug, label, limit = 8 }: { stateCode: string; stateSlug: string; label: string; limit?: number }) {
  const c = STATE_CENTERS[stateCode];
  if (!c) return null;
  const res = await searchOperatorListings({ origin: { lat: c[0], lng: c[1] } });
  if (res.error || res.cards.length === 0) return null;
  return (
    <section className="mt-12" aria-labelledby="nearby-rides">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="nearby-rides" className="text-2xl">Rides from operators near {label}</h2>
          <p className="mt-1 text-sm text-muted">Nearest operator bases first. Distances are to each operator&rsquo;s home base.</p>
        </div>
        <Link href={paths.search({ state: stateSlug })} className="btn-ghost">See all rides near {label}</Link>
      </div>
      <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {res.cards.slice(0, limit).map((card) => (
          <li key={card.id}><RideResult card={card} /></li>
        ))}
      </ul>
    </section>
  );
}
