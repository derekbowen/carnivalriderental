import { ImageOffIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";
import { marketplaceListingUrl, type OperatorCard } from "@/lib/catalog/operator-search";
import { REQUEST_A_QUOTE } from "@/lib/pricing/public-price";
import { paths } from "@/lib/seo/routes";

/**
 * One operator ride in browse results (homepage, /s, state, city and ride-type pages). Account
 * status and request routing are disclosed on the ride page and the request form, not on every card.
 */
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
        {(card.homeState || card.miles !== null) && (
          <p className="mt-1 flex items-center gap-1 text-sm text-ink-soft">
            <MapPinIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {[card.miles !== null ? `Operator ~${card.miles.toLocaleString("en-US")} mi away` : null, card.homeState ? `based in ${card.homeState}` : null].filter(Boolean).join(", ")}
          </p>
        )}
        <div className="mt-auto pt-4">
          <p className="text-sm font-semibold">{card.price ?? REQUEST_A_QUOTE}</p>
          {card.bookable ? (
            <a href={marketplaceListingUrl(card)} className="btn-primary mt-3 w-full">Book this ride</a>
          ) : (
            <Link href={paths.requestRide(card.id)} className="btn-primary mt-3 w-full">Request a quote</Link>
          )}
          <Link href={paths.rideListing(card.id)} className="mt-2 inline-flex min-h-11 w-full items-center justify-center text-sm font-semibold text-accent-strong hover:underline">View ride details</Link>
        </div>
      </div>
    </article>
  );
}
