import Link from "next/link";
import type { RideOffering } from "@/lib/content/types";
import { paths } from "@/lib/seo/routes";
import { AvailabilityBadge, DemoBadge, EstimateLabel } from "./badges";
import { RideImage } from "./RideImage";

export function RideCard({ ride, categoryName }: { ride: RideOffering; categoryName: string }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-[0_8px_24px_-12px_rgba(11,27,63,0.25)]">
      <div className="relative">
        <RideImage image={ride.images[0]} className="aspect-[4/3] w-full" label={ride.name} />
        <AvailabilityBadge className="absolute left-3 top-3" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold text-muted">{categoryName}</p>
          {ride.isDemo && <DemoBadge />}
        </div>
        <h3 className="mt-1 text-[22px] leading-tight">
          <Link href={paths.ride(ride.slug)} className="after:absolute after:inset-0">{ride.name}</Link>
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">{ride.summary}</p>
        <div className="mt-auto border-t border-line pt-4">
          <EstimateLabel estimate={ride.estimate} />
        </div>
      </div>
    </article>
  );
}
