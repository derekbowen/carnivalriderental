# Sharetribe mapping for a managed marketplace

Status: **design, verified against official Sharetribe documentation on 2026-10-01. Not connected.**
Update 2026-10-01: Integration API read access to the new **CarnivalRental Dev** marketplace is verified (empty marketplace). The transaction mapping below is still unexercised.

## The question

How do we represent our managed rental offerings, the legitimate seller / payment recipient, and the customer transaction in Sharetribe **without** making every subcontracted carnival operator a marketplace provider?

## Confirmed platform facts (with sources)

| # | Fact | Source |
|---|---|---|
| F1 | In a Sharetribe transaction, the **provider is the party who receives the payment**; providers must complete Stripe Connect (Custom account) onboarding / KYC. | docs: concepts/users-and-authentication; concepts/payments/payments-overview |
| F2 | Payments use Stripe **destination charges with `on_behalf_of`**: funds go to the provider's Connect account; the provider's details appear on the customer's receipt; commissions are application fees. A listing cannot be paid for if its provider has not onboarded. | concepts/payments/payments-overview |
| F3 | Operators (admins) are **not** users and cannot be a transaction party; they act via Console / Integration API **operator transitions**. | concepts/users-and-authentication |
| F4 | Integration API can **create and update listings for a registered user** (`authorId`), set metadata, and invoke `:actor.role/operator` transitions with privileged actions (e.g. `privileged-set-line-items`, `privileged-update-metadata`). It **cannot initiate** transactions. | api-reference/integration; concepts/transactions/privileged-transitions |
| F5 | Only registered users can start transactions. | concepts/users-and-authentication |
| F6 | `default-negotiation` (regular flow): customer `request-quote` → provider offer (line items) → optional counter-offers → customer accepts **and pays immediately**. It **cannot be combined with availability/booking** without custom code. Provider must have payout details to submit an offer. | concepts/transactions/negotiation-process; help: regular price negotiation |
| F7 | Card **preauthorizations last 7 days**; default negotiation/purchase **charge immediately** (no preauth period). | concepts/payments/payment-methods-overview; payment-intents |
| F8 | Funds can be held before payout **~90 days** per Sharetribe docs (a Help Center article says up to 2 years for US accounts per Stripe — **conflicting; verify with Stripe**). Default negotiation auto-cancels/refunds if not delivered within **75 days** of payment. | payments-overview; help: regular price negotiation |
| F9 | **One PaymentIntent per transaction.** Deposit + balance therefore needs two transactions (or another design). | transaction-process-actions: stripe-create-payment-intent; payments-overview |
| F10 | Saving a card without paying is supported (SetupIntent → Stripe Customer default payment method), and a process can charge **off-session** later (`:use-customer-default-payment-method? true`); off-session charges can fail and need a fallback path. | concepts/payments/using-stored-payment-cards; off-session-payments |
| F11 | Default Stripe integration supports **full refunds only**. | payments-overview FAQ |
| F12 | Sharetribe is headless: a custom frontend on Marketplace API + a server for privileged/Integration calls is supported. | introduction; introduction-to-customizing |

## Recommended mapping (pending approval)

**One real seller account: our own company.**

- Create **one Sharetribe user that represents our operating company** (e.g. "<Legal entity name> — Fulfilment"), onboarded to Stripe Connect **in our company's legal name** with our real KYC. This is not a fake provider: it is the legitimate seller of record, matching F1/F2 — the customer buys from us, and the receipt shows us.
- **All ride rental offerings are listings authored by that account**, created/updated by our backend via the Integration API (F4). Public fields describe the *offering* (ride type, what's included, planning estimate). No listing claims a specific physical unit or date availability.
- **Operators are NOT Sharetribe users.** Suppliers, ride units, supplier quotes and costs live in our own fulfilment store (today: dev SQLite; later: a single Postgres). Supplier payment is **accounts payable from our company**, designed explicitly later — not routed through Sharetribe.
- **Customer transaction:** customer signs up (F5), our backend links their event request, and the customer initiates a quote request on the offering listing. We respond with versioned offers (line items set server-side). Recommended: a **custom process derived from default-negotiation** where offers are made by an **operator transition via the Integration API** (F4), so no staff need to log in as the house account to quote.
- **Commission lines:** because the seller *is* us, platform commission is an accounting choice (0% or an internal split). Needs accountant input; do not copy PRNM's 15%.

What this avoids: fake provider accounts per operator; the platform account "automatically" receiving the full payment (it does not — the provider account does, F2); a second, unrelated payment system.

### Things this mapping does NOT give us

- **Date-specific equipment reservation.** Negotiation does not reserve availability (F6). Unit availability is managed in our fulfilment store; the customer-facing state says "sourcing" until a supplier commits.
- **Long holds.** A card auth can't be held for months (F7); captured funds have a hold limit (F8).

## Payment options — the smallest supported approaches (decision required)

| Option | How (Sharetribe-supported) | Pros | Cons / risks |
|---|---|---|---|
| A. **Pay in full on quote acceptance** | Stock negotiation behaviour (F6/F7) | Zero custom payment code | Large charge before supplier commitment; full refund only (F11); 75/90-day limits bite for far-off events (F8) |
| B. **Deposit transaction + balance transaction** | Two transactions, each with one PaymentIntent (F9) | Smaller upfront commitment | Two charges, coordination, refund rules per transaction |
| C. **Save card now, charge off-session nearer the event** | SetupIntent + off-session process (F10) | No money moves until supply is firm | Charge may fail; saved card ≠ funds reserved; needs mandate wording |
| D. **Accept quote first, pay after supplier commits** | Custom process: accept → operator "supply-confirmed" → customer pays | Payment aligned with real supply | Customer could walk after we secure supply |

Session one implements **none** of these against Stripe. The UI and state machine support all of them because the **payment track is separate from the fulfilment track**.

## Decisions needed from the founder before real transactions

1. Legal entity that will be seller of record (and therefore the Stripe Connect account holder).
2. Payment option (A–D or combination), deposit %, timing of balance, cancellation & refund policy, and the wording customers consent to.
3. Whether far-future events (> 75–90 days) use option C/D or a different mechanism; confirm the US hold limit with Stripe.
4. Commission line items on our own listings (likely 0%) — accountant.
5. Supplier payment terms and method (AP, deposit to operator, etc.).
6. Whether the custom operator-offer process (vs logging in as the house account) is worth the process work now.
7. Insurance / contract requirements before an operator can be marked `verified_supplier`.

## Next verification steps (once a Dev marketplace exists)

- Create a **separate** Sharetribe marketplace for this business (not PRNM's). Use its **Dev** environment only.
- Onboard the house account in Stripe **test mode**; create one Ferris wheel offering via Integration API.
- Push a draft custom process with Sharetribe CLI; run request-quote → operator offer → accept in test mode.
- Record actual behaviour here, replacing "design" with "verified".
