# Paid access implementation (2026-10-06)

What was built for the pivot from marketplace checkout to discovery + paid operator access. Model: `PROJECT_BRIEF.md`. Storage decision: `PAID_ACCESS_ARCHITECTURE.md`. Status and owner actions: `LAUNCH_STATUS.md`.

## 1. Architecture selected

```
Sharetribe (catalog + operators, unchanged)    Stripe (our standard account)    Access ledger (Postgres)
  listings, photos, fields, approval,            Checkout Sessions, webhooks      products, event requests,
  private contact record                          no Connect, no payouts           purchases, passes, unlocks
        │ public API (anonymised)  │ Integration API (server)       │                      │
        ▼                          ▼                                ▼                      ▼
                    Next.js app: SEO pages → /connect → preflight → pay → /pass → unlock → contact
```

- **Second datastore: yes, the smallest one.** Postgres (Supabase) holds only the access ledger: `access_products`, `access_event_requests`, `access_purchases`, `access_stripe_events`, `access_passes`, `access_unlocks`, `access_magic_links`, plus `operator_contact_status` (contactability flags, 24 h cache). It references Sharetribe listing and user ids. **No listing content, no operator names, no contact values are mirrored.** Contact values exist in the ledger only inside `access_unlocks.contact_snapshot`, written after the entitlement check, as the audit of what a paying customer saw. Why not Sharetribe or SQLite: `PAID_ACCESS_ARCHITECTURE.md`.
- **Sharetribe's final role:** operator accounts, company ownership and claims, listings, listing fields, photos, service geography, approval, operator self-management (hosted app), and the private contact record (`privateData` / `protectedData`, read by the server through the Integration API at reveal time). Its transaction layer is unused; the listing type stays Free messaging so nothing asks for payout details.
- **Stripe's final role:** one Checkout Session per purchase, paid to 10000 Solutions LLC. Webhook verified with the endpoint secret; idempotent on event id; the return URL re-verifies the session with Stripe's API. No Connect, no transfers, no payouts.
- **Customer identity:** no accounts. A signed, pass-bound cookie plus an emailed magic link (`/pass/open?t=…`), multi-use for 14 days; `/pass/recover` re-sends links. Chosen over Sharetribe customer accounts because a password-free pass has lower friction and no coupling to the catalog system.

## 2. Files

New (`src/lib/access/`): `schema.sql`, `db.ts` (Postgres/SQLite driver, portable SQL), `config.ts` (products; `DEFAULT_PRODUCT` seed), `stripe.ts` (gateway: real via REST, fake for dev/e2e; signature verification), `session.ts` (cookie, magic-link tokens), `contacts.ts` (operator source: Sharetribe or fixture; permitted reveal fields; never our placeholder addresses), `matching.ts` (geocode, candidates from the public snapshot, listing → author via public API, contactability, deterministic ranking, per-operator dedupe), `service.ts` (business rules and invariants), `email.ts`, `runtime.ts` (availability, cookies, rate limit, request origin).

New routes: `src/app/connect/page.tsx`, `src/app/connect/[id]/page.tsx`, `src/app/pass/[id]/page.tsx`, `src/app/pass/pending/page.tsx`, `src/app/pass/recover/page.tsx`, `src/app/pass/open/route.ts`, `src/app/api/access/{start,checkout,return,webhook,dev-checkout}/route.ts`, `src/app/api/pass/[id]/{unlock,report}/route.ts`, `src/app/api/pass/recover/route.ts`, `src/app/{terms,privacy,access-policy,contact}/page.tsx`. Components: `src/components/access/{ConnectForm,OperatorMatch}.tsx`. Script: `scripts/access-migrate.ts` (`npm run access:migrate`). Tests: `tests/access-{ledger,matching,stripe}.test.ts`, `tests/privacy-surfaces.test.ts`, `e2e/access.spec.ts`.

Changed: `CLAUDE.md`, `docs/PROJECT_BRIEF.md`, `docs/OPERATOR_MARKETPLACE.md`, `docs/ARCHITECTURE_SPLIT.md`, `docs/LAUNCH_STATUS.md`, `docs/PSEO_INVENTORY.md`; `src/lib/seo/routes.ts` (`connect`, `connectListing`, `pass`, legal paths; `request()` kept as an alias that builds `/connect`); `next.config.ts` (`/request` → `/connect`, 308, query preserved); `src/middleware.ts` (paid routes `private, no-store` + noindex); `src/app/robots.ts`; every CTA and copy surface (`RequestCta`, `InventoryPages`, `CityPage`, `OccasionPage`, `CategoryHub`, `RideDetail`, `RideResult`, `SiteChrome`, `page.tsx`, `[state]/page.tsx`, `rides/page.tsx`, `directory/*`, `s/[id]/page.tsx`, `operators/page.tsx`); `src/lib/pricing/{policy,public-price}.ts` ("Priced by the operator"); `src/lib/seo/structured-data.ts` (the site `Service` is operator discovery and contact access, never ride rental); `src/lib/operators/{claim,program}.ts`; `scripts/operator-claim.ts` (no public identity restore, no `bookable`); `src/lib/catalog/operator-search.ts` (`listingAuthorIds`; `bookable` and `marketplaceListingUrl` removed); `src/lib/inventory/index.ts`; `playwright.config.ts` (fake Stripe, fixture operators, no email provider); `.env.example`; `package.json` (`pg`, scripts).

Deleted: `src/app/request/page.tsx`, `src/components/request/{RideRequestForm,EventRequestForm}.tsx`, `src/lib/sharetribe/browser.ts` (browser-side Sharetribe signup/inquiry), `scripts/request-desk.ts`, `scripts/operator-bookable.ts`, `scripts/qa-payment.ts`, `scripts/stripe-probe.ts`; npm scripts `desk:*`, `ops:bookable`, `qa:payment`, `stripe:probe`; `bookingBlockers`/`EligibilityInput`; env `REQUEST_DESK_LISTING_ID`, `SHARETRIBE_CLIENT_SECRET` (only the deleted scripts used it; rotate it in Console).

## 3. Old marketplace functionality removed

Stripe Connect checks, payout-readiness and `metadata.bookable`, "Book this ride" links to the hosted marketplace, the customer inquiry transaction (`transition/inquire-without-payment`) and messaging, the request desk, the public legacy managed-request form, commission promises and the "pay first, then we source" pricing notice. The legacy managed-request service (`src/lib/requests`, `/internal`, `/api/requests`) remains as internal tooling with no public entry; e2e seeds it through its API.

## 4. Routes changed or redirected

| Old | New |
|---|---|
| `/request`, `/request?listing=…`, `/request?state=…&occasion=…` | 308 → `/connect` with the same query (`listing`, `state`, `city`, `occasion`, `category`, `type`, `class`) |
| `paths.requestRide(id)` | `paths.connectListing(id)` → `/connect?listing=…` |
| new | `/connect/{eventRequestId}`, `/pass/{passId}`, `/pass/open`, `/pass/pending`, `/pass/recover`, `/terms`, `/privacy`, `/access-policy`, `/contact` |

No canonical URL changed. pSEO counts unchanged: 17,511 renderable, 0 indexable, 0 in sitemap, 359 + 2,038 index-eligible (`npm run pseo:report`, `npm run pseo:duplicates`).

## 5. Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `ACCESS_DATABASE_URL` | Vercel production (and preview if the funnel should work there) | Postgres connection string. Unset outside `APP_ENV=development` disables Event Access ("opening soon"). |
| `STRIPE_SECRET_KEY` | Vercel production | `sk_test_…` then `sk_live_…`. Carnival Ride Rental's account only. Unset in development selects the fake gateway. |
| `STRIPE_WEBHOOK_SECRET` | Vercel production | From the Stripe webhook endpoint. |
| `ACCESS_SESSION_SECRET` | Vercel production | Signs pass cookies; hashes IPs in the audit. Falls back to `REQUEST_TOKEN_SECRET`. |
| `ACCESS_OPERATOR_SOURCE` | local/e2e only | `fixture` = fictional operators. Refused outside development. |
| `SHARETRIBE_INTEGRATION_CLIENT_ID/_SECRET` | Vercel production (already) | Operator contacts at reveal time; contactability flags before payment. |
| `SITE_URL`, `EMAIL_*` | as before | Pass emails and canonical links. |

The e2e and local runs need none of the production values: SQLite ledger, fake Stripe, fixture operators.

## 6. Sharetribe Console actions still required (founder)

1. Access control: **private marketplace** and **approve new users** (the hosted app must not be a public catalogue of operator profiles).
2. Monetization → commission **0** (cosmetic; no transactions happen).
3. Leave Payments as is; never paste the Carnival Stripe keys into Sharetribe.
4. Close the request-desk listing (optional).

## 7. Stripe dashboard actions still required (founder)

1. Standard account for 10000 Solutions LLC (no Connect platform setup).
2. Webhook endpoint `https://carnivalriderental.us/api/access/webhook` with the six event types in `LAUNCH_STATUS.md` §4; copy the signing secret.
3. Keep the account in test mode until a full test-mode purchase has been checked on the production domain.

## 8. Deployment status

See the final session report. Production (`carnivalriderental.us`, `APP_ENV=preview`) runs the new code with Event Access **disabled** until the variables in §5 exist; everything else (pSEO, search, detail, legal pages, CTAs) is live.

## 9. Test results

Recorded in the final session report: `npm run typecheck`, `npm test` (unit), `npm run build`, `npm run inventory:validate`, `npm run pseo:report`, `npm run pseo:duplicates`, `npm run test:e2e`.

Coverage added: pricing from configuration; minimum-match refusal; input validation; server-side amount; activation only on verified Stripe state; one pass per purchase; duplicate webhooks; expired/failed sessions; per-operator unlocks with free re-open; hard limit under concurrency; operators outside the match set; expired and revoked passes; partial refund vs full refund vs dispute; dead-contact report and credit restore; magic links; signature verification and replay; environment safety (fake/SQLite only in development); cookie forgery; rate limiter; per-operator dedupe; uncontactable exclusion; geography filter; contact cache; placeholder-address exclusion; anonymous match snapshots; public pages free of contact data, `mailto:`/`tel:` and old-model copy; the full funnel in a browser; entitlement boundary (403 without cookie, locked page without enumeration); refund revocation; cancelled and expired checkout; weak inventory not sold; `/request` redirect.

## 10. Known risks

- Stripe webhook delivery to a preview or local environment is impossible without a tunnel; the return-URL verification covers the customer path, the webhook covers refunds/disputes. A daily reconciliation job is not built yet (Stripe retries webhooks for 3 days).
- Contact data quality (see `LAUNCH_STATUS.md` §5) is the main chargeback exposure. The access policy's refund rules and the unlock audit are the mitigations.
- In-memory rate limits reset per instance.
- The claim script now keeps profiles anonymous, but an operator editing their own profile in the hosted app could publish their name; the private-marketplace Console setting is the backstop.

## 11. Rollback

- Code: `git revert` the pivot commits on `main` and redeploy; the inventory snapshot, pSEO pages and Sharetribe data are untouched by the pivot, so the old pages come back exactly. `/request` redirects would revert with the config.
- Ledger: leave the Postgres tables in place (they hold payment records); no other system writes to them.
- Sharetribe: nothing to undo. Claimed operators' public profiles were never restored, so there is nothing to re-anonymise.
- Stripe: refund any test-mode purchases from the dashboard; the webhook revokes the passes.

## 12. Recommended next three actions after launch

1. Operator portal (`/account`): login via the Auth API password grant, self-serve claim with the domain check, ride and photo editing via `own_listings/*`, contact details form. Then set the hosted marketplace private.
2. Contact verification pass over the 319 companies (phone/email/website liveness), stored as `verified_at` in `operator_contact_status`; weight ranking by it.
3. Reconciliation job and admin view: list `pending` purchases older than an hour and check them against Stripe; show reported dead contacts and restore credits with one click.
