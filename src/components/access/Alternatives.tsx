import { ProtectedForm } from "@/components/access/ProtectedForm";
import type { AccessProducts } from "@/lib/access/config";
import { categoryNoun, requirementNoun, requirementPlural, type FallbackOffer } from "@/lib/access/fallback";
import { priceLabel } from "@/lib/access/service";
import { rideTypeFor } from "@/lib/inventory";
import { rideTypeCopy } from "@/lib/inventory/ride-type-copy";

const plural = (rideType: string) => rideTypeCopy(rideType, rideTypeFor(rideType)?.name ?? rideType).many;
const ops = (n: number) => `${n} operator${n === 1 ? "" : "s"}`;

/** One sentence per offer, explicit that it is an alternative and not the ride that was asked for. */
export function offerSentence(o: FallbackOffer, requested: string, requestedPlural: string): string {
  switch (o.kind) {
    case "related":
      return `${ops(o.operators)} with ${plural(o.rideType!)} nearby, including options as close as ${o.nearestMiles} miles away. These are ${plural(o.rideType!)}, not ${requestedPlural}.`;
    case "alias":
      return `${ops(o.operators)} listing rides under another name that may be a ${requested}, as close as ${o.nearestMiles} miles away. We haven't confirmed they are ${requestedPlural}.`;
    case "category":
      return `${ops(o.operators)} with other ${categoryNoun(o.categoryId)} nearby, as close as ${o.nearestMiles} miles away. None of them is a ${requested}.`;
    case "radius":
      return `${ops(o.operators)} with a ${requested} within ${o.radiusMiles} miles, the nearest ${o.nearestMiles} miles away. That's beyond our usual search, so check travel and delivery costs with the operator.`;
  }
}

function offerButton(o: FallbackOffer, requested: string): string {
  switch (o.kind) {
    case "related":
      return `See the ${o.operators} nearby ${rideTypeCopy(o.rideType!, rideTypeFor(o.rideType!)?.name ?? o.rideType!).one} options`;
    case "alias":
      return `See ${ops(o.operators)} with similar-named rides`;
    case "category":
      return `See ${ops(o.operators)} with other ${categoryNoun(o.categoryId)}`;
    case "radius":
      return `Expand the search to ${o.radiusMiles} miles (${ops(o.operators)})`;
  }
}

/**
 * Zero-match fallback (src/lib/access/fallback.ts): the viable alternatives for a request we can't
 * sell, then the free manual search. Each button creates a new request priced by its own ride
 * requirement; the price shown here comes from the same product rows checkout uses.
 */
export function Alternatives({ eventId, city, rideType, rideClass, offers, products, manualRequested }: { eventId: string; city: string; rideType: string | null; rideClass: string | null; offers: FallbackOffer[]; products: AccessProducts; manualRequested: boolean }) {
  const requested = requirementNoun(rideType, rideClass);
  const requestedPlural = requirementPlural(rideType, rideClass);
  const best = offers[0];
  return (
    <div className="card p-6" data-testid="alternatives">
      {best ? (
        <>
          <p className="text-ink-soft" data-testid="alternatives-intro">
            However, we found {offerSentence(best, requested, requestedPlural)}
          </p>
          <p className="mt-4 font-semibold">Would you like to:</p>
          <ul className="mt-3 space-y-3">
            {offers.map((o, i) => {
              const product = products[o.tier];
              return (
                <li key={`${o.kind}-${o.rideType ?? o.categoryId ?? ""}-${o.radiusMiles}`}>
                  <ProtectedForm action="/api/access/alternative">
                    <input type="hidden" name="event" value={eventId} />
                    <input type="hidden" name="offer" value={i} />
                    <button type="submit" className="btn-ghost w-full justify-between text-left" data-testid={`alternative-${o.kind}`}>
                      <span>{offerButton(o, requested)}</span>
                    </button>
                  </ProtectedForm>
                  <p className="mt-1 text-xs text-muted">
                    {i === 0 ? "Alternative, not an exact match." : offerSentence(o, requested, requestedPlural)} {product ? `${product.name}, ${priceLabel(product)}, shown before payment.` : ""}
                  </p>
                </li>
              );
            })}
            <li>{manual(eventId, requested, city, manualRequested)}</li>
          </ul>
        </>
      ) : (
        <>
          <p className="text-ink-soft">We list {requested} equipment nationwide, but none of it belongs to an operator we can put you in direct contact with near {city} yet, and no close alternative has enough operators either.</p>
          <div className="mt-4">{manual(eventId, requested, city, manualRequested)}</div>
        </>
      )}
    </div>
  );
}

function manual(eventId: string, requested: string, city: string, requestedAlready: boolean) {
  if (requestedAlready) {
    return (
      <p role="status" className="rounded-lg bg-accent-wash px-4 py-3 text-sm" data-testid="manual-requested">
        Manual search requested. We&rsquo;ll look by hand for a {requested} near {city} and email you at the address you gave us. It&rsquo;s free.
      </p>
    );
  }
  return (
    <>
      <ProtectedForm action="/api/access/manual-search">
        <input type="hidden" name="event" value={eventId} />
        <button type="submit" className="btn-ghost w-full text-left" data-testid="manual-search">
          Have us manually search for a {requested}
        </button>
      </ProtectedForm>
      <p className="mt-1 text-xs text-muted">Free. We look by hand and email you; no payment needed.</p>
    </>
  );
}
