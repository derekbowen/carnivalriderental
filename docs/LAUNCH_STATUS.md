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

## 4. Activation status (2026-10-06, evening)

Event Access is **live in Stripe test mode** on carnivalriderental.us and verified end to end on the production domain: event request → 7 real operator matches for Columbus, OH → $99 server-side price → Stripe Checkout (sandbox) → `checkout.session.completed` webhook → pass created → unlock (contact snapshot + IP hash in `access_unlocks`) → duplicate unlock free → second unlock → refund via Stripe API → `charge.refunded` webhook → pass revoked, audit rows kept, public pass page locked. No contact data on any public page.

- **Supabase**: project `carnivalriderental` (`xvjnwsaxoszovogzbutw`, us-west-2). Schema applied as migrations `access_ledger_v1` + `access_ledger_rls` (RLS on, no policies: the app connects as the table owner through the transaction pooler, the anon key sees nothing). Product seeded. `ACCESS_DATABASE_URL` is the **transaction pooler** URI without any `sslmode` parameter (the driver strips it; `pg` treats `sslmode=require` as verify-full, which fails on the pooler chain).
- **Stripe**: account "carnival ride rental us" (`acct_1UMq9HEWfwV4oIOU`), sandbox `acct_1UN23tIdwlV6NJQt`. Test-mode webhook `we_1UNUzEIdwlV6NJQtbdNVGtYu` → `/api/access/webhook`, the six events. Live mode untouched.
- **Vercel production env**: `ACCESS_DATABASE_URL`, `ACCESS_SESSION_SECRET`, `STRIPE_SECRET_KEY` (sk_test), `STRIPE_WEBHOOK_SECRET`, `SHARETRIBE_INTEGRATION_CLIENT_ID/_SECRET` all set as sensitive variables.
- **Sharetribe Console**: "Approve users who want to join" is on. "Make marketplace private" was tried and **must stay off**: it makes the anonymous Marketplace API return 403 and empties the public catalog. Commission 0 and rotating the Marketplace client secret remain owner actions.
- **Email**: no provider key in Vercel production, so pass emails are skipped and logged; the pass still works via the return URL and cookie. Set `EMAILIT_API_KEY` (EMAIL_MODE stays `test`) to exercise the magic-link email.
- **Go-live switch** (owner): rotate the Supabase database password (it was shared in chat during setup), connect the live Stripe mode, create the live webhook, swap `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` to live values, legal review of `/terms`, `/privacy`, `/access-policy`. Indexing stays off until the separate index-readiness audit.

## 5. Known gaps (not hidden)

- Operator self-service portal is not built: operators edit through the hosted Sharetribe app (which should be private) or through the team. Claims and contact updates are team actions (`ops:claim`, Console).
- Contact coverage: of 319 companies, 87 have an email on file and 265 a phone; operators with no channel are never offered. Expect some reports of stale contacts; the pass has a "didn't work" button and the team can restore credits (`restoreUnlockCredit`).
- The 3,716 listing descriptions still carry the old unclaimed notice text on the hosted marketplace (it mentions the request desk). Our pages never show descriptions. A bulk rewrite is optional (`listings:enable-inquiry` can be adapted).
- Rate limiting is per server instance (in-memory), adequate for launch, not for abuse at scale.
- The legacy managed-request flow (`/internal`, `/api/requests`, SQLite) remains as internal tooling only; it has no public entry and will be archived in a later cleanup.

## 6. Live environment (not started)

As before: Live needs the Sharetribe Live plan, the Live Console config copied from Test, re-running the imports against Live with `--target live --founder-go`, and pointing production env at the Live client ID. Stripe and the ledger are independent of the Sharetribe environment.
