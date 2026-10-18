# Paid access architecture: where the ledger lives (decision, 2026-10-06)

Companion to `PAID-CONTACT-MODEL-AUDIT.md` (the feasibility audit) and `PAID_ACCESS_IMPLEMENTATION.md` (what was built). This file records the storage decision for the Event Access product and why.

## The rule

**Sharetribe is the authoritative catalog and operator database.** Operators, company ownership, ride listings, photos, ride attributes, service geography, listing approval, operator self-management and private operator contact details stay in Sharetribe. Nothing copies the catalog anywhere else. The public pSEO layer keeps reading its build-time snapshot (`src/lib/inventory/rides.json`), which carries no operator identity, exactly as before.

**The only durable state added by the pivot is the access ledger:** the product configuration (two tiers since 2026-10-12: `event-access` and `ferris-wheel-access`; the tier of a request is resolved in code from its validated ride requirement, `src/lib/access/pricing.ts`, and persisted with the request), the customer's event request, the Stripe purchase, the entitlement (pass), which operators were revealed, refund/revocation state, webhook idempotency and the audit trail. That state references Sharetribe IDs (listing IDs, operator user IDs); it never duplicates listing content.

## Current-state verification (live Test marketplace, 2026-10-06)

| Check | Result |
|---|---|
| `operator-ride-rental` listing type | `default-inquiry/release-1`, unit `inquiry` (Free messaging); default fields title, description, images, location, price; **no payoutDetails** (`contract/snapshots/carnivalrental-test-2026-10-06.json`) |
| Counts | 3,716 published listings, 189 users, 18 test transactions |
| Anonymous Marketplace API `listings/show?include=author` | listing attributes have **no** `privateData`; author resource exposes displayName ("Carnival Ride Rental operator"), bio, publicData, metadata only: no email, no protectedData, no privateData |
| Integration API `users/show` | returns email, `protectedData.phoneNumber`, `privateData` {companyName, contactName, website, hqCity, …, originalProfile}, `stripeConnected: false`, no Stripe account |
| Stripe accounts reachable from this environment | only Pool Rental's live account (`acct_1PZNAW…`), which must never be used; no Carnival Ride Rental key exists in the environment |
| Production persistence | none: the legacy request store is SQLite on Vercel's ephemeral disk |

The audit's findings stand. Nothing material changed.

## Options evaluated, in the order the founder set

### A. Existing production-capable storage in this project

There isn't any. `src/lib/requests/db.ts` is `node:sqlite` at `data/dev.sqlite`; on Vercel the filesystem is not durable across deployments or instances. It is fine for development and e2e, and useless as a ledger of money. **Rejected for production; kept as the local/e2e engine behind the same SQL interface** (see "Portable SQL" below), so tests run without a network.

### B. Sharetribe itself

Could purchases, passes and unlocks live in Sharetribe extended data or transactions?

| Requirement | Sharetribe fit |
|---|---|
| Durable, private record per purchase | Possible in a customer user's `privateData` (Integration `users/update_profile`) or a transaction's `metadata`. Private, yes. |
| Atomic "consume one unlock if under the limit" with concurrent requests | **No.** Extended-data updates are last-writer-wins merges with no compare-and-swap, no row locks, no unique constraints. Two parallel reveals can both succeed. |
| Idempotent webhook processing (unique Stripe event id) | **No** unique constraints; would need a read-then-write race. |
| Query "all passes for this email", "all unlocks of operator X", refund reports | **No.** User privateData is not queryable; transactions are queryable only by customer/provider/listing. |
| Audit trail that cannot be edited by the customer | A customer can edit their own privateData through the Marketplace API, so a ledger there is tamperable. Transaction metadata is operator-only, but using transactions means creating a transaction per purchase on a fake "access" listing, with the customer as a Sharetribe user: the "fake booking" pattern the founder excluded, plus a customer account and password for every buyer. |
| Cost | Every ledger read is an API call with credits; no joins. |

Verdict: Sharetribe can store the data but cannot enforce the ledger's invariants (limits, uniqueness, idempotency, auditability). Forcing it in would be the "awkward custom transaction hack" the brief forbids. **Rejected.**

### C. Minimal dedicated datastore

A Postgres database holding only the ledger. **Selected.** Supabase was chosen because the founder already has an organisation there, the MCP tooling in this environment can apply migrations to it, and it is plain Postgres (no lock-in beyond a connection string). The schema is written in portable SQL, so any Postgres works.

What goes in it: `access_products`, `event_requests`, `purchases`, `stripe_events`, `access_passes`, `unlocks`, `magic_links`, plus `operator_contact_status`, a small cache of "does this Sharetribe user have at least one usable contact channel" (user id, flags, checked-at). That cache exists only so the pre-payment match count doesn't need one Integration API call per candidate on every visit; it holds no contact values and expires after 24 hours.

What does **not** go in it: listings, photos, attributes, operator names or contact values. Contact values are fetched from the Integration API at reveal time and copied only into the `unlocks.contact_snapshot` of the pass that paid for them (the audit record of exactly what was shown).

## Why this beats the alternatives

- It is the smallest durable surface that gives the invariants money needs: row locks and a `CHECK`-guarded increment for the unlock limit, `UNIQUE (pass, operator)` so the same operator never costs two unlocks, `UNIQUE (stripe_event_id)` for idempotent webhooks, and plain SQL for refunds, disputes and reports.
- Sharetribe keeps doing what it is paid for, untouched; a Sharetribe outage affects only operator editing and live search, not the ledger of who paid.
- Nothing is mirrored, so there is one source of truth for the catalog and one for the ledger, and they meet only on IDs.
- If Supabase were ever dropped, the ledger moves with `pg_dump`.

## Portable SQL and the two engines

`src/lib/access/db.ts` exposes one small driver interface (`query`, `transaction`). Postgres (`pg`) is used when `ACCESS_DATABASE_URL` is set; otherwise `node:sqlite` at `DATABASE_PATH`, which is what unit tests, e2e and local development use. The schema avoids engine-specific types (text ids, ISO-8601 text timestamps, integer flags, JSON as text) and uses only features both engines share (`RETURNING`, `ON CONFLICT DO NOTHING`, transactions). Production must set `ACCESS_DATABASE_URL`; the Event Access routes refuse to take payment on SQLite when `APP_ENV=production`.

## How the ledger relates to Sharetribe at runtime

```
pre-payment   snapshot rides near the event ──► Marketplace API listings/query?ids=… include=author
              (no identity)                     → listing→operator map (public, anonymised authors)
                                                → operator_contact_status (Integration users/show, cached)
                                                → count of unique contactable operators
after payment pass page lists operators anonymously (home state, distance, their matching rides)
reveal        Integration users/show → permitted fields → unlocks.contact_snapshot → shown once entitled
```

The Integration API secret stays server-side (route handlers only); the browser never calls Sharetribe.

## Founder actions this decision needs

1. Supabase: a project named `carnivalriderental` in the `derekbowen's Org` organisation (created by this session if the API call succeeded; see `PAID_ACCESS_IMPLEMENTATION.md`), and its connection string in Vercel as `ACCESS_DATABASE_URL`. The migration is in `src/lib/access/schema.sql` and `npm run access:migrate` applies it.
2. Stripe: a standard (non-Connect) Stripe account for 10000 Solutions LLC; `STRIPE_SECRET_KEY` (test first) and `STRIPE_WEBHOOK_SECRET` in Vercel. Never Pool Rental's keys.

## Contact counts: up to five, the real number per search (2026-10-17)

The product sells from `minimum_matches` (3) while the unlock limit is 5, and about half of sellable city × ride searches have 3–4 contactable operators (upper bound from the snapshot, top 300 cities). Founder decision: keep selling from 3, never promise five where fewer match.

- General copy (Connect, ride pages, home, policy, chat) says "up to" the unlock limit and that the offer states the exact number.
- Per-search surfaces use `contactsPhrase(unlockLimit, matched)` (`lib/access/count-copy.ts`): the `/connect/[id]` offer ("for N matching operator contacts"), the Stripe line item description, the event-form offer, the pass email and the lifecycle emails. The pass page counts against `available = min(unlock limit, matched)`; the purchase still snapshots the product's unlock limit.
- Tests: `tests/contact-count.test.ts`, `e2e/offer-copy.spec.ts`, `e2e/access.spec.ts`.

## Short Connect form, optional date (2026-10-18)

Founder: the form asked too much (about 10 visitors opened it, one submitted). It now asks for the ride (one select; `class:<id>` for a whole category, mapped in `/api/access/start`), city, state, an optional event date and an email. Event type, ZIP, attendance and budget are no longer asked for (still accepted by the server; occasion pages pass their event type). `access_event_requests.event_date` is nullable: `schema.sql` for new databases, `PG_ALTERS` in `db.ts` (idempotent, best effort) and a one-off migration applied to the production ledger on 2026-10-18. A blank date shows as "date not set"; lifecycle sales emails treat it as upcoming (a past date still stops them); a past date is still refused at submit. Tests: `tests/connect-form.test.ts`, `tests/lifecycle.test.ts`, `e2e/offer-copy.spec.ts`.


Fastest on a phone (founder 2026-10-18, "I just want to collect emails"): the email field comes first and carries `autocomplete="email"`, `inputmode="email"`, no autocapitalise/autocorrect, so phones offer the saved address in one tap; city and state carry `address-level2` / `address-level1`. City and state are prefilled from the page (`?state=&city=`) or else from Vercel's IP geolocation headers (`lib/access/visitor-place.ts`: US only, a real state, a city only when `geocode` places it, so a guess never fails the submit), with a note saying it is approximate. The headers are read per request (`/connect` is `private, no-store`) and nothing is stored unless the visitor submits; the privacy policy says so. Tests: `tests/visitor-place.test.ts`, `e2e/offer-copy.spec.ts`.
