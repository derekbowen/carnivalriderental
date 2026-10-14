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

## 1b. Products and tiers (2026-10-12)

| Product | id / slug | Price | Terms | Applies to |
|---|---|---|---|---|
| Event Access | `prod_event_access_v1` / `event-access` | $99 one time | one event, up to 5 distinct operators, 30 days, min. 3 contactable matches | every request whose resolved ride type is not a Ferris wheel (including class-only and "any ride" requests, and requests whose matched operators happen to own a Ferris wheel) |
| Ferris Wheel Event Access | `prod_ferris_wheel_access_v1` / `ferris-wheel-access` | $199 one time | same terms | requests whose resolved ride type is `ferris-wheel`, `giant-ferris-wheel` or `mini-ferris-wheel` |

Rules, all in `src/lib/access/pricing.ts` + `service.ts` and covered by `tests/access-pricing.test.ts` and `e2e/pricing.spec.ts`:
- `resolveCriteria` is the single resolver: a listing id that exists in the inventory snapshot classifies the request (its ride type wins over anything submitted); otherwise the submitted ride type counts only if it is a canonical taxonomy id; a class counts only without a type. Matching (`matching.ts`) calls the same function, so the equipment that is matched is the equipment that is priced. `startEventRequest` resolves first, picks the tier's product, then matches, and throws if the two resolutions ever disagree.
- The resolved criteria and the product are persisted on `access_event_requests`. `quoteForEvent` re-derives the tier from the stored criteria and loads the tier's active product; the matches page and `createCheckout` both use it, so the amount shown is the amount charged. Nothing posted to `/api/access/start` or `/api/access/checkout` (price, product, amount, tier fields) is read.
- A tier whose product row is missing or `active = 0` is "not available right now": no request, no checkout, no fallback to the other tier.
- Requote: on checkout, pending purchases of the same request at a different product/amount are expired in the ledger and at Stripe (`expireCheckoutSession`; a session Stripe reports as already paid is left alone and honoured at its own terms), and the request's `product_id` is corrected. A payment Stripe verifies always yields a pass even if the ledger had expired the quote (`activatePurchase` accepts `pending` and `expired`).
- Purchases snapshot `product_id`, `amount_cents`, `currency`, `unlock_limit`, `validity_days`; passes bind to the purchase and to the request's match snapshot. `charge.refunded` judges full vs partial against the purchase's `amount_cents`.
- Copy reads the rows: `accessProductsForDisplay()` (runtime.ts, 60 s memo, seeded defaults when the ledger is unreachable) → `lib/access/copy.ts`. Ferris surfaces show "Ferris Wheel Event Access — $199"; general surfaces "Event Access is $99. Ferris Wheel Event Access is $199." Stripe Checkout line items carry the product's name and description.
- Seed: `ensureDefaultProducts` runs `INSERT … ON CONFLICT (id) DO NOTHING` for both rows on every product lookup and in `npm run access:migrate`; it never updates an existing row, so prices managed in the database survive deploys. Supabase migration `access_products_ferris_wheel_v1` inserted the Ferris row in production on 2026-10-12.

## 2. Files

New (`src/lib/access/`): `schema.sql`, `db.ts` (Postgres/SQLite driver, portable SQL), `config.ts` (products; `DEFAULT_PRODUCT` and `FERRIS_PRODUCT` seeds, `productForTier`, `activeProducts`), `pricing.ts` (the one resolver: authoritative listing classification → canonical ride type → class; tier; `CATEGORY_CONTEXT`), `copy.ts` (price copy built from product rows), `stripe.ts` (gateway: real via REST, fake for dev/e2e; signature verification), `session.ts` (cookie, magic-link tokens), `contacts.ts` (operator source: Sharetribe or fixture; permitted reveal fields; never our placeholder addresses), `matching.ts` (geocode, candidates from the public snapshot, listing → author via public API, contactability, deterministic ranking, per-operator dedupe), `service.ts` (business rules and invariants), `email.ts`, `runtime.ts` (availability, cookies, rate limit, request origin).

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
| `ACCESS_DATABASE_URL` | Vercel production (and preview if the funnel should work there) | Postgres connection string. Unset outside `APP_ENV=development` disables Event Access ("opening soon"). **Connection mode:** use the Supabase *transaction pooler* URI (Supavisor, port 6543) **without** an `sslmode` parameter (the driver strips it and sets TLS itself; `pg` treats `sslmode=require` as verify-full, which fails on the pooler chain), not the direct `db.<ref>.supabase.co:5432` host: Vercel functions open a fresh `pg.Pool` per instance and the direct host runs out of connections. The ledger only uses parameterised queries and single-client `BEGIN … COMMIT`, both supported in transaction mode. |
| `STRIPE_SECRET_KEY` | Vercel production | `sk_test_…` then `sk_live_…`. Carnival Ride Rental's account only. Unset in development selects the fake gateway. |
| `STRIPE_WEBHOOK_SECRET` | Vercel production | From the Stripe webhook endpoint. |
| `ACCESS_SESSION_SECRET` | Vercel production | Signs pass cookies; hashes IPs in the audit. Falls back to `REQUEST_TOKEN_SECRET`. |
| `ACCESS_OPERATOR_SOURCE` | local/e2e only | `fixture` = fictional operators. Refused outside development. |
| `SHARETRIBE_INTEGRATION_CLIENT_ID/_SECRET` | Vercel production (set 2026-10-06, Test marketplace) | Operator contacts at reveal time; contactability flags before payment. Without them every operator counts as uncontactable and nothing is sold. |
| `RESEND_API_KEY` (or `EMAILIT_API_KEY`), `EMAIL_MODE` | Vercel production (**not set as of 2026-10-12**; owner action, see LAUNCH_STATUS §7) | Pass and recovery emails. `EMAIL_MODE` unset = `test`: everything goes to `qa@carnivalriderental.us`. Without a key the pass still works through the return URL and cookie; the email is skipped and logged. |
| `SITE_URL` | as before | Canonical links in emails and Checkout return URLs. |

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
- Bot protection is Vercel BotID on the form endpoints (`src/lib/access/bot.ts`, `src/instrumentation-client.ts`); it fails open on errors, so a BotID outage leaves only the rate limits.
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
