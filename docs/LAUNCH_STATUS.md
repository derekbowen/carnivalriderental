# Launch status (2026-10-14: Sharetribe Live cutover and first indexing cohort)

Read `PROJECT_BRIEF.md` for the model, `SHARETRIBE_LIVE_CUTOVER.md` for the migration,
`PSEO_INDEXING_PLAN.md` §7 for indexing and `ROLLBACK_2026-10-14.md` for the rollback record.
Sections 1–6 below are the history before the cutover.

## 0. State after the 2026-10-14 cutover

| Area | State | Evidence |
|---|---|---|
| Catalog backend | **Sharetribe Live "CarnivalRental"** (production env vars point at the Live Marketplace and Integration API apps) | `reports/live-migration-2026-10-14.json`, `reports/release-verification-carnivalriderental.us.json` |
| Operators | 184 active anonymous company accounts (119 with listings), unclaimed; 135 held (`C_verify_first`), 11 excluded | migration report |
| Listings | 3,714 published (7 held for privacy review, as in Test); 0 duplicates; 0 relationship drift | migration report |
| Photos | 3,503 attached and serving; 211 without a photo (159 never had a source photo, 52 failed in Test), honest placeholder | migration report |
| Privacy | 0 leaks in a full anonymous read of every listing and author; contacts only via the entitlement-checked reveal | `migrate:live -- verify` |
| Old links | `/s/{test id}` → 308 `/s/{live id}` for all 3,714; `/connect?listing={test id}` resolves to the Live listing and tier | `src/lib/inventory/test-to-live.json`, release verification |
| Pricing | $99 Event Access / $199 Ferris Wheel Event Access from `access_products`; server-side tier from the Live snapshot; verified with the app's matcher against Live | `reports/live-matching-check.json` |
| **Commerce** | **Live since 2026-10-14 ~12:53 UTC**: the founder set the live `STRIPE_SECRET_KEY` and the live webhook's `STRIPE_WEBHOOK_SECRET` in Vercel production; redeployed as `dpl_F4ymyry73CiyXybeyQ4Avt8kE5NJ`. Verified on the domain without a charge: `/connect` shows the event form ($99 / $199); a QA request for a Ferris wheel in Columbus, OH matched 13 contactable operators at $199 and a QA request for any ride matched 5 at $99, each reaching a **live** Stripe Checkout session (`cs_live_…`, left unpaid; ledger rows `pending`, 19,900 / 9,900 cents, 5 unlocks, 30 days, email `qa@carnivalriderental.us`); no operator contact on the match page before payment; the webhook rejects unsigned and forged signatures (400). Test-mode QA passes are never entitlements on the live-keyed site | `src/lib/access/stripe.ts`, `service.ts`, release verification |
| Indexing | **1,000 exact URLs** (founder: "lets index 1000 pages"): wave 1's 13 (homepage, `/rides`, `/categories/ferris-wheels`, 10 geo pages) + wave 2's 987 (4 category hubs, 165 city, 818 ride + city pages, each passing every gate with ≥ 6 contactable operators); everything else `noindex` | `PSEO_INDEXING_PLAN.md` §7–8, `src/lib/inventory/indexing-wave-2.json`, `reports/indexing-cohort.json` |
| Sitemap | `https://carnivalriderental.us/sitemap.xml`, exactly the 1,000 indexed URLs, advertised in robots.txt | release verification |
| Production deployment | `dpl_F4ymyry73CiyXybeyQ4Avt8kE5NJ` (commit `280958f` on `main`: PR #4 code + evidence, redeployed for the live Stripe keys), aliased to `carnivalriderental.us` and `www`; previous production `dpl_GVKbKxHwTRPBy6Dx73nvF9AdgNar` (same code, test keys) is the rollback candidate | Vercel |
| Production verification | 2026-10-14 after the PR #4 deploy: `scripts/verify-release.ts https://carnivalriderental.us` **1038/1038** (sitemap = exactly the 1,000 indexed URLs, every one 200 / index / self-canonical / no private data / no Offer; excluded samples incl. `/rides?category=` filter variants `noindex`; `/guides` a real 404 with its own title; `/s/{test id}` 308 → Live; checkout "opening soon" until live Stripe keys). SEO audit of the 1,000 live pages: 0 missing/duplicate/multiple titles, 0 titles > 60 chars, 0 descriptions > 160 or duplicate, 0 missing/multiple/duplicate H1s, min 503 words, median load 74 ms | `reports/release-verification-carnivalriderental.us.json` |
| Search Console | The founder submits `https://carnivalriderental.us/sitemap.xml` (2026-10-14); no Search Console connection in this project's tooling | — |

**Blockers that remain (owner actions):**
1. ~~Stripe live mode~~ done 2026-10-14 (see Commerce). The first real purchase confirms webhook delivery
   end to end (`checkout.session.completed` → pass); the two QA sessions expire unpaid within 24 h and
   their `checkout.session.expired` events should mark the QA purchases expired.
2. **Purchaser email:** `EMAILIT_API_KEY` set in Vercel production by the founder on 2026-10-14 (13:04
   UTC) and redeployed. Verified: Emailit accepts mail from `notifications@carnivalriderental.us`
   (domain approved), and a production "Lost my link" request for `qa@` issued 2 pass links and sent
   both with no send error. **`EMAIL_MODE` is still unset (= `test`)**: every email, including real
   buyers' pass emails, goes to `qa@carnivalriderental.us`. Setting `EMAIL_MODE=live` in Vercel
   production (and redeploying) is the founder's switch; outreach stays blocked regardless (no
   approved campaigns, no postal address). The key was pasted in chat: rotate it with the others.
3. **Search Console:** submit `https://carnivalriderental.us/sitemap.xml` (1,000 URLs) in the property
   verified by the `google-site-verification` TXT record on `carnivalriderental.us`, then watch coverage
   for "Crawled – currently not indexed" and "Duplicate without user-selected canonical" on ride + city
   pages (`PSEO_INDEXING_PLAN.md` §8).
4. **Sharetribe Test leaks company slugs:** Test's public listing and user `metadata` still carry
   `companyId`/`importExternalId`. Production no longer reads Test. Scrub them with the Test Integration
   credentials, or turn on "Make marketplace private" in **Test only** (never in Live).
5. **Rotations:** Supabase database password (shared in chat 2026-10-06), the Live Integration secret
   and Marketplace client secret (pasted in chat 2026-10-14), the Test Integration secret.
6. **Hosted Live web app:** `carnivalrental-9ecfo8.mysharetribe.com` still redirects to
   `www.mysharetribe.com`; operators can't log in to a hosted Live app until it is set up (claims are a
   team action anyway).

Earlier status (2026-10-12; pivot 2026-10-06, two-tier pricing 2026-10-12): read `PAID_ACCESS_ARCHITECTURE.md` for where the ledger lives and `PAID_ACCESS_IMPLEMENTATION.md` for what was built.

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
- (Superseded 2026-10-14) An earlier line here asked for "private marketplace". That was wrong: a private marketplace makes the anonymous Marketplace API return 403 and empties our catalog (section 4 records the test). Keep it **off**; privacy is enforced in the data (anonymous public fields, identity in `privateData`) and in our entitlement-checked reveal. Leave Payments empty (do not paste the Carnival Stripe keys there).

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

- Operator self-service portal is not built: operators edit through the hosted Sharetribe app or through the team. Claims and contact updates are team actions (`ops:claim`, Console).
- Contact coverage: of 319 companies, 87 have an email on file and 265 a phone; operators with no channel are never offered. Expect some reports of stale contacts; the pass has a "didn't work" button and the team can restore credits (`restoreUnlockCredit`).
- The 3,716 listing descriptions still carry the old unclaimed notice text on the hosted marketplace (it mentions the request desk). Our pages never show descriptions. A bulk rewrite is optional (`listings:enable-inquiry` can be adapted).
- Rate limiting is per server instance (in-memory), adequate for launch, not for abuse at scale.
- Vercel BotID guards the three public form endpoints (`/api/access/start`, `/api/access/checkout`, `/api/pass/recover`; `src/lib/access/bot.ts`). The forms submit with fetch (`ProtectedForm`) so BotID can attach its headers; the Stripe webhook and the Checkout return URL are not guarded. The check runs only on Vercel and fails open (logged as `[access] BotID check failed`). If real visitors report "Something went wrong" on these forms, revert the BotID commit and redeploy.
- The legacy managed-request flow (`/internal`, `/api/requests`, SQLite) remains as internal tooling only; it has no public entry and will be archived in a later cleanup.

## 6. Live environment (not started)

As before: Live needs the Sharetribe Live plan, the Live Console config copied from Test, re-running the imports against Live with `--target live --founder-go`, and pointing production env at the Live client ID. Stripe and the ledger are independent of the Sharetribe environment.
