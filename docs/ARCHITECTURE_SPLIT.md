# Architecture: catalog, access ledger and the pSEO layer (updated 2026-10-06)

The original split ("the ATM" = Sharetribe payments, kept apart from a secretless pSEO layer) was written for the marketplace model. Under the discovery-and-access model (`PROJECT_BRIEF.md`) the money side is the **access ledger**, not Sharetribe.

## Three systems, one application

| | Sharetribe | Access ledger | pSEO / public pages |
|---|---|---|---|
| Purpose | operator accounts, listings, photos, approval, private contact record | Event Access products, purchases, passes, unlocks, audit | 17,500+ discovery pages, search, ride detail |
| Store | Sharetribe (system of record for the catalog) | Postgres (Supabase), portable SQL; SQLite locally | build-time JSON snapshot (`rides.json`), no identity |
| Secrets | Integration API secret: server route handlers and scripts only; never the browser, never the snapshot | `ACCESS_DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ACCESS_SESSION_SECRET`: server only | none (public client ID at most) |
| Writes | import scripts, claim script, operators themselves | server routes (`/api/access/*`, `/api/pass/*`), Stripe webhook | none |
| Reads | public Marketplace API (anonymised) for search/detail; Integration API for contactability and reveal | server only | local JSON |

Data flows one way from Sharetribe to the public pages (export → snapshot, validated by `inventory:validate`) and never back. The ledger references Sharetribe IDs and mirrors nothing.

## Deployment

One Next.js deployment on Vercel. Paid routes (`/connect`, `/pass`, `/api/access`, `/api/pass`) are dynamic, `private, no-store`, noindex and disallowed in `robots.txt`. Public pages remain static or ISR. The Integration secret and Stripe secrets exist only in Vercel's production environment; previews run with the fake Stripe gateway and SQLite and cannot take money.

## Hardening rules that stay

- Branch protection on `main`; founder approval for production deploys.
- Import and ops scripts are run by a person with `.env.local`, never deployed.
- No real Stripe charges until the Carnival Ride Rental live keys are set deliberately; the app refuses to run Event Access on SQLite or with the fake gateway when `APP_ENV=production`.
- Indexing gates are separate from monetisation (`PSEO_INDEXING_PLAN.md`).
