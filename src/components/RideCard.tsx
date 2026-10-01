import Link from "next/link";
import type { RideOffering } from "@/lib/content/types";
import { paths } from "@/lib/seo/routes";
import { AvailabilityBadge, DemoBadge, EstimateLabel } from "./badges";
import { RideImage } from "./RideImage";

export function RideCard({ ride, categoryName }: { ride: RideOffering; categoryName: string }) {
  return (
    <article className="card group flex flex-col overflow-hidden">
      <Link href={paths.ride(ride.slug)} className="block">
        <RideImage image={ride.images[0]} className="aspect-[4/3]" />
      </Link>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">{categoryName}</span>
          {ride.isDemo && <DemoBadge />}
        </div>
        <h3 className="text-xl">
          <Link href={paths.ride(ride.slug)} className="hover:underline">{ride.name}</Link>
        </h3>
        <p className="text-sm text-ink-soft">{ride.summary}</p>
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-line pt-4">
          <EstimateLabel estimate={ride.estimate} compact />
          <AvailabilityBadge />
        </div>
      </div>
    </article>
  );
}
