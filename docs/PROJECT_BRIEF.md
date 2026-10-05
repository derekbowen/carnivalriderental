# Project brief — national carnival ride rental marketplace

> Working brand **"Book a Carnival"** is a configurable placeholder (`src/lib/config.ts`).
> The final name and domain are **not approved**.

## The business model (founder decision 2026-10-05; read this before changing anything)

Carnival Ride Rental is a **marketplace**. Independent carnival operators supply and fulfil their own rides. Carnival Ride Rental facilitates discovery, requests and transactions.

1. Customers discover rides on carnivalriderental.us (search `/s`, state/city pages) and the Sharetribe marketplace.
2. **Verified, payment-ready operator** (claimed account, Stripe Connect complete, ride approved with a price or quote): the customer transacts on that operator's listing. The operator is the provider on the Sharetribe transaction, accepts or declines, fulfils, and is paid through Stripe Connect. Carnival Ride Rental earns the marketplace commission (rate not yet decided).
3. **Unclaimed inventory** (imported operator listings): inquiry-only. Requests go to Carnival Ride Rental's monitored request desk (the house account's inbox). The copy never says the operator received or accepted anything. The team contacts the operator and works to get them to claim their account and connect payouts.
4. Connecting Stripe alone never makes rides bookable: booking eligibility needs verified ownership, approval of that ride, authoritative payment readiness, an operator-approved price or quote, and confirmed availability and service area (`docs/OPERATOR_MARKETPLACE.md`).
5. The earlier "managed" model (we quote, source and sell as seller of record) is retired as the default. Its code (request service, quotes, supplier pipeline) remains as an internal fallback only.

It is **not**: a lead-selling site, a directory that hides who fulfils the event, or a reskinned Pool Rental Near Me.

Long-term goal: every carnival ride in the US discoverable and bookable from its operator. That is an ambition, not a claim that any operator is under contract.

## Ownership

The business is **owned and operated by 10000 Solutions LLC** (parent company). It operates the marketplace platform. On marketplace bookings the operator is the provider (and appears on the card charge via Stripe Connect destination charges); 10000 Solutions LLC earns the commission. It is seller of record only on bookings it deliberately sells through its own house account.

## Origin

Founder: Derek Bowen (operates Pool Rental Near Me; previously rented carnival rides as Ferris Wheel Rental U.S.). A single Ferris wheel rental, sold from a WordPress site, out-earned a full year of PRNM. The earlier mistake was positioning as a connector between owner and customer. This project corrects that.

This repository is **separate** from PRNM. It must never touch PRNM code, infrastructure, its Sharetribe marketplace or any other existing business.

## Economics — keep these amounts distinct

| Amount | Owner | Notes |
|---|---|---|
| Customer selling price | us | Set per event quote. No fixed platform fee; PRNM's 15% does **not** apply. |
| Supplier quote | operator | Recorded internally per event. |
| Transport & mobilization | operator / us | Often the largest variable. |
| Setup, teardown & operating crew | operator | |
| Other fulfilment costs | varies | permits, insurance riders, fuel, etc. |
| Payment costs | Stripe / Sharetribe | Rate not yet configured → shown as Unknown. |
| Projected contribution margin | derived | **Never** shown as guaranteed profit. Unknown costs stay unknown. |

$22,000 for a Ferris wheel is an illustrative example, not an approved price.

## Transaction model — intent vs. current Test scaffold

**Intended model:** the customer makes a **meaningful payment commitment before we invest in sourcing**, and the booking is confirmed only after an operator commits and the approved payment step is complete. Policy (deposit, timing, capture, refunds) is **not yet decided** — see `docs/PAYMENT_STATES.md`.

**Current Test scaffold:** listing type `managed-ride-rental` is bound to Sharetribe's regular `default-negotiation` process (quote request → offer → accept & pay) **only to prove catalog creation, retrieval and search in Test**. That flow is *not* equivalent to the intended model (payment comes after sourcing) and is **not approved as the final process**. A quote-only path may exist later, but not as the only path without founder approval. The process binding lives in `contract/listing-contract.json → processBinding`, separate from offering and category identity.

## Core entities

| Entity | Meaning | Source of truth (session one) |
|---|---|---|
| Ride category | Ferris wheels, carousels… | `src/lib/content` fixtures |
| Ride rental offering | What customers browse and request | `src/lib/content` fixtures (→ Sharetribe listing later) |
| Physical ride unit | A specific machine with owner, model, verification | dev SQLite `ride_units` (internal only) |
| Supplier / operator | Business providing equipment + crew | dev SQLite `suppliers` (internal only) |
| Event request | Customer's brief + fulfilment + payment status | dev SQLite `event_requests` |
| Customer quote (versioned) | Price + scope we offer the customer | dev SQLite `customer_quotes` |
| Supplier candidate / quote | Per-event supplier stage and costs | dev SQLite `request_suppliers`, `supplier_quotes` |
| Event fulfilment | The committed supplier + unit for an event | `event_requests.assigned_*` after `commitSupplier` |

Supplier relationship (global): `researched_prospect → contacted → verified_supplier`.
Supplier stage per event: `candidate → contacted → quoted → committed` (or `declined`).
A researched operator is not a partner. A catalogue entry is not confirmed available equipment.

## Non-negotiable product rules

- Unconfirmed supply is never presented as confirmed. Availability labels are "Sourcing on request" unless a **verified coverage** record exists.
- Price labels distinguish *planning estimate*, *quote awaiting acceptance* and *accepted quote*.
- Request submitted ≠ payment method saved ≠ funds authorized ≠ payment captured ≠ supplier committed ≠ booking confirmed.
- No invented reviews, completed rentals, supplier counts, insurance promises, certifications, dimensions, capacities or manufacturer specs.
- No copied operator photos; development placeholders are labelled as such.
- Raw card data never touches our forms, database, logs or analytics.
- All non-production environments are noindex and should be access-controlled.
