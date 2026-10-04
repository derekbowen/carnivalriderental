# Architecture

## Shape of the system (session one)

One Next.js 15 app (App Router, TypeScript, Tailwind) with:

- **Public pages** server-rendered from structured catalog data (`src/lib/catalog`), not from live API calls per view.
- **Event requests and procurement** in a development SQLite database through Node's built-in `node:sqlite` (`src/lib/db.ts`, `src/lib/requests/*`). One file, no extra service.
- **Internal team area** at `/internal` behind HTTP Basic auth (`src/middleware.ts`, re-checked in every internal route).
- **Marketplace adapter** boundary (`src/lib/marketplace/adapter.ts`), currently the explicitly labelled development adapter.

No microservices, queues, extra databases or paid services.

## Sources of truth

| Data | Source of truth now | Later |
|---|---|---|
| Ride types, categories, cities, ride+city pages | `src/data/production/catalog.ts` (reviewed) and `src/data/fixtures/catalog.ts` (demo) | Same structured data; Sharetribe listings mirror ride offerings |
| Event requests, status history | SQLite `event_requests`, `request_history` | Our backend (Postgres) |
| Suppliers, per-event supplier stages, supplier quotes/costs | SQLite `suppliers`, `request_suppliers`, `supplier_quotes` | Our backend — Sharetribe has no supplier concept and should not get one |
| Customer quotes (versioned) | SQLite `customer_quotes` | Mirrored into the Sharetribe negotiation transaction as offers |
| Payment state | Not connected (`payment_status` stays `not_started`) | Sharetribe + Stripe (test mode first) |

## Sharetribe mapping — what the docs confirm

Checked against official Sharetribe documentation (docs.sharetribe.com / help center) on 2026-10-01:

- **The provider on a transaction is the listing author**, and with payments enabled the provider is "the transaction party who receives the transaction payment". The marketplace operator is *not* a user and cannot be a transaction party.
- Payments use **Stripe Connect Custom accounts with destination charges (`on_behalf_of`)**. Money goes to the provider's connected account; the marketplace receives its commission as an application fee. A listing can't be bought unless its provider has completed Stripe onboarding.
- The **regular price-negotiation process** (`default-negotiation`): customer requests a quote on a listing → provider submits an offer (line items) → customer accepts and pays, or counter-offers. Supported in Console since Nov 2025 and in the Sharetribe Web Template from v10.1.x. Transaction fields can collect structured details on the quote request.
- Negotiation **cannot be combined with availability (bookings) or stock** without custom code. So a negotiation does **not** reserve date-specific equipment.
- In `default-negotiation` the payment is **charged immediately when the customer accepts and pays**, and the transaction auto-cancels with a refund if not marked delivered within **75 days** (Stripe can hold funds up to 90 days).
- Card preauthorizations last **7 days**. Customers can **save one payment card** (SetupIntent), and a custom process can make an **automatic off-session charge** later (example process exists); it can fail and needs a fallback path.
- Sharetribe's docs warn that taking all payments to your own account and paying providers manually raises regulatory, accounting and liability questions and should be cleared with an accountant and lawyer.

## Proposed mapping (to verify — not built)

Our operating company acts as **the seller of record**:

- One **provider user owned by our business**, onboarded to Stripe Connect with the business's own real verification. This is our company selling its own managed service — not a fake account standing in for an operator.
- **Ride offerings are listings authored by that user**, using a regular price-negotiation listing type.
- A customer's event request becomes (or links to) a **quote request transaction**; our final quote is the **offer**; the customer's acceptance and payment run through Sharetribe and Stripe.
- **Operators are suppliers**, paid by our business under supplier terms outside the marketplace transaction. They never need marketplace accounts.

Open questions before building it:

1. Whether Stripe permits the platform's own business to be a Custom connected account on its own platform, and how that interacts with commission (likely 0%) and payouts. **Ask Stripe / Sharetribe support.**
2. Whether this seller-of-record model needs legal and accounting review (Sharetribe's docs recommend it for any "all money to us" flow).
3. Events are often more than 75 days out. Charging on acceptance conflicts with the 75/90-day hold limits, so a **custom process** is likely needed: save a card on acceptance → charge a deposit and/or the balance off-session closer to the event. This is a process design, not a setting.
4. Whether the internal event request should be created *before* any Sharetribe account exists (as now), with the customer creating an account only when accepting a quote.

## Programmatic SEO

Canonical URL families (built only by `src/lib/urls.ts`):

| Family | URL |
|---|---|
| Browse | `/rides` |
| Ride category | `/rides/category/{category}` |
| Ride offering | `/rides/{ride}` |
| City service page | `/locations/{state}/{city}` |
| Ride + city page | `/locations/{state}/{city}/{ride}` |

Rules:

- Lowercase slugs, two-letter state codes, no trailing slash, no query string in canonicals.
- Ride + city pages exist **only for explicitly listed pairs** (`CityRidePage` records) — never a cross-product of rides × cities.
- Publication gates (`src/lib/catalog/publication.ts`): fixtures render only with `SHOW_FIXTURES=on`, are never indexable and never in the sitemap. Production records need `status: "published"` plus reviewer and date. Nothing is indexable unless `SITE_INDEXING=on`.
- Every response carries `X-Robots-Tag: noindex, nofollow` unless `SITE_INDEXING=on`; `robots.txt` disallows all in that case too.
- Pages are rendered from local structured data — no AI calls and no per-view marketplace API calls. When Sharetribe is connected, listing data should be synced into this structured layer on a schedule (bounded), not fetched per page view.
- City pages state that we arrange requests for events there, subject to availability. "Request sourcing for this city" is kept distinct from "verified available equipment in this city" (not modelled yet; would come from verified ride units).
