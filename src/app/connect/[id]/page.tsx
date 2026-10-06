import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OperatorMatch } from "@/components/access/OperatorMatch";
import { Breadcrumbs, JsonLd } from "@/components/pseo";
import { rowToProduct } from "@/lib/access/config";
import { accessDb } from "@/lib/access/db";
import { accessAvailability } from "@/lib/access/runtime";
import { getEventRequest, priceLabel } from "@/lib/access/service";
import { BRAND } from "@/lib/config";
import { rideTypeFor } from "@/lib/inventory";
import { rideTypeCopy } from "@/lib/inventory/ride-type-copy";
import { canonicalUrl, paths } from "@/lib/seo/routes";
import { pageGraph } from "@/lib/seo/structured-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Matching operators | ${BRAND.name}`, robots: { index: false, follow: false } };

/** Step between the event form and payment: the honest match count, then the offer. */
export default async function MatchesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; cancelled?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id) || !accessAvailability().enabled) notFound();
  const db = await accessDb();
  const event = await getEventRequest(db, id);
  if (!event) notFound();
  const product = (await db.query(`SELECT * FROM access_products WHERE id = ?`, [event.productId])).map(rowToProduct)[0];
  if (!product) notFound();
  const n = event.matchedOperators;
  const sellable = event.status === "matched" && n >= product.minimumMatches;
  const typeLabel = event.rideType ? rideTypeCopy(event.rideType, rideTypeFor(event.rideType)?.name ?? event.rideType).label.toLowerCase() : event.rideClass ? `${event.rideClass} ride` : "carnival ride";
  const path = `/connect/${id}`;
  const crumbs = [{ name: "Home", path: paths.home() }, { name: "Connect with operators", path: "/connect" }, { name: "Matching operators", path }];
  const unlocks = Math.min(product.unlockLimit, n);
  const offer = sellable
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
      <p className="eyebrow mt-6">Event Access · step 2 of 3</p>
      <h1 className="mt-2 text-4xl" data-testid="match-heading">
        {n === 0 ? `No direct operator matches yet near ${event.city}, ${event.state}` : `${n} direct operator match${n === 1 ? "" : "es"} for your ${typeLabel} request`}
      </h1>
      <p className="mt-3 max-w-2xl text-ink-soft" data-testid="match-summary">
        {event.city}, {event.state} · {event.eventDate}. Operators are independent companies based within {200} miles with matching equipment and at least one working contact channel. Each company counts once, however many rides it lists. We don&rsquo;t know their calendars, so this is not availability.
      </p>
      {sp.cancelled && <p role="status" className="mt-4 rounded-lg border border-line bg-surface px-4 py-3 text-sm">Checkout was cancelled. Nothing was charged.</p>}
      {sp.error && <p role="alert" className="mt-4 rounded-lg border border-pop/40 bg-pop/10 px-4 py-3 text-sm">{sp.error === "not_sellable" ? "There aren't enough contactable operators for this request." : "Payment couldn't be started. Nothing was charged."}</p>}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div>
          {n > 0 ? (
            <ul className="space-y-4" data-testid="match-list">
              {event.operators.map((op) => <OperatorMatch key={op.operatorId} op={op} />)}
            </ul>
          ) : (
            <div className="card p-6">
              <p className="text-ink-soft">We list {typeLabel} equipment nationwide, but none of it belongs to an operator we can put you in direct contact with near {event.city} yet. Try a wider ride type, or <Link className="underline" href={paths.search()}>browse rides near you</Link>.</p>
            </div>
          )}
        </div>
        <aside className="space-y-4 text-sm">
          {sellable ? (
            <div className="card p-6" data-testid="offer">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{product.name}</p>
              <p className="mt-1 font-display text-[34px] leading-tight" data-testid="offer-price">{priceLabel(product)}</p>
              <p className="mt-2 text-ink-soft">Unlocks up to <strong>{unlocks}</strong> of these {n} operators for {product.validityDays} days: company name, phone, email and website, revealed one at a time as you choose.</p>
              <form method="post" action="/api/access/checkout" className="mt-5">
                <input type="hidden" name="event" value={event.id} />
                <button type="submit" className="btn-primary w-full" data-testid="pay-button">Continue to secure payment</button>
              </form>
              <p className="mt-3 text-xs text-muted">Payment to {BRAND.legalEntity} via Stripe. The rental itself is agreed and paid directly with the operator; this fee doesn&rsquo;t cover it and doesn&rsquo;t guarantee a booking or a reply. <Link className="underline" href={paths.accessPolicy()}>Refund rules</Link>.</p>
            </div>
          ) : (
            <div className="card p-6" data-testid="not-sellable">
              <h2 className="text-lg">We won&rsquo;t charge for this one</h2>
              <p className="mt-2 text-ink-soft">{n === 0 ? "No" : `Only ${n}`} contactable operator{n === 1 ? "" : "s"} match{n === 1 ? "es" : ""} right now, and we only sell {product.name} with at least {product.minimumMatches}. Email <a className="font-semibold underline" href={`mailto:support@${BRAND.domain}`}>support@{BRAND.domain}</a> with your event and we&rsquo;ll look by hand, free.</p>
              <Link href="/connect" className="btn-ghost mt-4 w-full">Change the request</Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
