# Paid contact model: can we keep Sharetribe and drop its economics? (audit, 2026-10-06)

> **Superseded in part (same day).** The founder adopted the model and corrected one proposal: the Supabase listing/operator mirror in §5–§6 was **not** built. Sharetribe stays the only catalog; the ledger holds only purchases, passes and unlocks. See `PAID_ACCESS_ARCHITECTURE.md` (decision) and `PAID_ACCESS_IMPLEMENTATION.md` (what shipped).

Status: **audit only, nothing changed.** Sources: a read-only crawl of this repo at `8119e06`+ (every Sharetribe and Stripe touchpoint, with line numbers), the live Test Console config (`contract/snapshots/carnivalrental-test-2026-10-06.json`: 3,716 published listings, 189 users, 18 test transactions), and Sharetribe's current documentation (links inline; checked 2026-10-06, after Sharetribe's 1 October 2026 pricing change).

---

## 1. Executive conclusion

**KEEP SHARETRIBE** as the operator account, listing, photo and search layer. Stop using its transaction and payment layer. Build the paid access pass (Stripe Checkout, entitlements, contact reveal) in our own application on Supabase. Mirror the one thing the paywall needs that must never be public, the listing → operator mapping and the operators' contact records, into Supabase from day one.

The architecture you described is supported and sensible:

> Operators keep using Sharetribe to create and manage their listings but never connect Stripe. Customers pay us directly for an access pass. Our application reveals operator contact information after payment. The rental happens offline.

Why it holds up:

1. **Sharetribe documents this use.** Listings publish without a Stripe account; the only Stripe-before-publish check is in Sharetribe's own template front end (which we don't use) and a Console toggle. Sharetribe's FAQ says "You can absolutely use Sharetribe without using Stripe", and its Free-messaging listing type is described as for marketplaces where payment "happens off-platform". Our `operator-ride-rental` listing type is already Free messaging (`default-inquiry`), with no payout-details field (§3, Q1, Q2, Q12).
2. **Private contact data is safe where it already is.** User and listing `privateData` never appear in any public Marketplace API resource; only the owner and our server (Integration API) can read them (Q8, Q9). The repo's own guards (`inventory:validate`, anonymisation, the identity rule) already keep identity off the public pages.
3. **Almost nothing breaks.** The only deployed feature that needs a Sharetribe transaction is the customer request form (inquiry process). Payment code exists only in two QA scripts and `ops:bookable`. Disabling Stripe Connect and bookings breaks nothing a customer can reach (§2, §6).
4. **Rewriting is the expensive option.** 3,716 listings, 189 accounts, 20 import/ops scripts, two data contracts, the anonymisation and claim tooling, the image pipeline and the search layer are built on Sharetribe. Option C would rebuild all of that to save roughly $200–260/month.
5. **Pricing no longer punishes zero transactions.** Since 1 October 2026 Sharetribe bills a subscription plus API usage credits, "No transaction fees" (Q7). A directory with no transactions pays the Live plan ($259/month or $199/month annual) plus credits.

Conditions attached to this conclusion (all in §9):

- **The business brief must be rewritten first.** `docs/PROJECT_BRIEF.md` and `CLAUDE.md` currently say the business "is *not*: a lead-selling site, a directory that hides who fulfils the event". The paid contact model is exactly that. This is a founder decision, not an engineering one.
- **Operators must not use the hosted Sharetribe web app as their public face.** It would show a claimed operator's display name, bio and description to anyone, which defeats the paywall. Either make the hosted marketplace private in Console (login + operator approval) and give operators our own small portal, or accept that leak. The audit recommends the portal (Phase 3).
- **Contact data coverage is thin.** Of 319 imported companies, 87 have an email, 265 a phone, most a website. Operators with no usable contact must be excluded from unlocks or the pass is worthless.
- **Re-evaluate at Phase 5.** With the mirror in place, Sharetribe's remaining value is operator login, the listing editor and image hosting. If the Live plan plus image-CDN credits ever exceeds the cost of running those on Supabase, retirement is cheap because the URLs, IDs and the mirror are already ours.

Option B (full hybrid mirror with dual writes) is **not** recommended as a goal: it doubles the write paths for no customer benefit. The one-way, server-only mirror in Option A is the only mirroring the paywall needs. Option C is **not** recommended now; §4 estimates it.

---

## 2. Current architecture map (where Sharetribe is used today)

No Sharetribe SDK is installed; every call is plain `fetch` against three hosts: Auth (`flex-api…/v1/auth/token`), Marketplace API (`flex-api…/v1/api`), Integration API (`flex-integ-api…/v1/integration_api`), plus the asset CDN and the hosted marketplace URL.

### 2.1 Clients and credentials

| Module | APIs | Credential |
|---|---|---|
| `scripts/lib/sharetribe-client.ts` (7–10, 32–60, 63–75) | shared wrapper for every write script; rate-limit retry | Integration client ID + secret (`integ`), or client ID only (`public-read`) |
| `src/lib/integrations/sharetribe.ts` (22–35, 38, 64, 79–101) | Integration read for the internal console health check; `integrationPost` "used only by approved write scripts" | Integration secret |
| `src/lib/catalog/source.ts` (13–14, 28–49) | Marketplace `listings/query` for the legacy `managed-ride-rental` catalog, ISR 60 s | client ID only |
| `src/lib/catalog/operator-search.ts` (126–176, 212–222) | Marketplace `listings/query` (nearest-first, `pub_listingType=operator-ride-rental`, `include=images`, author deliberately **not** included at 150–153) and `listings/show` | client ID only |
| `src/lib/sharetribe/browser.ts` (24–33, 49–84) | **in the browser:** `current_user/create`, password-grant login, `transactions/query`, `transactions/initiate`, `messages/send` | client ID; the customer's password never touches our server |
| `scripts/inventory-export.ts` (36–42) | Marketplace `listings/query` → `src/lib/inventory/rides.json` | client ID only |
| `scripts/request-desk.ts` | Integration reads; house-account password grant for `messages/*` | Integration secret + `HOUSE_ACCOUNT_PASSWORD` |
| `scripts/operator-claim.ts`, `operator-anonymize.ts`, `company-import.ts`, `listing-import.ts`, `photo-import.ts`, `listing-enable-inquiry.ts`, `operator-bookable.ts`, `qa-operator.ts` | Integration writes (users, listings, images, approve) | Integration secret |
| `scripts/qa-payment.ts`, `scripts/stripe-probe.ts` | booking transitions, `stripe_account/*`, PaymentIntents, Stripe API | the **only** users of `SHARETRIBE_CLIENT_SECRET` (token exchange → `trusted:user`) and `STRIPE_SECRET_KEY` |
| hosted marketplace | `marketplaceListingUrl` (`operator-search.ts` 225–229) for "Book this ride"; inbox link `${marketplaceUrl}/order/<tx>` (`RideRequestForm.tsx` 92) | — |

### 2.2 Users and identity

- Company accounts are imported by `npm run import:companies` (`src/lib/imports/company-accounts.ts`). **Contact data is already in Sharetribe user `privateData`:** `legalEntityName, owners, contactName, contactEmail, hqStreet, hqZip, hqLat, hqLng, cwId, facebook, instagram, …` (53–73, uploaded by `buildPayload` 260–283, minus `researchNotes` and `sources`). Phone is in `protectedData.phoneNumber` (51). Public identity (`companyName, hqCity, website, otherOperations`) was moved into `privateData` by `ops:anonymize` and the display name replaced with "Carnival Ride Rental operator". (`scripts/request-desk.ts` 115 wrongly claims contact email is kept out of Sharetribe.)
- Claim (`scripts/operator-claim.ts`): verifies the email is on the company's website domain (or a founder-recorded manual check), resets the password, changes the email, restores `privateData.originalProfile` to the public profile and sets `metadata.claimStatus=claimed`. **After a claim the company name, bio and original listing descriptions are public again on the hosted marketplace** (112–121).
- Customers sign up through `browser.ts` only to send an inquiry.
- Metadata read by code but written only in Console: `rideApproved`, `priceApproved`. `metadata.bookable` is written only by `ops:bookable`.

### 2.3 Listings

- Two listing types in Console (snapshot 2026-10-06): `daily-booking` (default-booking, unit day, payoutDetails on; only the QA listing used it) and **`operator-ride-rental` (default-inquiry/release-1, unit `inquiry`; default fields description, images, title, location, price; no payoutDetails)**.
- Contracts: `contract/operator-listing-contract.json` (public fields `rideClass, manufacturer, rideModel, minRiderHeightIn, riderRules, homeState, serviceStates, footprint*/rideHeightFt`; metadata `claimStatus, importBatch, companyId, importExternalId, bookable, rideApproved, requestDesk, qa, priceApproved`; geolocation = HQ rounded to 0.1°) and the legacy `contract/listing-contract.json` (`managed-ride-rental`, `default-negotiation` scaffold, never approved).
- Import: `listing-import.ts` → Integration `listings/create` in `pendingApproval`; `photo-import.ts` → `images/upload`, `listings/update`, `listings/approve`. Provenance in `privateData.sourceImageUrl` etc.

### 2.4 Transactions, messaging, Stripe

- Customer request form (`src/components/request/RideRequestForm.tsx`, `src/app/request/page.tsx` 94, 110): `transactions/initiate` with `transition/inquire-without-payment` on the ride's listing (claimed operator) or on the request-desk listing (unclaimed), then `messages/send`. Transaction `protectedData` carries the event brief. This is the **only runtime feature that needs a transaction**, and it takes no payment.
- Request desk: one listing owned by the house account (`REQUEST_DESK_LISTING_ID`), worked by `desk:list|show|reply`.
- Booking and payment: `default-booking` transitions, `stripe_account/create`, PaymentIntents exist **only** in `scripts/qa-payment.ts` and `scripts/stripe-probe.ts`. The site has **no Stripe SDK, no publishable key, no Checkout** (the QA scripts scrape `pk_test_` from the hosted marketplace HTML).
- Bookability: `bookingBlockers` (`src/lib/operators/claim.ts` 61–70) requires claimed + `rideApproved` + `stripeConnected` + payouts/charges enabled + price + a decided commission; `ops:bookable` writes `metadata.bookable`. Since `customerServiceFeePct` is `null`, nothing can be bookable today. "Book this ride" (`RideResult.tsx` 37, `s/[id]/page.tsx` 106) therefore never renders.
- Legacy managed-request flow (`src/lib/requests/*`, SQLite, `/api/requests`, `/requests/[reference]`, `/internal/*`): no Sharetribe calls; demo payments only (`paymentsMode()` throws for anything but "demo").
- Console: provider commission 10% (undecided, meaningless without transactions); Stripe keys in the Test Console belong to an old account; no user types; no listing categories.

### 2.5 pSEO data sources (build time vs runtime)

| Route | Reads Sharetribe? |
|---|---|
| `/[state]/[slug]` (1,580 city pages), `/[state]/[slug]/[ride]` (15,931), `/directory`, `/directory/[state]` | **No.** Build-time JSON only (`src/lib/inventory/rides.json`, `index-eligible.json`, `cities.json`). |
| `/rides`, `/rides/[ride]`, `/events`, `/operators` | No (local content; `/events/[occasion]` and `/categories/*` read the legacy catalog via ISR). |
| `/[state]` | ISR 600: legacy `getCatalog()` plus a runtime `NearbyRides` search. |
| `/` and `/s` | **Runtime** Marketplace API (`force-dynamic`): showcase and nearest-first search. |
| `/s/[id]` | ISR 60: `listings/show`, falling back to the snapshot. |
| `/request` | Runtime `listings/show` + browser Sharetribe calls. |
| `sitemap.ts` | ISR 600: legacy catalog + inventory routes. |

Operator identity never reaches the pSEO layer: the snapshot has no author IDs, and `inventory:validate` fails the export on any company, contact or owner name or domain from the private workbook.

---

## 3. Sharetribe feasibility findings (current docs, cited)

Every answer below is from Sharetribe's documentation as of 2026-10-06. "Not stated" means the docs are silent.

| # | Question | Verdict | Evidence |
|---|---|---|---|
| 1 | Publish/manage listings without Stripe Connect? | **Supported** | `own_listings/create` and `own_listings/publish_draft` list only a permission 403 as a failure; body params have no Stripe precondition ([create](https://www.sharetribe.com/api-reference/marketplace.html#create-listing), [publish](https://www.sharetribe.com/api-reference/marketplace.html#publish-draft-listing)). "Payout details required before publishing" is a listing-type toggle in Console ([help](https://www.sharetribe.com/help/en/articles/8940366-what-are-payout-details#h_53357dd6c0)); Free-messaging providers "do not need to add their payout details" ([listing types](https://www.sharetribe.com/help/en/articles/8413295-how-listing-types-work#h_50a2864b44)). The Stripe-before-publish check lives in the Web Template's `EditListingWizard` ([removing Stripe](https://www.sharetribe.com/docs/how-to/payments/removing-stripe-and-payments/)). Not stated: an explicit "the server never checks Stripe on publish" sentence. |
| 2 | Can we stop using transactions? | **Supported** (a listing type must still name a process; "no process" is not an option) | A process alias is used only by `transactions/initiate`; create endpoints take none. Each listing type has exactly one process ([config](https://www.sharetribe.com/docs/template/configuration/variables/#listing-type-configurations)); Free messaging is "the only transaction process without online payment" and is for marketplaces where payments "happen off-platform" ([help](https://www.sharetribe.com/help/en/articles/8413200-what-are-listing-types#h_f4b91d803d)). Nothing obliges anyone to initiate one. |
| 3 | Sharetribe purely as a listing/user database (headless)? | **Supported** | "because of its headless architecture… build your own UI on top of Sharetribe's Marketplace API" ([intro](https://www.sharetribe.com/docs/introduction/), [custom client](https://www.sharetribe.com/docs/introduction/introduction-to-customizing/#custom-developing-with-your-own-client-application)). |
| 4 | Search APIs usable without transactions? | **Supported** | `listings/query` filters: `authorId`, `ids`, `keywords`, `origin`, `bounds`, `pub_*`/`meta_*` with search schemas; sort by `createdAt`, `price`, `pub_*`, `meta_*` ([params](https://www.sharetribe.com/api-reference/marketplace.html#query-parameters-2)). Limits: `perPage` 1–100; results beyond 10,000 need partitioning by `createdAtStart/End` ([pagination limits](https://www.sharetribe.com/api-reference/marketplace.html#pagination-limits)). We already sidestep this with the snapshot. |
| 5 | Owners never payment providers? | **Supported** | `stripeAccount` is an optional relationship; Stripe is enforced only at transaction time (`transaction-missing-stripe-account`, 409) ([errors](https://www.sharetribe.com/api-reference/api-error-codes.html#list-of-error-codes)). |
| 6 | Avoid payout onboarding in our UI? | **Supported** | We own the UI; nothing server-side blocks publish (Q1). Connect onboarding "can't be disabled if you want to process payments" ([help](https://www.sharetribe.com/help/en/articles/8857191-how-adding-payout-details-works-with-stripe#h_a34c4da0dd)) applies only to on-platform payments. |
| 7 | Plan/pricing restrictions? | **Acceptable; no transaction-volume dependence** | Since 1 Oct 2026 two plans: Build $39/month (Test API access) and Live $259/month or $199/month annual, "No transaction fees", 1M credits/month; usage above that from $0.07 per 1,000 credits ([transition](https://www.sharetribe.com/help/en/articles/17106763-legacy-plans-and-pricing-transition-timeline), [pricing](https://www.sharetribe.com/pricing/), [credits](https://www.sharetribe.com/docs/introduction/pricing/)). A custom front end in Live needs the Live plan ([help](https://www.sharetribe.com/help/en/articles/8496118-how-much-does-it-cost-to-customize-your-marketplace-with-code#h_a48b4602e7)). Credit costs that matter to us: `listings/query` 5, `listings/show` 1, `events/query` 5, **image CDN 1.5 per request + 10,000 per GB + 340 per unique image per month** ([credit usage](https://www.sharetribe.com/docs/references/api-credit-usage/)). Hold plan $49/month is read-only. |
| 8 | Private contact fields safe in Sharetribe? | **Yes** | Public `listing` resource has `publicData` and `metadata` only; `ownListing` adds `privateData` ([listing](https://www.sharetribe.com/api-reference/marketplace.html#listing-resource-format), [ownListing](https://www.sharetribe.com/api-reference/marketplace.html#ownlisting-resource-format)). Public `user` has displayName, bio, publicData, metadata; email, protectedData and privateData appear only on `currentUser` and the Integration API ([users](https://www.sharetribe.com/api-reference/marketplace.html#users), [integration user](https://www.sharetribe.com/api-reference/integration.html#user-resource-format)). User protectedData reaches a counterparty only through a transaction-process action ([user extended data](https://www.sharetribe.com/docs/concepts/extended-data/user-extended-data/)); with no transactions, never. |
| 9 | Should contacts live in Supabase instead? | **Supabase as the source of truth; Sharetribe privateData as an import copy** | Safety is equal; the difference is operations. The paywall needs per-operator verification status, an audit trail, versioning and fast relevance queries. Sharetribe privateData is a free-form JSON blob read one user at a time at 1 credit each, with no query by key. Keep the imported copy where it is; make Supabase authoritative (§5). |
| 10 | Can our server find a listing's owner and their contact after purchase? | **Supported** | Integration `listings/show?include=author` and `users/show` (by id or email) return email, protectedData, privateData ([listing relationships](https://www.sharetribe.com/api-reference/integration.html#listing-relationships), [show user](https://www.sharetribe.com/api-reference/integration.html#show-user)). The Integration key is all-or-nothing and server-only ([auth](https://www.sharetribe.com/docs/concepts/users-and-authentication/users-and-authentication-in-sharetribe/#authentication-in-sharetribe)). With the mirror (§5) the hot path doesn't even call Sharetribe. |
| 11 | Headless catalog + account system supported? | **Supported** | Q3; SDKs: [Marketplace](https://sharetribe.github.io/flex-sdk-js/calling-the-api.html), [Integration](https://sharetribe.github.io/flex-integration-sdk-js/calling-the-api.html). Our plain-`fetch` clients are fine. |
| 12 | Existing listings/users if we stop transacting? | **Retained** | Listings persist (delete only in Console; permanent) ([lifecycle](https://www.sharetribe.com/docs/concepts/listings/listings-overview/#deleted)). Transaction processes cannot be deleted ([process](https://www.sharetribe.com/docs/concepts/transactions/transaction-process/#start-creating-your-own-transaction-process)); unused ones are inert. Changing a listing type's settings leaves existing listings "open with the previous settings" ([help](https://www.sharetribe.com/help/en/articles/8413295-how-listing-types-work#h_ac3736d66b)). `publicData.transactionProcessAlias` is just data our client ignores. |
| 13 | Which Console configuration becomes unnecessary? | — | Stripe keys, commission, minimum transaction size, the `daily-booking` type, transaction email templates, the request-desk listing. Keep: listing types (`operator-ride-rental`), listing fields, search schema, listing approval, access control. Details §8. |
| 14 | Does Sharetribe force Stripe at marketplace level? | **No** | Stripe is "mandatory if you want to have online payments" ([go live](https://www.sharetribe.com/help/en/articles/8418337-how-to-set-up-your-live-marketplace)); "Do I need to set up a Stripe account to start using Sharetribe? No" ([help](https://www.sharetribe.com/help/en/articles/8671710-how-payments-with-stripe-work#h_0766d1c01d)); "You can absolutely use Sharetribe without using Stripe" ([FAQ](https://www.sharetribe.com/docs/concepts/payments/payments-overview/#can-i-use-sharetribe-and-not-use-stripe)). Not stated: a named "no payments" mode. |
| 15 | Rate limits / cost as an inventory backend for thousands of SEO pages? | **Manageable because pSEO already reads a snapshot** | Live environments are not rate-limited except one Integration endpoint ([rate limiting](https://www.sharetribe.com/docs/concepts/api-sdk/rate-limiting/)); test/dev: 60 queries and 30 commands per minute per IP ([limits](https://www.sharetribe.com/api-reference/marketplace.html#rate-limits)). Cost is credits, not limits: the 17,500 pSEO pages make **zero** runtime calls; `/`, `/s` and `/s/[id]` do (5 and 1 credits, cached 60 s). The image CDN is the real line item: 3,714 unique images × 340 ≈ 1.26M credits/month if all are viewed, plus 1.5/request and 10,000/GB. At 100k monthly page views showing 12 images each, expect roughly 1.5–3M credits ≈ $35–140/month over the included 1M. Mirroring images to our own storage (Phase 4) removes it. Authentication for operators without the hosted app: password grant, `token_exchange`, and OpenID Connect "login with custom IdP" are all documented ([auth](https://www.sharetribe.com/api-reference/authentication.html#issuing-tokens), [OIDC](https://www.sharetribe.com/docs/how-to/users-and-authentication/enable-open-id-connect-login/)). User creation is Marketplace API only (`current_user/create`); the Integration API cannot create users. |
| 16 | Events API for a mirror? | **Supported (polling, no webhooks)** | `events/query` by `startAfterSequenceId`, 100 per call, event types `listing/created|updated|deleted`, `user/*`, with full resource and `previousValues`; retention 90 days in Live ([events](https://www.sharetribe.com/docs/references/events/), [polling](https://www.sharetribe.com/docs/how-to/events/reacting-to-events/#polling-events-continuously-using-sequence-ids)). |
| ToS | Charging customers outside Sharetribe? | **No documented prohibition** | Terms mention no commission owed to Sharetribe and no off-platform restriction ([terms](https://www.sharetribe.com/terms)); the docs discuss own-gateway and off-platform flows and only advise legal/accounting review ([3rd-party gateway FAQ](https://www.sharetribe.com/docs/how-to/payments/how-to-integrate-3rd-party-payment-gateway/#can-i-just-accept-all-payments-to-my-own-bank-account-and-pay-my-providers-manually)). Confirm with Sharetribe support in writing before Live. |

---

## 4. The three options

### Option A: keep Sharetribe for listings (recommended)

Sharetribe keeps operator accounts, listing CRUD, photos, attributes, ownership and search. Supabase holds purchases, passes, unlocks, audit, the server-only listing → operator mirror and the authoritative operator contacts. Stripe takes the customer's $99 into our account with ordinary Checkout, no Connect.

- Clean: yes. Everything Sharetribe keeps doing is documented and already working in this repo. Everything new is isolated in our app with no Sharetribe dependency on the hot path.
- Sustainable: yes, with two watch items: the Live plan fee and image-CDN credits (Phase 4 mirrors images), and the hosted web app's public operator profiles (Phase 3 portal or Console private mode).
- Effort: paid-unlock system ≈ 2 weeks; cleanup of transaction code ≈ 2–3 days; operator portal ≈ 1–2 weeks.

### Option B: hybrid mirror as a stepping stone

Dual-write operators and listings to Sharetribe and Supabase, with one as source of truth.

- Safest source-of-truth model if you did this: **Sharetribe writes first** (operator edits go through `own_listings/*`, which validates and hosts images), then the Events API poller updates Supabase. Supabase-first with a sync back into Sharetribe would reimplement Sharetribe's listing editor and image upload for no benefit.
- Verdict: don't adopt dual writes as a goal. Adopt only the **one-way, server-only mirror** (listings → operator map, contacts, later images), which Option A already includes, because the paywall needs it for relevance matching and audit. That mirror is also what makes Option C cheap later.

### Option C: remove Sharetribe

Move operators, listings, images, attributes, search and accounts to Supabase.

| Area | Retain | Rewrite |
|---|---|---|
| pSEO pages, templates, inventory gates, directory, sitemap, structured data, match rules, ride-type copy | all (they read local JSON) | export script source |
| `src/lib/inventory/*`, `reports/*` scripts | yes | `inventory-export.ts` (read Postgres instead) |
| `/s` search and `/s/[id]` detail | UI | data access (`operator-search.ts`), image URLs |
| Import pipeline: companies, listings, photos, anonymise, claim, enable-inquiry (≈ 20 scripts, ledgers, contracts, `contract:diff`, `sharetribe:inspect`) | ledgers as history | all of it |
| Operator auth (signup, email verification, password reset), listing editor, image upload/variants/CDN | — | Supabase Auth + Storage + a full editor (the part Sharetribe's hosted app gives for free) |
| Data: 3,716 listings, 189 users, 3,503 images | export via Integration API | migration job + verification |

Estimate: 4–6 engineering weeks before any new feature, against ≈ $200–260/month saved. Risk: a large migration with no customer-visible gain, during which the paid product isn't being built. Not recommended now; reconsider at Phase 5 when the mirror has already done most of the work.

---

## 5. Proposed architecture

```
                         GOOGLE / DIRECT
                               │
                               ▼
   ┌───────────────────────────────────────────────────────────────┐
   │  Next.js on Vercel (one deployment; no Integration secret in  │
   │  any page or client bundle)                                   │
   │                                                               │
   │  PUBLIC PAGES (build-time JSON, 17,500 pSEO + /s + /s/[id])   │
   │    rides, photos, specs, class, home state, distance, city,   │
   │    event fit, related rides.  Never: operator identity.       │
   │    CTA: "Connect with operators" ─────────────────────┐       │
   │                                                       ▼       │
   │  PASS FLOW (dynamic, no-store, noindex)                       │
   │    /connect   event details form ──► POST /api/checkout       │
   │    /pass/[id] relevant operators (anon) ► unlock ► contact    │
   │                                                               │
   │  OPERATOR PORTAL (Phase 3) /account/*                         │
   │    login ► claim company ► rides ► photos ► states ► contact   │
   └───────┬───────────────────┬───────────────────────┬───────────┘
           │ Marketplace API   │ service role          │ Checkout +
           │ (client ID; user  │ (server only)         │ webhooks
           │  token for own_*) │                       │
           ▼                   ▼                       ▼
   ┌───────────────┐   ┌──────────────────────┐   ┌──────────────┐
   │  SHARETRIBE   │   │  SUPABASE (Postgres) │   │   STRIPE     │
   │  accounts     │   │  customers, events   │   │  our account │
   │  listings     │──►│  plans, purchases    │   │  no Connect  │
   │  photos/CDN   │   │  access_passes       │   │  Checkout    │
   │  search       │   │  unlocks (audit)     │   │  webhooks    │
   │  approval     │   │  operators, listings │   │  refunds     │
   │               │   │   (server-only mirror│   └──────────────┘
   │  NOT USED:    │   │  operator_contacts   │
   │  transactions │   │   (authoritative)    │
   │  Stripe Connect   │  stripe_events       │
   └───────┬───────┘   └──────────┬───────────┘
           │ Integration API      ▲
           │ (scripts + poller)   │
           └──── mirror: export job now, Events API poller later ───┘
```

Data flow rules:
- Public pages and bundles are built from `rides.json`, which carries no operator identity (unchanged).
- The listing → operator mapping and contact records exist only in Supabase and are read only by server code holding the service-role key.
- Sharetribe's transaction layer is never called. The request desk, inquiry form and hosted-inbox links are removed (Phase 2).

---

## 6. Database model (Supabase / Postgres)

Smallest model that supports a $99 event pass, 5 operator unlocks, refunds, webhooks, audit and future plans. All tables have RLS **enabled with no policies**: only the service-role key (server) reads or writes. No Supabase client runs in the browser.

```sql
-- Who bought
customers        (id uuid pk, email citext unique, created_at, last_seen_at)
magic_links      (token_hash text pk, customer_id fk, expires_at, used_at)

-- What they bought it for
events           (id uuid pk, customer_id fk, event_date date, city, state char(2), zip,
                  lat, lng, ride_types text[], guests int, notes text, created_at)

-- Pricing lives in data, not code
plans            (id text pk,              -- 'event-access-5'
                  name, price_cents int, currency char(3), unlock_limit int,
                  validity_days int, stripe_price_id text, active bool, created_at)

-- Money
purchases        (id uuid pk, customer_id fk, event_id fk, plan_id fk,
                  stripe_checkout_session_id text unique, stripe_payment_intent_id text unique,
                  amount_cents int, currency char(3),
                  status text check (status in ('pending','paid','failed','refunded',
                                                'partially_refunded','disputed')),
                  paid_at, refunded_at, refund_cents int default 0, created_at, updated_at)
stripe_events    (id text pk,              -- Stripe event id → idempotency
                  type, received_at, processed_at, purchase_id fk null, payload jsonb)

-- Entitlement
access_passes    (id uuid pk, purchase_id fk unique, customer_id fk, event_id fk,
                  unlock_limit int,        -- copied from plan at purchase time
                  unlocks_used int default 0,
                  status text check (status in ('active','revoked','expired')),
                  expires_at, created_at)

-- Supply mirror (server-only, one-way from Sharetribe)
operators        (id uuid pk, sharetribe_user_id text unique, claim_status text,
                  home_state char(2), home_lat, home_lng, listing_count int,
                  contactable bool,        -- derived: at least one usable contact channel
                  active bool, synced_at)
listings         (id text pk,              -- Sharetribe listing id (= /s/[id] URL)
                  operator_id fk, title, ride_type, ride_class, home_state,
                  lat, lng, state text, photo_url, synced_at)
operator_contacts(operator_id pk fk, company_name, contact_name, email, phone, website,
                  hq_city, hq_state, source text check (source in ('import','operator','team')),
                  verified_at, updated_by, updated_at)

-- Audit: what was revealed, to whom, when
unlocks          (id uuid pk, pass_id fk, operator_id fk, revealed_at,
                  contact_snapshot jsonb,  -- exactly what was shown
                  ip_hash text, user_agent text,
                  unique (pass_id, operator_id))   -- re-viewing is free, never double-counted
```

Indexes: `purchases(stripe_checkout_session_id)`, `purchases(customer_id)`, `access_passes(customer_id, status)`, `unlocks(pass_id)`, `listings(operator_id)`, `listings(ride_type, state)` plus a geo index (`earthdistance` or PostGIS) on `listings(lat, lng)`, `operators(contactable, active)`, `magic_links(expires_at)`.

Security notes:
- `operator_contacts.email/phone` can be wrapped with pgsodium/`pgcrypto` encryption at rest; the service role decrypts. Worth doing because this table is the whole product.
- `unlocks` counts against the pass inside one transaction (`select … for update` on the pass) so two rapid clicks can't exceed the limit.
- `stripe_events.id` is the idempotency key; a duplicate delivery is a no-op.
- Nothing in these tables is ever serialised into a page before the entitlement check; the pass page renders anonymised cards and only unlocked contacts, with `Cache-Control: private, no-store` and `noindex`.
- Changing price or limits = a new `plans` row; passes copy `unlock_limit` at purchase so old passes keep their terms.

Relevance ("up to 5 relevant operators"): from `events(ride_types, lat, lng)` select `listings` within 200 mi with matching `ride_type`, group by `operator_id`, keep `contactable and active`, rank by distance, matching-ride count and claim status. Operators without any contact channel are never offered.

---

## 7. Code impact

| Status | File / module | Change |
|---|---|---|
| KEEP | `src/lib/inventory/*`, `src/components/InventoryPages.tsx`, `src/app/[state]/[slug]/**`, `src/app/directory/**`, `scripts/inventory-*.ts`, `scripts/pseo-*.ts`, `src/lib/seo/routes.ts`, `sitemap.ts`, `robots.ts` | pSEO layer is untouched (URLs unchanged). |
| KEEP | `scripts/company-import.ts`, `listing-import.ts`, `photo-import.ts`, `operator-anonymize.ts`, `src/lib/imports/*`, `contract/operator-listing-contract.json`, `scripts/lib/sharetribe-client.ts`, `sharetribe-inspect.ts`, `contract-diff`, `src/lib/integrations/*` | Listing/account pipeline stays. Fix the stale `notApproved` note (contract line 17). |
| KEEP | `src/lib/catalog/operator-search.ts` (search, cards, facts, image handling) | Remove `bookable`, `marketplaceListingUrl` and the price gate's reliance on unitType (MODIFY-lite). |
| MODIFY | `src/components/search/RideResult.tsx`, `src/app/s/[id]/page.tsx`, `src/components/InventoryPages.tsx` CTA/FAQ copy, `src/components/RequestCta.tsx`, `src/app/page.tsx`, `src/app/[state]/page.tsx`, `CategoryHub.tsx`, `OccasionPage.tsx`, `CityPage.tsx` | "Request a quote" → "Connect with operators" / "Unlock operator contact"; remove "Book this ride", the unclaimed-desk disclosure and booking FAQs; `paths.requestRide(id)` → `paths.connect({ listing })`. |
| MODIFY | `src/app/request/page.tsx` | Becomes `/connect` (keep `/request` as a 301): event form → Checkout. Drop `RideRequestForm` routing to Sharetribe. |
| MODIFY | `src/lib/seo/structured-data.ts` | The site `Service` node's `serviceType` ("carnival ride rental", provider = us) becomes misleading; change to an operator-matching/directory service or drop it. Add `Product` + `Offer` for the pass **only** on `/connect`. Keep CollectionPage, BreadcrumbList, ItemList, FAQPage. |
| MODIFY | `src/app/operators/page.tsx`, `src/lib/operators/program.ts`, footer strip (`SiteChrome.tsx`), `EnvBanner` | Operator promise becomes "list free, no payouts, you deal directly with customers"; remove Stripe/payout copy; `OPERATOR_PROGRAM` loses commission fields. |
| MODIFY | `scripts/operator-claim.ts` | Drop `bookable:false` and the "set payout details" message; add Supabase `operators`/`operator_contacts` upsert. Later: self-serve claim in the portal using the same domain check (`src/lib/operators/claim.ts` 32–43). |
| MODIFY | `src/lib/operators/claim.ts` | Remove `bookingBlockers`; keep `INQUIRY_ALIAS` only until Phase 2 rewrites listings' alias (optional). |
| MODIFY | `src/lib/pricing/public-price.ts`, `policy.ts` | Price slot is informational only ("from $X per day, operator-approved") or removed; no transaction semantics. |
| MODIFY | `docs/PROJECT_BRIEF.md`, `CLAUDE.md`, `docs/OPERATOR_MARKETPLACE.md`, `LAUNCH_STATUS.md`, `ARCHITECTURE_SPLIT.md` | Founder rewrite of the model; the "ATM" becomes the pass system, not Sharetribe payments. |
| DELETE | `src/lib/sharetribe/browser.ts`, `src/components/request/RideRequestForm.tsx`, `scripts/request-desk.ts` + `REQUEST_DESK_LISTING_ID`, `scripts/listing-enable-inquiry.ts` (after Phase 2), the request-desk listing (close in Console) | Customer inquiries through Sharetribe end. |
| DELETE | `scripts/operator-bookable.ts`, `scripts/qa-payment.ts`, `scripts/stripe-probe.ts`, `STRIPE_SECRET_KEY` for Connect checks, `SHARETRIBE_CLIENT_SECRET` (only those scripts used it), `metadata.bookable`, `marketplaceListingUrl` | All Connect/booking code. |
| DELETE (or archive) | Legacy managed flow: `src/lib/requests/*` state machines (`confirmBooking`, demo payments), `/requests/[reference]`, `/api/requests`, `EventRequestForm.tsx`, `scripts/catalog-seed.ts`, `catalog-search-proof.ts`, `contract/listing-contract.json` processBinding, `data/preview-catalog.json` (unreferenced) | The brief says it's an internal fallback; the paid model makes it dead weight. Keep `/internal/operators` (applications). |
| NEW | `supabase/migrations/0001_paid_access.sql`, `src/lib/db/*` (service-role client) | §6 schema. |
| NEW | `src/lib/billing/stripe.ts`, `src/app/api/checkout/route.ts`, `src/app/api/stripe/webhook/route.ts` | §8. |
| NEW | `src/lib/access/*` (entitlement checks, relevance query, unlock with audit), `src/app/connect/page.tsx`, `src/app/pass/[id]/page.tsx`, `src/app/api/pass/[id]/unlock/route.ts`, `src/app/api/pass/magic-link/route.ts` | Customer flow. |
| NEW | `scripts/mirror-sync.ts` (Integration API: listings + authors + privateData → `listings`, `operators`, `operator_contacts`; seeded once from the workbook), later `scripts/events-poll.ts` (cron) | One-way mirror. |
| NEW | `src/app/account/**` (operator portal, Phase 3), `src/lib/sharetribe/operator.ts` (password grant, `own_listings/*`, `images/upload`, `current_user/*`) | Operators never see the hosted app. |
| NEW | `docs/PAID_ACCESS.md`, terms/privacy/refund pages | Required for Checkout and chargebacks. |
| KEEP | `src/lib/email/*`, Emailit/Resend | Pass delivery and magic links use the existing outbox. |
| KEEP | `e2e/*`, `tests/*` | Update the request-flow specs (`slice.spec.ts`, `inventory-pseo.spec.ts` CTA names); add pass-flow tests with Stripe test mode. |

---

## 8. Stripe implementation (no Connect)

**Use Stripe Checkout (hosted), mode `payment`**, not raw PaymentIntents: it handles SCA, card wallets, receipts and later tax, and keeps our forms out of PCI scope. Our Stripe account is a plain account for 10000 Solutions LLC (not PRNM's, not a platform/Connect account).

Flow:
1. `POST /api/checkout` (server): validate the event form; insert `customers` (by email), `events`, and a `purchases` row with `status='pending'` and the active `plans` row's price. Create the Checkout Session with `client_reference_id = purchase.id`, `metadata = {purchase_id, event_id, plan_id}`, `customer_email`, `line_items = [{price: plan.stripe_price_id, quantity: 1}]`, `success_url = /pass/pending?p={purchase_id}`, `cancel_url = /connect?p={purchase_id}`, and **Stripe idempotency key = purchase.id**. Store `stripe_checkout_session_id`.
2. The success page never grants access by itself. It shows "confirming your payment" and polls `GET /api/purchases/{id}/status` until the webhook has marked it paid, then redirects to `/pass/{passId}` and emails the magic link.
3. **Webhook `POST /api/stripe/webhook`** (raw body, signature verified with the endpoint secret, Node runtime, no body parsing middleware):
   - insert into `stripe_events(id)`; on conflict return 200 (duplicate delivery).
   - `checkout.session.completed` with `payment_status='paid'`, or `checkout.session.async_payment_succeeded`: in one DB transaction set `purchases.status='paid'`, `paid_at`, `stripe_payment_intent_id`, create `access_passes` (`unlock_limit` from the plan, `expires_at = now + validity_days`, `status='active'`), create a `magic_links` row, enqueue the pass email. Transition guarded (`where status='pending'`).
   - `checkout.session.async_payment_failed`, `checkout.session.expired`: `status='failed'`.
   - `charge.refunded`: `refund_cents` and `status='refunded'|'partially_refunded'`; revoke the pass (`status='revoked'`). Unlocks remain as the audit record of what was revealed before the refund.
   - `charge.dispute.created`: `status='disputed'`, revoke the pass, alert the team (the `unlocks` log with `contact_snapshot` and timestamps is the chargeback evidence).
   - Always 200 after recording; do work idempotently; a daily reconciliation job lists Checkout Sessions from the last 3 days and repairs any `pending` purchase whose session is paid (Stripe retries webhooks for up to 3 days, so this is belt and braces).
4. **Refunds** are issued from the Stripe dashboard or an internal route calling `refunds.create` with `idempotency_key = purchase.id + ':refund'`; the webhook does the bookkeeping. Policy (recommended): full refund if no operator was unlocked; otherwise at the team's discretion. State it on `/connect` and in the terms.
5. **Security:** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` only in server env; price comes from `plans`, never from the client; the webhook route rejects unsigned or stale (> 5 min) events; the pass id in a URL grants nothing without the signed session cookie or a valid magic link; rate-limit `/api/checkout` and the magic-link endpoint; log amounts, never card data.

Test mode until the founder approves real money, as today.

---

## 9. Sharetribe changes

| Item | Action |
|---|---|
| Listing type `operator-ride-rental` (default-inquiry, unit `inquiry`) | **Leave intact.** Free messaging = no payout requirement. Optionally rename the label. Never delete (listings would stop working). |
| Listing type `daily-booking` (default-booking) | Stop using. Leave in Console (one QA listing references it); close that QA listing. |
| Console → Monetization → Commission (provider 10%) and minimum transaction size | Irrelevant without transactions; set to 0 so no document can quote it. |
| Console → Build → Integrations → Payments (old Stripe keys) | Leave empty or as-is; **do not** paste the new Carnival keys. Stripe lives in our app. |
| Request-desk listing (`metadata.requestDesk`) | Close it (Integration `listings/close`) in Phase 2. Remove `REQUEST_DESK_LISTING_ID`. |
| Existing 18 test transactions and inquiries | Leave; cannot be deleted; nothing reads them after Phase 2. |
| `publicData.transactionProcessAlias/unitType` on 3,716 listings | Harmless data. Optionally bulk-clear in Phase 4 via Integration `listings/update`. |
| Listing approval (`pendingApproval` → `listings/approve`) | **Keep** as the quality gate for operator-created listings. |
| Console → General → Access control | **Set "Private marketplace" and "Approve new users"** so the hosted web app stops being a public catalogue that shows claimed operators' names. Done when the portal (Phase 3) is live, or immediately if accepted that operators edit via our portal only. |
| Hosted web app design (logo, footer) | Irrelevant once private; skip. |
| Transaction email templates | Unused. |
| User `privateData` contact copy, `protectedData.phoneNumber` | Leave; it is the import copy and is never public. The authoritative record moves to Supabase. |
| Integration API key | Still needed for scripts and the mirror poller; still never in the pSEO layer or the browser. |
| Marketplace client secret | No longer needed anywhere (only the QA payment scripts used it); rotate and remove from env. |
| Plan | Build ($39) is enough until Live. Live needs the Live plan ($259/month, $199/month annual) for a custom front end against the Live environment. |

---

## 10. Migration sequence (no big-bang)

**Phase 0: decisions (founder).** Rewrite `PROJECT_BRIEF.md` and the CLAUDE.md rules for the directory model. Approve plan name/price/limits/validity. Approve refund policy and the terms, privacy and refund pages. Create the standard Stripe account and a Supabase project. Confirm in writing with Sharetribe support that off-platform payment on the Live plan is fine (docs say nothing against it).

**Phase 1: add the paid unlock system (no Sharetribe changes).** Schema (§6), one-shot `mirror-sync.ts` (Integration API → `operators`, `listings`; `operator_contacts` seeded from the workbook and privateData; `contactable` computed), Checkout + webhook (§8), `/connect`, `/pass/[id]`, magic links, pass email. Replace the public CTAs. Keep `/request` as a redirect. Stripe test mode. e2e with Stripe test cards. Ships behind a flag; the inquiry form stays until this is proven.

**Phase 2: remove transaction and payout dependencies.** Delete the inquiry form, `browser.ts`, desk scripts and listing; close the desk listing; delete `ops:bookable`, QA payment scripts, `bookingBlockers`, "Book this ride", `marketplaceListingUrl`; rotate out the Marketplace client secret; set commission to 0; update structured data and the operator page; archive the legacy managed-request flow. Re-run the e2e suite and the pSEO link crawl (nothing in the pSEO layer changes).

**Phase 3: simplest operator UI.** `/account`: login (Auth API password grant from our server, cookie session), self-serve claim (domain-email check from `claim.ts`, then the existing claim handover), rides list/edit via `own_listings/*`, photo upload via `images/upload`, service states, contact form writing to `operator_contacts` (and mirrored to Sharetribe privateData for completeness), "publish" → `pendingApproval` → team approves. Then set the hosted marketplace private. Sharetribe handles steps 1 (account, verification, reset), 3, 4, 5 and 7 natively; step 2 (claim) and step 6 (contact) are ours.

**Phase 4: mirror hardening.** Cron `events-poll.ts` (Integration `events/query`, persisted `sequenceId`) keeps `listings`/`operators` current; `inventory-export.ts` and `/s` read the mirror instead of live `listings/query`; images copied to our storage at export (provenance preserved) so the image-CDN credits stop. After this, the only runtime Sharetribe calls are operator-portal writes.

**Phase 5: optional retirement.** Only if the Live fee outweighs the editor, auth and image hosting Sharetribe still provides. The mirror already holds everything public; the remaining work is Supabase Auth and an image uploader. URLs never change (`/s/{id}` keeps the Sharetribe listing id as our primary key).

---

## 11. Risk register

| Risk | Likelihood / impact | Mitigation |
|---|---|---|
| **Business brief conflict.** The repo's rules forbid a directory that hides the fulfiller. | Certain / blocking | Phase 0 founder rewrite before any code. |
| **Operator experience.** Operators paid nothing and were imported without consent; now their contact is sold. Some will ask to be removed. | High / medium | Free listing, no fees, direct customer relationship, one-click removal; honour removal in `operators.active` and the pass relevance query within minutes; photos removed on request (existing policy). |
| **Thin contact coverage.** Only 87/319 companies have an email on file; some have nothing usable. | High / high | `contactable` flag; never sell a pass whose relevant set has fewer than, say, 3 contactable operators; show the count before payment. |
| **Stale operator information.** Phones change; companies close. | Medium / high | `verified_at` on contacts; periodic re-verification; "report a dead contact" button that re-credits the unlock. |
| **Customer chargebacks** on an instantly delivered digital service. | Medium / medium | Clear pre-purchase disclosure (what you get, how many, no booking guarantee), receipt email, the `unlocks` audit with timestamps and IP hash as dispute evidence, generous refund if nothing unlocked. |
| **Contact-data leakage** through a page, bundle, structured data or the hosted Sharetribe app. | Low in our app (guards exist) / critical | Service-role-only tables; contacts rendered only after the server entitlement check; `inventory:validate` stays as the pSEO gate; hosted marketplace set private; e2e test that crawls public HTML for any contact string. |
| **Duplicate listings** when operators add rides that were already imported. | Medium / low | Portal shows imported rides for claiming before "add"; team approval step catches the rest; `listings` mirror has `operator_id` for dedupe reports. |
| **SEO regressions** from CTA/schema changes. | Low / medium | URLs unchanged; only copy and the `Service` node change; keep noindex until the founder's indexing go; re-run the link crawl and structured-data e2e. |
| **Stripe webhook failures** (missed or duplicated events). | Medium / medium | Idempotent `stripe_events`, status-guarded transitions, success page waits for the webhook, daily reconciliation against Stripe. |
| **Sharetribe API dependency** (outage, price change, credit overrun from image CDN). | Medium / medium | pSEO already needs no runtime calls; Phase 4 mirror and image copy remove the remaining runtime dependency; credit alerts in Console. |
| **Vendor lock-in.** | Low / low | One-way mirror holds all public data in our Postgres; URLs use IDs we own; Phase 5 is cheap. |
| **Migration risk.** | Low / medium | Nothing is rewritten; each phase is additive and independently shippable; the inquiry flow stays until the pass flow is proven in test mode. |
| **Sharetribe ToS / plan.** | Low / medium | Docs show no prohibition; confirm in writing; Live plan required before Live. |

---

## Appendix: facts worth correcting in the repo (no action taken)

1. `scripts/request-desk.ts` 115 says contact email and legal name are kept out of Sharetribe; `src/lib/imports/company-accounts.ts` 260–283 uploads them to user `privateData`.
2. `contract/operator-listing-contract.json` 17 says no process alias is set; `listings:enable-inquiry` and `ops:anonymize` set `default-inquiry/release-1`.
3. `listingPriceLabel` can never show a price because every operator listing has `unitType: "inquiry"`.
4. `scripts/qa-journey.ts` 48 appends credentials to `.env.local`.
5. `data/preview-catalog.json` is referenced by nothing.
