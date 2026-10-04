# Book a Carnival — development

Managed carnival ride rental marketplace. **Read [PROJECT_BRIEF.md](PROJECT_BRIEF.md) first**: we capture customer demand and manage the transaction, and we procure fulfillment from carnival operators. Operators do not need to list anything.

- Architecture, Sharetribe mapping and what's verified vs. assumed: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Decisions needed before real transactions: [docs/DECISIONS.md](docs/DECISIONS.md)
- Magic Patterns design source (reference, not shipped): [design/magic-patterns/](design/magic-patterns/) — editor: https://www.magicpatterns.com/c/epnrxvfjbkqzxxv162nzqs

## Run it locally

Requires Node 22.5+ (uses the built-in `node:sqlite`).

```bash
npm install
cp .env.example .env.local      # then set INTERNAL_USER and INTERNAL_PASSWORD (12+ chars)
npm run dev                     # http://127.0.0.1:3000
```

- Customer site: `/`, `/rides`, `/rides/ferris-wheel-rental`, `/locations/tx/austin`, `/locations/tx/austin/ferris-wheel-rental`, `/request`
- Customer status page: the link shown after submitting (`/requests/BAC-XXXXXX?t=…`)
- Internal team area: `/internal` (HTTP Basic auth with `INTERNAL_USER` / `INTERNAL_PASSWORD`; closed if unset)

The development database is `.data/dev.sqlite` (gitignored). Delete it to start fresh.

## Checks

```bash
npm run typecheck
npm test                         # unit + acceptance tests (vitest)
npm run build && npm run test:e2e   # browser end-to-end on a production build (needs Playwright/Chromium)
```

## What works in session one

- Public pages from structured data: homepage, browse with category filter, category page, ride page, city service page, ride + city page. Canonicals, noindex, robots, sitemap and publication gates as described in ARCHITECTURE.md.
- Event request: 4-step form + review, "Not sure" for site questions, idempotent submission, server-side validation, confirmation rendered from the stored request, customer status page with separate fulfillment and payment status.
- Internal: request queue, request detail with brief, suppliers (researched/contacted/verified), per-event stages, versioned supplier quotes with cost breakdown (unknowns stay unknown), projected contribution with exclusions listed, versioned customer quotes, guarded status changes, history.
- Customer can accept the open quote; acceptance and all status changes are validated on the server.

## Mocked or not connected

- **Sharetribe: not connected.** The app runs on the labelled development adapter (`src/lib/marketplace/adapter.ts`). No listings, users or transactions exist in Sharetribe.
- **Payments: not connected.** No card fields exist anywhere. Payment status stays "No payment taken". Booking confirmation is disabled until a payment policy is approved.
- **Email/notifications: none.** Customers keep their status link; the team checks `/internal`.
- **Catalog content:** demo fixtures only (`src/data/fixtures`), with a placeholder price range clearly labelled. `src/data/production` is empty.
- **Supplier outreach:** none. Supplier records are entered by hand.

## Next small milestone

Connect a Sharetribe **test** marketplace and prove the seller-of-record mapping end to end: one company-owned provider account (Stripe test mode), one Ferris wheel listing on a regular price-negotiation listing type, and a test customer accepting an offer — before writing any payment UI. See open questions in ARCHITECTURE.md.
