# Launch status (2026-10-06, after the discovery-and-access pivot)

Read `PROJECT_BRIEF.md` for the model, `PAID_ACCESS_ARCHITECTURE.md` for where the ledger lives, and `PAID_ACCESS_IMPLEMENTATION.md` for what was built and how to roll back.

## 1. What is live on carnivalriderental.us

- 17,511 pSEO pages (1,580 city, 15,931 ride type + city), the directory, search `/s`, ride detail `/s/{id}`, state, category and event pages. All noindex; sitemap empty; robots `Disallow: /`. Indexing gates unchanged (`PSEO_INDEXING_PLAN.md`).
- The Event Access funnel (`/connect`, `/connect/{id}`, `/pass/{id}`) is deployed but **renders "Event Access is opening soon"** on the production domain because the production environment has no Stripe key and no ledger database (section 4). Nothing can be bought until those are set.
- Every CTA reads "Connect with operators". No "Book this ride", "Request a quote", request desk or marketplace-inbox copy remains on public pages (`e2e/access.spec.ts` checks).
- Legal pages: `/terms`, `/privacy`, `/access-policy`, `/contact` (drafted for counsel review; noindex).

## 2. Sharetribe (Test marketplace)

- 3,716 published operator listings, 189 users, 319 imported companies: intact. Photos intact.
- Listing type `operator-ride-rental` stays Free messaging (`default-inquiry`). No payout details anywhere. Nothing transacts.
- The request-desk listing (`6ac33abd-…`) is no longer used by the site; close it in Console when convenient (Integration `listings/close`). The 18 test transactions stay (cannot be deleted; nothing reads them).
- Claims (`npm run ops:claim`) no longer restore the company name, bio or website to the public profile: the hosted marketplace cannot bypass the paywall after a claim.
- Console actions still needed (founder): **Access control → private marketplace + approve new users** so the hosted web app isn't a public catalogue; **Monetization → commission 0** (irrelevant without transactions, but stop documents quoting 10%); leave Payments empty (do not paste the Carnival Stripe keys there).

## 3. Email

Unchanged: Emailit domain pending review; `EMAIL_MODE=test` (everything to qa@). Pass emails go through the same provider with the same test-mode redirect; without a provider key they are skipped and logged, and the pass still works through the return URL.

## 4. Owner actions (only these need you)

1. **Supabase**: create a project `carnivalriderental` in your organisation (this session's API calls to create it timed out; none exists yet). Put its connection string in Vercel production as `ACCESS_DATABASE_URL`, then run `npm run access:migrate` once (or deploy; the app applies the schema on first connection).
2. **Stripe**: a standard account for 10000 Solutions LLC (not Pool Rental's). In Vercel production set `STRIPE_SECRET_KEY` (start with `sk_test_…`) and `STRIPE_WEBHOOK_SECRET` from a webhook endpoint `https://carnivalriderental.us/api/access/webhook` subscribed to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`.
3. **Secrets**: `ACCESS_SESSION_SECRET` (32+ random characters) in Vercel production.
4. **Sharetribe Console** (section 2): private marketplace, approve new users, commission 0.
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
