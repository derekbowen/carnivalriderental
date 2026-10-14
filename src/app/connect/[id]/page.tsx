import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alternatives } from "@/components/access/Alternatives";
import { OperatorMatch } from "@/components/access/OperatorMatch";
import { Breadcrumbs, JsonLd } from "@/components/pseo";
import { activeProducts, MATCH_RADIUS_MILES } from "@/lib/access/config";
import { accessDb } from "@/lib/access/db";
import { categoryNoun, requirementNoun, requirementPlural } from "@/lib/access/fallback";
import { accessAvailability } from "@/lib/access/runtime";
import { operatorSource } from "@/lib/access/contacts";
import { ensureFallbacks, fallbackView, getEventRequest, priceLabel, quoteForEvent } from "@/lib/access/service";
import { BRAND } from "@/lib/config";
import { rideTypeFor } from "@/lib/inventory";
import { rideTypeCopy } from "@/lib/inventory/ride-type-copy";
import { canonicalUrl, paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";
import { ProtectedForm } from "@/components/access/ProtectedForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Matching operators | ${BRAND.name}`, robots: { index: false, follow: false } };

/**
 * Step between the event form and payment: the honest match count, then the offer. The product and
 * amount come from quoteForEvent (the stored request's resolved ride requirement → tier → product
 * row), which is exactly what checkout charges. Nothing in the URL or form can change it.
 */
export default async function MatchesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; cancelled?: string; manual?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id) || !accessAvailability().enabled) notFound();
  const db = await accessDb();
  const event = await getEventRequest(db, id);
  if (!event) notFound();
  const { product, sellable, tier, requoted } = await quoteForEvent(db, event);
  if (!sellable && product) await ensureFallbacks(db, operatorSource(), event);
  const fb = await fallbackView(db, id);
  const products = !sellable && fb.offers.length ? await activeProducts(db) : null;
  const n = event.matchedOperators;
  // An alternative the customer picked (fallback.ts): what they originally asked for, and how this differs.
  const origin = fb.origin;
  const asked = origin ? requirementNoun(origin.requestedRideType, origin.requestedRideClass) : null;
  const radius = origin?.offer.kind === "radius" ? origin.offer.radiusMiles : MATCH_RADIUS_MILES;
  const zeroWithOffers = n === 0 && !sellable && fb.offers.length > 0;
  const typeLabel = event.rideType ? rideTypeCopy(event.rideType, rideTypeFor(event.rideType)?.name ?? event.rideType).label.toLowerCase() : event.rideClass ? `${event.rideClass} ride` : "carnival ride";
  const productName = product?.name ?? (tier === "ferris" ? "Ferris Wheel Event Access" : "Event Access");
  const path = `/connect/${id}`;
  const crumbs = [{ name: "Home", path: paths.home() }, { name: "Connect with operators", path: "/connect" }, { name: "Matching operators", path }];
  const unlocks = product ? Math.min(product.unlockLimit, n) : 0;
  const offer = sellable && product
    ? [{
        "@type": "Product",
        "@id": `${canonicalUrl(path)}#product`,
        name: product.name,
        description: product.description,
        brand: { "@type": "Brand", name: BRAND.name },
        offers: { "@type": "Offer", price: (product.priceCents / 100).toFixed(2), priceCurrency: product.currency.toUpperCase(), availability: "https://schema.org/OnlineOnly", url: canonicalUrl(path), seller: { "@type": "Organization", name: BRAND.legalEntity } },
      }]
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <JsonLd nodes={[...pageGraph({ path, name: "Matching operators", description: `Independent carnival operators with ${typeLabel} equipment near ${event.city}, ${event.state}.`, type: "WebPage", crumbs }), ...offer]} />
      <Breadcrumbs items={crumbs} />
      <p className="eyebrow mt-6">{productName} · step 2 of 3</p>
      <h1 className="mt-2 text-4xl" data-testid="match-heading">
        {origin
          ? origin.offer.kind === "radius"
            ? `${n} ${typeLabel} operator${n === 1 ? "" : "s"} within ${radius} miles of ${event.city}, ${event.state}`
            : origin.offer.kind === "category"
              ? `${n} operator${n === 1 ? "" : "s"} with other ${categoryNoun(origin.offer.categoryId)} near ${event.city}, ${event.state}`
              : `${n} operator${n === 1 ? "" : "s"} with ${origin.offer.kind === "alias" ? `rides that may be a ${typeLabel}` : requirementPlural(event.rideType, event.rideClass)} near ${event.city}, ${event.state}`
          : zeroWithOffers
            ? `We didn’t find a ${typeLabel} operator within ${MATCH_RADIUS_MILES} miles of ${event.city}`
            : n === 0
              ? `No direct operator matches yet near ${event.city}, ${event.state}`
              : `${n} direct operator match${n === 1 ? "" : "es"} for your ${typeLabel} request`}
      </h1>
      <p className="mt-3 max-w-2xl text-ink-soft" data-testid="match-summary">
        {event.city}, {event.state} · {event.eventDate}. Operators are independent companies based within {radius} miles with matching equipment and at least one working contact channel. Each company counts once, however many rides it lists. We don&rsquo;t know their calendars, so this is not availability.
      </p>
      {origin && (
        <p role="status" className="mt-4 max-w-2xl rounded-lg border border-line bg-accent-wash px-4 py-3 text-sm" data-testid="alternative-notice" data-kind={origin.offer.kind}>
          <strong>Alternative to your {asked} request, not an exact match.</strong>{" "}
          {origin.offer.kind === "related"
            ? `These operators list ${requirementPlural(event.rideType, event.rideClass)}, not ${requirementPlural(origin.requestedRideType, origin.requestedRideClass)}.`
            : origin.offer.kind === "alias"
              ? `These operators list rides under another name that may be a ${asked}. We haven't confirmed it, so ask the operator before you book.`
              : origin.offer.kind === "category"
                ? `These operators have other ${categoryNoun(origin.offer.categoryId)}; none of them is a ${asked}.`
                : `No ${asked} operator we can connect you with is within ${MATCH_RADIUS_MILES} miles, so this search reaches ${radius} miles. Check travel and delivery costs with the operator.`}{" "}
          <Link className="underline" href={paths.connectMatches(origin.eventRequestId)}>Back to your original request</Link>
        </p>
      )}
      {sp.manual && <p role="status" className="mt-4 rounded-lg border border-line bg-surface px-4 py-3 text-sm">Thanks. We&rsquo;ll search by hand and email you. Nothing was charged.</p>}
      {sp.cancelled && <p role="status" className="mt-4 rounded-lg border border-line bg-surface px-4 py-3 text-sm">Checkout was cancelled. Nothing was charged.</p>}
      {sp.error && <p role="alert" className="mt-4 rounded-lg border border-pop/40 bg-pop/10 px-4 py-3 text-sm">{sp.error === "not_sellable" ? "There aren't enough contactable operators for this request." : sp.error === "alternative_gone" ? "That alternative no longer has enough contactable operators. Pick another, or ask us to search by hand." : sp.error === "unavailable" ? `${productName} isn't available right now. Nothing was charged.` : "Payment couldn't be started. Nothing was charged."}</p>}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {!sellable && product && (
            <Alternatives eventId={event.id} city={event.city} rideType={event.rideType} rideClass={event.rideClass} offers={fb.offers} products={products ?? { standard: null, ferris: null }} manualRequested={fb.manualRequested} />
          )}
          {n > 0 ? (
            <ul className="space-y-4" data-testid="match-list">
              {event.operators.map((op) => <OperatorMatch key={op.operatorId} op={op} />)}
            </ul>
          ) : !product && (
            <div className="card p-6">
              <p className="text-ink-soft">We list {typeLabel} equipment nationwide, but none of it belongs to an operator we can put you in direct contact with near {event.city} yet. Try a wider ride type, or <Link className="underline" href={paths.search()}>browse rides near you</Link>.</p>
            </div>
          )}
        </div>
        <aside className="space-y-4 text-sm">
          {!product ? (
            <div className="card p-6" data-testid="tier-unavailable">
              <h2 className="text-lg">{productName} isn&rsquo;t available right now</h2>
              <p className="mt-2 text-ink-soft">We can&rsquo;t sell {tier === "ferris" ? "Ferris wheel" : "this"} operator access at the moment, and we never substitute a different product or price. Email <a className="font-semibold underline" href={`mailto:support@${BRAND.domain}`}>support@{BRAND.domain}</a> with your event and we&rsquo;ll look by hand, free.</p>
              <Link href="/connect" className="btn-ghost mt-4 w-full">Change the request</Link>
            </div>
          ) : sellable ? (
            <div className="card p-6" data-testid="offer" data-tier={tier}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted" data-testid="offer-product">{product.name}</p>
              <p className="mt-1 font-display text-[34px] leading-tight" data-testid="offer-price">{priceLabel(product)}</p>
              <p className="mt-1 text-xs text-muted">One-time fee for operator contact access{tier === "ferris" ? "; applies to every Ferris wheel request (standard, giant or mini)" : ""}.</p>
              {requoted && (
                <p role="status" className="mt-3 rounded-lg bg-accent-wash px-3 py-2 text-xs text-ink-soft" data-testid="requoted">
                  This request is now priced as {product.name} at {priceLabel(product)}. Any earlier checkout for it at a different amount is no longer valid, and nothing was charged for it.
                </p>
              )}
              <p className="mt-3 text-ink-soft">Unlocks up to <strong>{unlocks}</strong> of these {n} operators for {product.validityDays} days: company name, phone, email and website, revealed one at a time as you choose.</p>
              <ProtectedForm action="/api/access/checkout" className="mt-5">
                <input type="hidden" name="event" value={event.id} />
                <button type="submit" className="btn-primary w-full" data-testid="pay-button">Continue to secure payment · {priceLabel(product)}</button>
              </ProtectedForm>
              <p className="mt-3 text-xs text-muted">Payment of {priceLabel(product)} to {BRAND.legalEntity} via Stripe. The rental itself is agreed and paid directly with the operator; this fee doesn&rsquo;t cover it and doesn&rsquo;t guarantee a booking or a reply. <Link className="underline" href={paths.accessPolicy()}>Refund rules</Link>.</p>
            </div>
          ) : (
            <div className="card p-6" data-testid="not-sellable">
              <h2 className="text-lg">We won&rsquo;t charge for this one</h2>
              <p className="mt-2 text-ink-soft">{n === 0 ? "No" : `Only ${n}`} contactable operator{n === 1 ? "" : "s"} match{n === 1 ? "es" : ""} right now, and we only sell {product.name} with at least {product.minimumMatches}. {fb.offers.length ? "Pick an alternative, or ask us to search by hand, free." : "Ask us to search by hand, free."} Questions: <a className="font-semibold underline" href={`mailto:support@${BRAND.domain}`}>support@{BRAND.domain}</a>.</p>
              <Link href="/connect" className="btn-ghost mt-4 w-full">Change the request</Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
