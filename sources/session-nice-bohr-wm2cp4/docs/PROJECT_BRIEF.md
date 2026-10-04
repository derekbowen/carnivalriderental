# Project brief — national carnival ride rental marketplace

> Working brand **"Book a Carnival"** is a configurable placeholder (`src/lib/config.ts`).
> The final name and domain are **not approved**.

## The business model (read this before changing anything)

This is a **managed marketplace with operator procurement**:

1. The customer discovers carnival ride rentals through **our** marketplace.
2. The customer submits their event requirements (and, once the payment policy is approved, a payment commitment) **to us**.
3. **We** own the customer relationship, the quote, the transaction and fulfilment coordination.
4. **We** source the ride and operating crew from an appropriate carnival operator.
5. The operator is our **fulfilment supplier**. Operators do **not** need a marketplace account or a public listing for us to sell.

It is **not**: a directory that sends customers away, a lead-selling site, an owner-listing acquisition campaign, software for operators, or a reskinned Pool Rental Near Me.

**Operator self-service listings are optional later — never a launch prerequisite.** Do not reintroduce "List your ride", provider onboarding or operator Stripe enrolment as the primary path.

Long-term goal: make every carnival ride in the US discoverable and sourceable through this business. That is an ambition, **not** a claim that we have rides under contract.

### Second track — operator program (founder direction, 2026-10-04)

Later, operators may list their own rides, set their own price and be paid through Stripe Connect. Operators pay 0% commission; the marketplace is funded by a customer service fee (rate to be set). This runs **alongside** the managed track and is **not** a launch dependency. Today only an early-access page (`/operators`) and an application list exist. Design, verified Sharetribe constraints and open decisions: `docs/OPERATOR_MARKETPLACE.md`. In that track the operator is the seller on the card charge (destination charges), so the seller-of-record rules above apply to managed bookings only.

## Ownership

The business is **owned and operated by 10000 Solutions LLC** (parent company). It is the seller of record: customers contract with and pay 10000 Solutions LLC (via its own Sharetribe seller account and Stripe Connect onboarding), and operators are its subcontracted suppliers.

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
