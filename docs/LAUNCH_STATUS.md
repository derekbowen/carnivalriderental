# Launch status (2026-10-06, after the discovery-and-access pivot)

Read `PROJECT_BRIEF.md` for the model, `PAID_ACCESS_ARCHITECTURE.md` for where the ledger lives, and `PAID_ACCESS_IMPLEMENTATION.md` for what was built and how to roll back.

## 1. What is live on carnivalriderental.us

- 17,511 pSEO pages (1,580 city, 15,931 ride type + city), the directory, search `/s`, ride detail `/s/{id}`, state, category and event pages. All noindex; sitemap empty; robots `Disallow: /`. Indexing gates unchanged (`PSEO_INDEXING_PLAN.md`).
- The Event Access funnel (`/connect`, `/connect/{id}`, `/pass/{id}`) is deployed but **renders "Event Access is opening soon"** on the production domain because the production environment has no Stripe key and no ledger database (section 4). Nothing can be bought until those are set.
- Every CTA reads "Connect with operators". No "Book this ride", "Request a quote", request desk or marketplace-inbox copy remains on public pages (`e2e/access.spec.ts` checks).
- Legal pages: `/terms`, `/privacy`, `/access-policy`, `/contact` (drafted for counsel review; noindex).
- Public-facing pass (2026-10-06, after the pivot): homepage leads with "Carnival Ride Rentals Nationwide" (search, ride types, nearby rides, how it works, comparison, event types, cities, buyer education, Event Access, operator CTA, FAQ); buyer guide at `/guides/how-to-rent-carnival-rides` (`src/lib/content/guides.ts`); anonymous operator counts ("listed by N operators") from `src/lib/inventory/operators.json` (`npm run inventory:operators`, opaque hashes of author ids, no identity); occasion taxonomy, category hubs, city, ride-city, state, ride detail and footer copy all describe the discovery model. Site title and description in `src/app/layout.tsx` / `src/lib/config.ts`.

## 2. Sharetribe (Test marketplace)

- 3,716 published operator listings, 189 users, 319 imported companies: intact. Photos intact.
- Listing type `operator-ride-rental` stays Free messaging (`default-inquiry`). No payout details anywhere. Nothing transacts.
- The request-desk listing (`6ac33abd-…`) is no longer used by the site; close it in Console when convenient (Integration `listings/close`). The 18 test transactions stay (cannot be deleted; nothing reads them).
- Claims (`npm run ops:claim`) no longer restore the company name, bio or website to the public profile: the hosted marketplace cannot bypass the paywall after a claim.
- Console actions still needed (founder): **Access control → private marketplace + approve new users** so the hosted web app isn't a public catalogue; **Monetization → commission 0** (irrelevant without transactions, but stop documents quoting 10%); leave Payments empty (do not paste the Carnival Stripe keys there).

## 3. Email

Unchanged: Emailit domain pending review; `EMAIL_MODE=test` (everything to qa@). Pass emails go through the same provider with the same test-mode redirect; without a provider key they are skipped and logged, and the pass still works through the return URL.

## 4. Owner actions (only these need you)

Activation attempt 2026-10-06 (cloud session with the Supabase, Vercel, Stripe and Railway connectors): what it found and what remains.

1. **Stripe (account-level blocker)**: the only Stripe account connected to the workspace is `Pool Rental - Sharetribe` (live mode). It belongs to Pool Rental Near Me and must not be used. Connect (or create) the 10000 Solutions LLC / Carnival Ride Rental Stripe account to the Claude Stripe connector, then the product, price, webhook (`https://carnivalriderental.us/api/access/webhook`, events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`) and the two Vercel secrets (`STRIPE_SECRET_KEY` test key, `STRIPE_WEBHOOK_SECRET`) can be set without you. The app creates Checkout Sessions with an inline price from `access_products`; no dashboard product is required for it to work.
2. **Supabase**: `create_project` through the connector timed out six times (two regions); no `carnivalriderental` project exists. Create it in "derekbowen's Org" (any US region; Vercel runs in `iad1`), or grant the session another route to the Management API. Then the schema (`npm run access:migrate`) and `ACCESS_DATABASE_URL` (transaction-pooler URI, see `PAID_ACCESS_IMPLEMENTATION.md` §5) follow.
3. **Secrets into Vercel production**: `ACCESS_SESSION_SECRET` (32+ random characters) and `SHARETRIBE_INTEGRATION_CLIENT_ID` / `SHARETRIBE_INTEGRATION_CLIENT_SECRET` (the values in `.env.local`). The session's policy blocks it from reading secret values and pasting them into another service, so these need either your paste into Vercel → Settings → Environment Variables (production), or a one-off permission for the session to do it.
4. **Sharetribe Console** (no API exists for these): Access control → private marketplace + approve new users; Monetization → commission 0 (currently 10 %); Build → Applications → rotate the Marketplace API client secret (nothing uses it any more). Verified by `npm run sharetribe:inspect` on 2026-10-06: listing type `operator-ride-rental` is `default-inquiry` with `payoutDetails: false`; no Stripe keys are configured in Sharetribe; the legacy `daily-booking` listing type still exists but no listing uses it.
5. **Legal review** of `/terms`, `/privacy`, `/access-policy` before taking real money.
6. **Go-live switch**: swap `sk_test_` for `sk_live_` only after a test-mode purchase on the production domain has been checked end to end (buy → email → pass → unlock → refund).
7. Unchanged from before: GitHub default branch `main`; Vercel production branch `main`; Emailit domain review; indexing stays off until your separate go.

## 5. Known gaps (not hidden)

- Operator self-service portal is not built: operators edit through the hosted Sharetribe app (which should be private) or through the team. Claims and contact updates are team actions (`ops:claim`, Console).
- Contact coverage: of 319 companies, 87 have an email on file and 265 a phone; operators with no channel are never offered. Expect some reports of stale contacts; the pass has a "didn't work" button and the team can restore credits (`restoreUnlockCredit`).
- The 3,716 listing descriptions still carry the old unclaimed notice text on the hosted marketplace (it mentions the request desk). Our pages never show descriptions. A bulk rewrite is optional (`listings:enable-inquiry` can be adapted).
- Rate limiting is per server instance (in-memory), adequate for launch, not for abuse at scale.
- The legacy managed-request flow (`/internal`, `/api/requests`, SQLite) remains as internal tooling only; it has no public entry and will be archived in a later cleanup.

## 6. Live environment (not started)

As before: Live needs the Sharetribe Live plan, the Live Console config copied from Test, re-running the imports against Live with `--target live --founder-go`, and pointing production env at the Live client ID. Stripe and the ledger are independent of the Sharetribe environment.
