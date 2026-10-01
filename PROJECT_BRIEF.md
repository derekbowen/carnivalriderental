# Project brief — managed carnival ride rental marketplace

Working brand: **Book a Carnival** (placeholder; name and domain not approved).
Status: **development**. Nothing here is live, indexed or taking payments.

## The business model (read before changing anything)

This is a **managed marketplace with operator procurement**:

1. Customers discover carnival ride rentals through **our** site.
2. They send **us** their event requirements and, later, a payment commitment.
3. **We** own the customer relationship, the quote, the transaction and fulfillment coordination.
4. **We** source the ride and operating crew from a suitable carnival operator.
5. The operator is **our fulfillment supplier**. They do not need a public listing or a marketplace account.

It is **not** a directory, a lead-selling site, an owner-listing acquisition campaign, software for operators, or a copy of Pool Rental Near Me. Operator self-service listings are an optional later idea, never a launch prerequisite.

Long-term ambition: make every carnival ride in the US discoverable and sourceable through us, with programmatic SEO capturing demand. That is a goal, not a claim that any ride is under contract today.

## Separate concepts — never merge them

| Concept | Meaning | Where it lives |
|---|---|---|
| Ride type / rental offering | What customers browse ("Ferris wheel rental") | `src/data/*/catalog.ts` (later mirrored as Sharetribe listings) |
| Physical ride unit | A specific machine with owner, model, location, verification | Not modelled yet (next milestones) |
| Supplier / operator | A business that can provide equipment, transport, crew | `suppliers` table (internal only) |
| Event fulfillment | The supplier committed to one event, with scope and cost | `request_suppliers` + `supplier_quotes` |

Supplier status: `researched → contacted → verified` (a human decision). Per-event stage: `considering → contacted → quoted → committed` (or `declined`). Only a **verified** supplier with a **recorded quote** can be committed, and only one per event.

## Money — keep every amount separate

Customer selling price · supplier quote · transport & mobilization · setup/teardown & crew · other fulfillment costs · payment costs · projected contribution. Unknown costs stay unknown. Projected contribution is shown as a projection with the unknowns listed, never as profit. No fee percentage from PRNM applies here. $22,000 for a Ferris wheel is an illustrative example, not a price.

## Status — fulfillment and payment are separate

Fulfillment: `submitted → sourcing → quote_sent → quote_accepted → supplier_committed → confirmed` (or `cancelled`).
Payment: `not_started | method_saved | authorized | captured | refunded`.
A saved card is not a booking. "Booked"/"confirmed" appears only at `confirmed`, which is **disabled until a payment policy is approved** (`src/lib/requests/status.ts`).

## Content rules for public pages

No invented inventory, reviews, completed rentals, supplier counts, insurance or safety claims, dimensions, capacities or manufacturer specs. City pages say we **arrange requests** for events there, subject to availability — never that we own or have contracted a ride there. Images must be owned or licensed; otherwise clearly labelled development placeholders. Never copy operators' photos.
