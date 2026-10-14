# Launch status (2026-10-12; pivot 2026-10-06, two-tier pricing 2026-10-12)

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

## 4b. Two-tier pricing and launch preparation (2026-10-12)

Founder decision: **Event Access $99** and **Ferris Wheel Event Access $199** (any Ferris wheel variant:
`ferris-wheel`, `giant-ferris-wheel`, `mini-ferris-wheel`); both one event, up to 5 distinct operators,
30 days, minimum 3 contactable matches, same refund/recovery/duplicate-unlock behaviour. Fee is for
operator contact access only. Details: `docs/PAID_ACCESS_IMPLEMENTATION.md` §1b.

Implemented (code on `main`, commit `f22348d`):
- one resolver for matching and pricing (`src/lib/access/pricing.ts`); the tier is persisted with the
  request and re-derived at checkout; nothing posted by the client affects it; a missing/inactive tier
  product makes that tier unavailable (no fallback); stale quotes are expired and requoted at Stripe
  and in the ledger; refunds are judged against the purchased amount; passes bind to their own request
  and match snapshot;
- price copy everywhere reads the product rows (`accessProductsForDisplay`, `lib/access/copy.ts`):
  Ferris hub/ride-type city/listing/connect pages say "Ferris Wheel Event Access — $199"; general pages
  say "Event Access is $99. Ferris Wheel Event Access is $199."; the pay button, Stripe line item, pass
  page and pass email carry the product name and amount;
- demo records and empty-inventory messaging removed from `/rides`, category hubs, state and occasion
  pages (inventory-backed; `/s?type=` filtered search added); `ALLOW_DEMO_CONTENT=false` in Vercel
  production;
- tests: `tests/access-pricing.test.ts` (21), `e2e/pricing.spec.ts` (7) plus the updated suites.

Database: Supabase migration `access_products_ferris_wheel_v1` (2026-10-12) inserted
`prod_ferris_wheel_access_v1` / `ferris-wheel-access`, 19900 usd, 5 unlocks, 30 days, min 3, active;
`prod_event_access_v1` untouched (9900). The app's seed is `ON CONFLICT DO NOTHING`, so DB-managed
prices survive deploys. The three pre-existing test purchases (all standard, 9900, expired/refunded)
are unchanged.

Deployed: Vercel production `dpl_4FGMmY2a2yWRuf8dkh5DC9T74PN2` (commit `f22348d`), live on carnivalriderental.us since 2026-10-12. `ALLOW_DEMO_CONTENT=false` in production; `PUBLIC_INDEXING=false`, `APP_ENV=preview` unchanged (robots.txt `Disallow: /`, empty sitemap).

Verified on carnivalriderental.us in Stripe test mode (2026-10-12):

| Check | Result |
|---|---|
| Standard search (kiddie jets listing, Columbus OH) | "Event Access — $99" on /connect; 7 matches; offer and pay button $99; Stripe Checkout line item "Event Access" $99.00; purchase `67ef5d15…` paid 9900, one pass |
| Ferris category entry (`/connect?category=ferris-wheels`) | "Ferris Wheel Event Access — $199"; 13 matches; Stripe Checkout "Ferris Wheel Event Access" $199.00; purchase `46335f79…` paid 19900, one pass (`ae23a287…`, 5 unlocks, 30 days) |
| Tampering: Ferris listing posted as `rideType=carousel` with `priceCents=9900`, `productId=prod_event_access_v1` to `/api/access/start` and `/api/access/checkout` | still Ferris tier; Stripe Checkout $199.00 |
| Mini Ferris wheel (`/connect?type=mini-ferris-wheel`) | 6 matches; "Ferris Wheel Event Access" $199 offer and pay button |
| Fewer than 3 operators (giant Ferris wheel, Anchorage AK) | no offer; a forced POST to `/api/access/checkout` redirected with `error=not_sellable` |
| Duplicate entitlement | each paid session was processed by the webhook (`checkout.session.completed` → "pass created") and by the return route; exactly one pass per purchase |
| Return route | `/api/access/return` answers 303 to the pass in ~1.3 s (browser timeouts during the run were the session sandbox's proxy) |
| Public pages | no demo records or empty-inventory text on `/`, `/rides`, category hubs, city, ride-type city, listing, state and policy pages; Ferris pages show "Ferris Wheel Event Access — $199", general pages "Event Access is $99. Ferris Wheel Event Access is $199." |

Not verified on production (covered offline by `tests/access-pricing.test.ts` and `e2e/pricing.spec.ts`):
refund revocation by purchased amount (needs the Stripe connector re-authorised or the dashboard),
pass and recovery emails (no email key in production), giant Ferris wheel checkout where ≥ 3
operators exist (offline: Anaheim CA). The tamper run left one unpaid $199 session (`8fc66d26…`); Stripe
expires it after an hour and the webhook marks it expired.

Still owner-only (nothing in this session could complete them):
- **Sharetribe Live**: not verifiably active; no Live credentials exist anywhere in the project. Runbook
  prepared: `docs/SHARETRIBE_LIVE_CUTOVER.md` (proof of activation → config copy → imports → snapshot
  regeneration → production credentials → verification).
- **Pass emails in production**: add `RESEND_API_KEY` (value in `.env.local`; the Resend account's
  `carnivalriderental.us` domain is verified for sending) to Vercel production, keep `EMAIL_MODE`
  unset (= test → `qa@carnivalriderental.us`), redeploy, then open an emailed `/pass/open?t=…` link in a
  private window. The fresh-browser path is covered by `e2e/pricing.spec.ts`.
- **Stripe live account and live webhook**: not verified (the Stripe connector needs re-authorisation
  in the claude.ai connector settings). Production stays on `sk_test` and the sandbox webhook
  `we_1UNUzEIdwlV6NJQtbdNVGtYu`.
- **Credential rotations**: Supabase database password (shared in chat on 2026-10-06), Sharetribe
  Marketplace client secret, Test Integration secret after the Live cutover.
- **Indexing**: still off everywhere (`PUBLIC_INDEXING=false`, `APP_ENV=preview`, pilot disabled);
  release checklist prepared in `docs/PSEO_INDEXING_PLAN.md` §5b.

## 5. Known gaps (not hidden)

- Operator self-service portal is not built: operators edit through the hosted Sharetribe app (which should be private) or through the team. Claims and contact updates are team actions (`ops:claim`, Console).
- Contact coverage: of 319 companies, 87 have an email on file and 265 a phone; operators with no channel are never offered. Expect some reports of stale contacts; the pass has a "didn't work" button and the team can restore credits (`restoreUnlockCredit`).
- The 3,716 listing descriptions still carry the old unclaimed notice text on the hosted marketplace (it mentions the request desk). Our pages never show descriptions. A bulk rewrite is optional (`listings:enable-inquiry` can be adapted).
- Rate limiting is per server instance (in-memory), adequate for launch, not for abuse at scale.
- The legacy managed-request flow (`/internal`, `/api/requests`, SQLite) remains as internal tooling only; it has no public entry and will be archived in a later cleanup.

## 6. Live environment (not started)

As before: Live needs the Sharetribe Live plan, the Live Console config copied from Test, re-running the imports against Live with `--target live --founder-go`, and pointing production env at the Live client ID. Stripe and the ledger are independent of the Sharetribe environment.
