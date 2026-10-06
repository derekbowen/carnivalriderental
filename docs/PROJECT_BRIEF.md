# Project brief: Carnival Ride Rental (carnivalriderental.us)

Owner and operator: **10000 Solutions LLC** (founder Derek Bowen). This repository is separate from Pool Rental Near Me and must never touch PRNM code, infrastructure, its Sharetribe marketplace, its Stripe account or any other business.

## The business model (founder decision 2026-10-06; this supersedes every earlier model)

**Carnival Ride Rental is a national carnival ride discovery and operator-access platform.**

Independent carnival operators manage or claim their own inventory. Visitors browse ride inventory, photos, specifications, service areas, city, state and event information for free. Customers may purchase **Event Access**: direct contact information for matching independent carnival operators. Carnival Ride Rental keeps the access fee. Operators do not receive rental payments through Carnival Ride Rental. Pricing, scheduling, availability, contracts, insurance requirements and payment for the actual carnival rental are handled directly between the customer and the operator.

What we sell is **access and discovery**, not the ride rental. The public internet problem we solve: carnival ride inventory is fragmented across hundreds of small operators, poor websites, PDFs, Facebook pages and outdated directories. We aggregate and normalise it.

The funnel is **Find → Evaluate → Connect**:

1. A visitor lands on a ride, city, city × ride, state, event or directory page from Google, or searches `/s`.
2. They evaluate rides for free: title, type, class, photo, verified facts, approximate location, home state, service states, distance, event fit, related rides.
3. They start Event Access with their event (date, city, state, ride type). Before any payment the server counts the unique, contactable, relevant operators and says so honestly.
4. They pay Carnival Ride Rental through our own standard Stripe account (Checkout; no Stripe Connect; no operator payout).
5. A server-verified payment creates a durable **access pass** (initially: up to 5 unique operators, 30 days, $99; all configurable in `access_products`).
6. On the pass page they unlock operators one at a time. The server retrieves the operator's contact details from Sharetribe (Integration API) and records exactly what was revealed.
7. The customer and operator deal directly. We are not a party to the rental.

### What Carnival Ride Rental does not do

- collect the carnival rental payment, pay operators, hold funds, charge a commission, or act as seller of record for operator rentals;
- require Stripe Connect, payout onboarding or marketplace transaction acceptance from operators;
- guarantee a booking, availability, a quote or a response from any operator;
- synchronise operator calendars (first version);
- show operator identity or contact details to anyone without a valid access pass.

### Infrastructure roles

| System | Role |
|---|---|
| **Sharetribe** | catalog and operator-management infrastructure: operator accounts, company ownership and claims, ride listings, listing fields, photos, service geography, listing approval, operator self-management, and the private operator contact record (`privateData`/`protectedData`, server-readable only). **Not** our rental payment processor. Its transaction and payment layer is unused. |
| **Our Next.js app** | SEO pages, search, discovery, matching, the Event Access funnel, contact reveal. |
| **Stripe (our standard account)** | the customer's access-fee payment. No Connect, no payouts, no commission. |
| **Access ledger (Postgres, Supabase)** | product configuration, event requests, purchases, passes, unlock limit and count, unlocked operators with an immutable reveal snapshot, expiration, refund and revocation, Stripe webhook idempotency, audit. References Sharetribe IDs; mirrors nothing else. See `docs/PAID_ACCESS_ARCHITECTURE.md`. |

**Future sessions must not reintroduce Stripe Connect, marketplace checkout, operator payouts, booking transactions or a mirror of the Sharetribe catalog without a new, explicit founder decision recorded here.**

## Non-negotiable product rules

- **Locked data** (operator company name where it identifies the supplier, contact person, phone, email, direct website, exact address, direct booking instructions) is never in HTML, hydration data, JSON-LD, metadata, Open Graph, image alt text, API responses, static exports, sitemaps, analytics or logs before a server-side entitlement check. Paid pages are `private, no-store` and noindex.
- **Public data** may include: ride title and type, class, manufacturer and model when verified, specifications when verified, photos we are entitled to display, approximate location, home state, service states, approximate distance, event suitability, related rides.
- Operator access is sold per **operator**, not per listing: five rides from one company are one operator. Operators with no usable contact channel are never sold.
- Never claim availability, a price for the rental, a guaranteed response, reviews, ratings, supplier counts, insurance or certifications. Unknown stays unknown.
- Pricing and limits for Event Access live in configuration (`access_products`), never hard-coded in copy or logic. Old purchases keep the terms they were bought with.
- Payments are server-verified (Stripe webhook or server-side session retrieval). A success redirect alone proves nothing. Idempotent processing; concurrency-safe unlock counting.
- Inventory ingestion (company import, listing import, photo provenance, validation, anonymisation, claim) is a first-class capability and must keep its controls: deduplication, source provenance, operator identity resolution, image rights, taxonomy consistency.
- SEO: existing canonical URLs never change; the indexing gates in `src/lib/inventory` and `src/lib/seo/publication.ts` stay; nothing is mass-indexed because of this pivot.

## Economics

| Amount | Owner |
|---|---|
| Event Access fee | Carnival Ride Rental (100%) |
| Rental price, delivery, crew, permits, insurance | agreed directly between customer and operator; never shown as ours |
| Stripe processing on the access fee | Carnival Ride Rental |
| Sharetribe plan and API usage | Carnival Ride Rental |

## Entities

```
Equipment (ride listing, Sharetribe)  ──owned by──►  Operator (Sharetribe user / company)
      │                                                     │
      └──located/serves──► Geography (home state, service states, approximate base)
      └──fits──► Event type (taxonomy)
Customer ──► Event request ──► Purchase ──► Access pass ──► Unlocks (operator, snapshot, time)
```

The taxonomy (`src/lib/taxonomy`, `src/lib/inventory/match.ts`) is ride-first but not ride-only: equipment classes beyond rides (inflatables, games, concessions, generators, tents, stages) can be added as classes and types without changing the page templates or the access model. Carnival rides remain the wedge.

## Origin

A single Ferris wheel rental sold from a WordPress site out-earned a full year of PRNM. The hard part was never the transaction; it was finding who actually owns the ride. This product sells that answer.
