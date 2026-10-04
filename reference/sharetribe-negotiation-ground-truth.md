# Sharetribe ground truth — regular price negotiation

Verified on 2026-10-04 from:
- **Sharetribe Web Template source** `sharetribe/web-template` **v12.3.0**, commit `4dd9b8b` (2026-10-02):
  `ext/transaction-processes/default-negotiation/process.edn`, `src/routing/routeConfiguration.js`,
  `src/containers/RequestQuotePage/*`, `src/containers/MakeOfferPage/*`.
- **Live Sharetribe docs** (via the Sharetribe MCP server): negotiation process, transaction fields, listing types,
  payments, extended data. Links at the end.

Anything a build relies on that is not on this page must be verified separately before it is used.

## 1. Who can do what
- Only **signed-up users** transact. The template's Request quote, Make offer and Checkout pages all require login
  (`auth: true` in `routeConfiguration.js`).
- **Provider = listing author** and is the party paid (Stripe Connect Custom account, destination charge). The provider
  must finish Stripe onboarding before it can submit an offer (`MakeOfferForm` links to `StripePayoutPage`).
- **Operator** (marketplace admin) is not a user; acts through Console / Integration API (reject, cancel, mark delivered…).

## 2. Process `default-negotiation` (regular flow) — from `process.edn`
| Step | Transition (actor) | Resulting state | Actions / timers |
|---|---|---|---|
| Customer requests a quote | `request-quote` (customer) | `quote-requested` | update protected data only — **no payment, no line items** |
| Provider declines / customer withdraws / operator rejects | `reject-request` / `withdraw-request` / `operator-reject-request` | `request-rejected` | |
| Provider makes an offer | `make-offer-from-request` (provider, privileged) | `offer-pending` | set line items, update protected data, update metadata |
| Provider updates offer | `update-offer` → `update-pending`; customer `accept-update` / `customer-reject-from-update-pending` | `offer-pending` / `offer-rejected` | |
| Counter-offers | `customer-make-counter-offer` → `customer-offer-pending`; provider accepts / rejects / counters | back to `offer-pending` | |
| Reject / withdraw offer | `customer-reject-offer`, `provider-withdraw-offer`, `operator-reject-offer` | `offer-rejected` | |
| Customer accepts and pays | `request-payment-to-accept-offer` (customer) | `pending-payment` | create PaymentIntent |
| …payment not confirmed | `expire-payment` (system) | `payment-expired` | **after 15 minutes**, refund |
| …payment confirmed | `confirm-payment` (customer) | `offer-accepted` | confirm **and capture immediately** |
| Not delivered in time | `auto-cancel` (system) | `canceled` | **75 days** after `offer-accepted`, full refund |
| Delivery | `deliver` (provider) / `operator-mark-delivered` | `delivered` | |
| Changes | `request-changes` → `changes-requested` → `deliver-changes` | `delivered` | auto-cancel also applies from `changes-requested` |
| Completion | `accept-deliverable` (customer/operator) or `auto-accept-deliverable` | `completed` | **auto after 14 days**; **payout** created here |
| Reviews | `review-1/2-by-*`, expiry transitions | `reviewed` | |

There is **no** state for "sourcing", "supplier committed" or "booking confirmed" — those exist only if we add them
(custom process) or track them outside Sharetribe.

## 3. What each page collects (template code)
| Page | Fields | Saved to |
|---|---|---|
| Listing page | "Request a quote" button; listing has **no price** field (negotiation listing types) | — |
| Request quote (`/l/:slug/:id/request-quote`) | `customerDefaultMessage` (text) + **customer transaction fields** | transaction `protectedData` (+ `unitType` from the listing) |
| Make offer (provider) | `quote` (currency) + `providerDefaultMessage` + **provider transaction fields** | line items + `protectedData` |
| Checkout (accept offer) | card via Stripe Elements; optional save card | Stripe PaymentIntent |

## 4. Transaction fields (Console → Listings → Listing types)
- Types: **single-line text (≤70 chars), long text (≤5000), number (integer), select one, select multiple, video.
  No date type.**
- Regular negotiation: each field is placed on the **quote request** (customer fills) or the **offer** (provider fills).
- Optional or mandatory; up to 100 per listing type.
- **Cannot be edited after submission** (only exception: reverse-negotiation offer updates).
- Visible to both parties and to the operator (Console → Manage → Transactions → Protected data).

## 5. Data visibility
- Transaction **protectedData** and **metadata** are both **visible to both transaction parties**. Metadata is writable
  only by the operator / privileged transitions. → Supplier costs, margins and internal notes must **not** be stored on
  the transaction; they belong in a separate back office.

## 6. Limits that affect a high-value event business
- Negotiation **cannot be combined with availability (bookings) or stock** without custom code — a quote never reserves a date.
- Card **authorizations last 7 days**; stock negotiation **captures at acceptance**.
- One PaymentIntent per transaction; default integration supports **full refunds only**.
- Saving one card per customer and **off-session charges** later are possible with a custom process (can fail; needs a fallback path).
- Paying "at request time" (before an offer exists) is **not** in the stock process — requires a custom process.

## Sources
- https://www.sharetribe.com/docs/concepts/transactions/negotiation-process/
- https://www.sharetribe.com/help/en/articles/12800532-how-regular-price-negotiation-transactions-work
- https://www.sharetribe.com/help/en/articles/13727923-what-are-transaction-fields
- https://www.sharetribe.com/docs/how-to/transaction-process/add-transaction-fields/
- https://www.sharetribe.com/help/en/articles/8413200-what-are-listing-types
- https://www.sharetribe.com/docs/concepts/payments/payments-overview/
- https://www.sharetribe.com/docs/concepts/payments/off-session-payments-in-transaction-process/
- https://www.sharetribe.com/docs/concepts/extended-data/transaction-extended-data/
- https://github.com/sharetribe/web-template (v12.3.0)
