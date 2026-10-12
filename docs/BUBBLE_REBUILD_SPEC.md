# Bubble rebuild spec (prepared 2026-10-12; nothing built in Bubble yet)

Founder request (2026-10-12): rebuild carnivalriderental.us in Bubble, as close to 1:1 as possible.
This session has **no Bubble connection** (the Bubble MCP server is not attached), so nothing has been
created in Bubble. This file is the build sheet for the session that has it: every page, data type,
workflow and rule below is taken from the current Next.js code on `main` (commit f22348d), which
stays live until the Bubble app is verified.

Business model and data rules do not change: discovery is free, Event Access is the only thing sold,
operator identity is revealed only after a server-side entitlement check, Sharetribe stays the
catalog of record, Stripe stays our own standard account (no Connect), indexing stays off.

## 0. Where 1:1 is not possible in Bubble (decide before building)

| Area | Current app | Bubble reality | Recommendation |
|---|---|---|---|
| URLs | `/ohio/columbus`, `/ohio/columbus/ferris-wheel`, `/s/{listingId}`, `/categories/{id}` | Bubble pages live at `/{page}/{slug}`; a root-level `/{state}/{city}/{ride}` tree can't be routed dynamically | Either accept new URLs (none are indexed yet, so nothing is lost in search) with 301s from a Cloudflare rule, or keep a thin proxy. The domain's DNS is on Cloudflare. |
| pSEO scale | 17,511 generated pages (1,580 cities, 15,931 ride×city), near-duplicate gate, pilot allowlist | Each page is one Bubble page reading a Thing by slug; 17k Things are fine, generation is a backend job | Import cities and ride-type×city rows as Things with precomputed counts; keep every page `noindex` (Bubble SEO settings) until the indexing decision. |
| Webhook security | Stripe signature verified with HMAC (`stripe.ts`) | Backend API workflows can't verify the `Stripe-Signature` header natively | On every webhook, re-fetch the event from Stripe (`GET /v1/events/{id}`) with the secret key and act only on that response. |
| Unlock concurrency | Guarded `UPDATE … WHERE unlocked_count < unlock_limit` in a transaction | No transactions | Unique `Unlock` per (pass, operator) checked first; run unlocks through a single-threaded backend workflow per pass; re-count unlocks instead of trusting a counter. |
| Locked data | Contact values never reach the browser before entitlement | Bubble sends Thing fields to the client unless privacy rules forbid it | Contact data is never stored in a client-searchable Thing; reveal writes an `Unlock` whose privacy rule allows only the pass owner. API Connector calls to Sharetribe's Integration API must be "private" (server-only) and used only in backend workflows. |
| Tests | 249 unit tests, 46 Playwright e2e | No equivalent test harness | Keep the Playwright suite and point it at the Bubble app URL; it tests through the browser, so most specs carry over once test IDs are added as element IDs. |

## 1. Design system

Colors (Bubble Styles → Color variables):
`ink #0b1b3f`, `ink-soft #2e3b5c`, `muted #56627d`, `canvas #f3f5fa`, `surface #ffffff`,
`line #e1e5ee`, `line-strong #c9d0de`, `accent #ffc629`, `accent-hover #f5b700`, `accent-wash #fff2cc`,
`accent-strong #7a5200`, `pop #e5352b`, `pop-wash #fde4e2`, `placeholder #d4d9e3`, `ok #1f7a4d`,
`ok-wash #dff3e8`, `danger #c2281f`.

Fonts: Bricolage Grotesque 600/700/800 (headings, display prices), Inter 400/500/600/700 (body).
Buttons: primary = accent fill, ink text, 8px radius, 44px min height; ghost = surface fill,
line-strong border; dark = ink fill, white text. Cards: white, 1px line border, 16px radius.
Header: logo, nav ("Find a ride", "Ride types", "Events", "Locations", "How to rent") and a primary
"Connect with operators" button; mobile collapses to a menu. Footer: ink background, an operator
strip ("Own or operate carnival rides?" → /operators), link groups (ride types, events, top cities,
states), legal links, "owned and operated by" line.

## 2. Option sets

- `RideClass` (9, from `contract/operator-listing-contract.json`): kiddie, major, family, spectacular,
  other, funhouse, coaster, dark-ride, water, each with its label.
- `RideType` (50, `src/lib/taxonomy/ride-types.json`): id, name, category, search phrases. Ferris
  types: `ferris-wheel`, `giant-ferris-wheel` (category ferris-wheels), `mini-ferris-wheel` (category
  kiddie-rides).
- `Category` (6): ferris-wheels, carousels, swing-rides, kiddie-rides, family-rides, thrill-rides; the
  five hub categories carry the copy in `src/lib/content/category-pages.ts`.
- `AccessTier`: standard, ferris.
- `UsState` (51) with slug, abbreviation, centre lat/lng (`src/lib/taxonomy/state-centers.ts`).
- `EventType` (8, `ConnectForm.tsx`).

## 3. Data types

Public, readable by everyone (privacy rule: all fields visible):
- `Ride` (3,714 rows; import `src/lib/inventory/rides.json`): sharetribe_listing_id (unique), title,
  ride_class, ride_type, home_state, service_states (list), geo (address/lat-lng), photo, thumb,
  facts (list of text "label: value"), claimed (yes/no), operator_key (anonymous hash from
  `operators.json`; 121 distinct operators). Never a company name, phone, email or website.
- `City` (1,580; `src/lib/geo/cities.json`): state, name, slug, geo, population, precomputed counts
  (rides within 200 mi, distinct operators, per-class and per-type counts).
- `RideCityPage` (15,931 candidates; only rows with ≥ 5 rides of the type within 200 mi render).
- `Guide`, `Occasion` (content from `src/lib/content/guides.ts`, `src/lib/taxonomy`).
- `AccessProduct` (2 rows): slug, name, description, price_cents, currency, unlock_limit,
  validity_days, minimum_matches, active, tier. Rows:
  `event-access` "Event Access" 9900 usd 5 / 30 / 3; `ferris-wheel-access` "Ferris Wheel Event Access"
  19900 usd 5 / 30 / 3. Copy everywhere reads these rows.

Private (privacy rule: only the creator / the pass holder; never searchable by others):
- `EventRequest`: email, event_date, city, state, zip, event_type, ride_type, ride_class, listing (Ride),
  attendance, budget_cents, geo, matched_operators (number), status (matched / insufficient),
  product (AccessProduct), tier, source_path, match_snapshot (list of `MatchedOperator`).
- `MatchedOperator`: sharetribe_operator_id, label ("Operator A"), home_state, miles, serves_state,
  claimed, listings (list of Ride, max 6). No contact fields.
- `Purchase`: event_request, product, email, amount_cents, currency, unlock_limit, validity_days
  (snapshotted at checkout), stripe_session_id, stripe_payment_intent, status (pending, paid, failed,
  expired, refunded, partially_refunded, disputed), refund_cents, paid_at.
- `Pass`: purchase (unique), event_request, email, unlock_limit, status (active, revoked, expired),
  expires_at, revoked_reason.
- `Unlock`: pass, sharetribe_operator_id (unique per pass), first_revealed_at, contact snapshot
  fields (company, contact name, phone, email, website, hq city/state), ip_hash, user_agent,
  reported_dead_at, credit_restored_at. Visible only to the pass holder.
- `MagicLink`: token_hash, pass, expires_at, last_used_at.
- `StripeEventLog`: stripe_event_id (unique), type, purchase, result.
- `OperatorContactStatus`: sharetribe_operator_id, has_phone, has_email, has_website, claimed,
  checked_at (24 h cache; flags only, never values).

Customers have no Bubble account; a pass is opened by a signed cookie today. In Bubble, use the
magic link to log the customer in as a lightweight User (email only) and tie Pass to that User, so
privacy rules can say "This Pass's email is Current User's email".

## 4. API Connector

- **Sharetribe Marketplace API** (public client id, shared): `listings/query` (search near origin,
  `pub_rideClass`, paging), `listings/show` with `include=author&fields.user=` (listing → operator id).
- **Sharetribe Integration API** (client id + secret, **private, backend only**): `users/show` for
  contact fields at reveal time and contactability flags before payment. Map fields exactly as
  `contactFromUser` in `src/lib/access/contacts.ts` does (private companyName, contactName, website,
  protected phoneNumber, contactEmail; never our own carnivalriderental.us placeholder addresses).
- **Stripe** (secret key, private): `POST /v1/checkout/sessions` with inline `price_data`
  (unit_amount = the purchase's amount_cents, product name/description from the product row,
  `client_reference_id` = purchase id, `expires_at` + 1 h), `GET /v1/checkout/sessions/{id}`,
  `POST /v1/checkout/sessions/{id}/expire`, `GET /v1/events/{id}`.
- **Resend** (key, private): `POST /emails` for the pass email and the recovery link; while
  `EMAIL_MODE=test` every message goes to qa@carnivalriderental.us with the intended recipient in the
  subject.

## 5. Server logic (backend workflows)

**resolve_criteria(listing, ride_type, ride_class)** — the one resolver for matching and pricing:
1. If listing is a known Ride: ride_type = that Ride's type; ride_class only if it has no type.
2. Else ride_type = the submitted type only if it is a RideType option; class only without a type.
3. tier = ferris when ride_type is ferris-wheel, giant-ferris-wheel or mini-ferris-wheel, else standard.
Nothing the browser sends about price, product or tier is read.

**start_event_request** (from the /connect form): validate (email, date ≥ today, state, city geocodes
to a City or the state centre) → resolve_criteria → product = active AccessProduct of the tier (none →
"not available", never the other tier) → match_operators → save EventRequest with resolved criteria,
product, snapshot, status = matched if contactable operators ≥ product minimum.

**match_operators**: Rides within 200 mi (great-circle) filtered by ride_type, else ride_class, else
all; nearest 150; the entry listing always included; group by Sharetribe author (operator); fetch
contact flags (cache 24 h); keep operators with at least one channel; rank by serves-state, distance,
number of matching rides, claimed; keep 25; label A, B, C…. Each company counts once.

**create_checkout** (pay button): re-derive the tier from the stored request; product = active product
of that tier; refuse unless matched and count ≥ minimum; expire any pending purchase of this request
at a different product/amount (Stripe expire; leave it if Stripe says it was paid); set the request's
product; create Purchase with the snapshot terms; create the Stripe session; redirect.

**stripe_webhook** (API workflow): log the event id (skip duplicates) → re-fetch the event from Stripe →
`checkout.session.completed` paid → activate; `checkout.session.expired` / `async_payment_failed` →
mark pending purchase; `charge.refunded` → full when amount_refunded ≥ the purchase's amount_cents →
revoke pass, else partially_refunded; `charge.dispute.created` → disputed, revoke.

**activate_purchase** (webhook and return page, idempotent): if a Pass exists for the purchase, stop;
accept pending or expired purchases that Stripe says are paid; create Pass (limit and expiry from the
purchase snapshot); send the pass email with a magic link.

**unlock_operator**: already unlocked → show it, no charge; pass active and unexpired; operator in this
pass's own match snapshot (never another request's); unlocks < limit; fetch contact via the
Integration API; must have a channel; create Unlock with the snapshot. One workflow at a time per pass.

**recover**: email → for each active pass of that email, a new magic link by email; always the same
response whether or not passes exist.

## 6. Pages (current route → Bubble page)

| Current | Bubble page | Content |
|---|---|---|
| `/` | index | hero "Carnival Ride Rentals Nationwide", search box (class + location), four photo tiles, how it works, nearby rides, comparison table, buyer guide teaser, Event Access block with both prices, FAQ, operator CTA |
| `/s`, `/s?type=` | search | nearest-first rides from the Marketplace API (class chips) or from Ride Things (type filter); state picker; near-me; pagination 24 |
| `/s/{id}` | ride | photo, class, title, home state, facts, tier price line, Connect button, similar rides from other operators |
| `/rides` | ride-types | ride types grouped by category with listing and operator counts → filtered search |
| `/categories/{id}` | category | themed hero, real listings (one per operator), type chips, pricing notice, planning cards, how it works, price line (Ferris hub shows "Ferris Wheel Event Access — $199"), FAQ, related, CTA |
| `/{state}` | state | ride types with counts in the state → filtered search, nearby rides, city links |
| `/{state}/{city}` | city | counts, class chips, 12 nearest rides, ride-type links, CTA with both prices, FAQ, nearby cities |
| `/{state}/{city}/{type}` | ride-city | rides of the type within 200 mi, multi-operator note, tier CTA, FAQ |
| `/events`, `/events/{occasion}`, `/{state}/{occasion}` | events / occasion | occasion copy, real inventory of suggested categories, pricing notice |
| `/directory`, `/directory/{state}` | directory | every location and listing link |
| `/guides/how-to-rent-carnival-rides` | guide | buyer guide sections, checklist, FAQ |
| `/connect` | connect | event form; ride-type selector shows the tier price as it changes; side card with the product terms |
| `/connect/{id}` | matches | honest count, anonymous operator cards, offer box with product name, price, "Continue to secure payment · $X" |
| `/pass/{id}`, `/pass/open`, `/pass/recover`, `/pass/pending` | pass / pass-open / recover | pass status, unlock buttons, revealed contacts, "contact didn't work", recovery form |
| `/operators` | operators | operator claim/listing page and application form |
| `/access-policy`, `/terms`, `/privacy`, `/contact` | legal pages | as today; access policy states both prices from the product rows |

Every page: `noindex` until the indexing decision; `/connect*` and `/pass*` also excluded in robots.

## 7. Build order once Bubble is connected

1. App settings: domain (staging subdomain first), fonts, color variables, styles, header/footer
   reusable elements.
2. Option sets, then data types with privacy rules (section 3) before any data is loaded.
3. Data import: Rides, Cities, RideCityPages, AccessProducts (CSV generated from the repo snapshot).
4. API Connector calls (section 4), keys stored as private.
5. Backend workflows (section 5), then the funnel pages (connect → matches → Stripe → pass).
6. Discovery pages (section 6), then pSEO pages.
7. Point the Playwright suite at the Bubble staging URL; port element IDs until it passes; run the same
   Stripe test-mode purchases ($99 standard, $199 Ferris) on staging.
8. Switch DNS only after the founder compares both apps.

## 8. Owner prerequisites

- Connect the Bubble connector at https://claude.ai/customize/connectors and start a new session.
- A Bubble plan that allows backend API workflows, scheduled workflows and a custom domain.
- Bubble app name and whether to start from a blank app.
- Decision on URLs (section 0) and on keeping the Next.js app live during the rebuild.
