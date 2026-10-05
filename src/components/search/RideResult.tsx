import { ImageOffIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";
import { marketplaceListingUrl, type OperatorCard } from "@/lib/catalog/operator-search";
import { paths } from "@/lib/seo/routes";

/** One operator ride in search results (/s, state and city pages). */
export function RideResult({ card }: { card: OperatorCard }) {
  return (
    <article data-testid="ride-result" className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="aspect-[4/3] w-full overflow-hidden bg-placeholder">
        {card.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.photo.src} alt={card.photo.alt} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div role="img" aria-label="No photo yet" className="flex h-full w-full flex-col items-center justify-center gap-1 text-ink-soft">
            <ImageOffIcon className="h-6 w-6 opacity-60" aria-hidden="true" />
            <span className="text-xs">No photo yet</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        {card.rideClassLabel && <p className="text-xs font-semibold text-muted">{card.rideClassLabel}</p>}
        <h2 className="mt-1 text-xl leading-tight">{card.title}</h2>
        {card.company && <p className="mt-1 text-sm text-ink-soft">{card.company}</p>}
        {(card.base || card.miles !== null) && (
          <p className="mt-1 flex items-center gap-1 text-sm text-ink-soft">
            <MapPinIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {[card.base ? `Based in ${card.base}` : null, card.miles !== null ? `~${card.miles.toLocaleString("en-US")} mi away` : null].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="mt-auto pt-4">
          <p className="text-sm font-semibold">{card.estimate ?? "Request a quote"}</p>
          {!card.claimed && <p className="mt-1 text-xs text-muted">Operator not yet on Carnival Ride Rental: requests go to our request desk.</p>}
          {card.bookable ? (
            <a href={marketplaceListingUrl(card)} className="btn-primary mt-3 w-full">Book this ride</a>
          ) : (
            <Link href={paths.requestRide(card.id)} className="btn-primary mt-3 w-full">Request this ride</Link>
          )}
          {card.detailsReady && <a href={marketplaceListingUrl(card)} className="mt-2 inline-flex min-h-11 w-full items-center justify-center text-sm font-semibold text-accent-strong hover:underline">View ride details</a>}
        </div>
      </div>
    </article>
  );
}
