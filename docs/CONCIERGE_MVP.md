# Carnival Ride Concierge MVP

## Audit of the deployed-source revision

Initial audit baseline: `main` at `c6b51cba4e861c8d95bad56357cea9fdb45d30fa`, the source shown for the production deployment when this work began. This review does not certify current external service state. Implementation was subsequently rebased onto the current `main`, preserving Speed Insights and the newly merged BotID protection. Chat API requests now use the same BotID guard, and checkout buttons reuse ProtectedForm so challenge headers remain attached.

| Item | Evidence and finding |
| --- | --- |
| Sharetribe Live | `SHARETRIBE_LIVE_CUTOVER.md` and `reports/live-migration-2026-10-14.json` record successful cutover to **CarnivalRental**, with 184 operator accounts and 3,714 listings. The runtime uses standard env names, not the script-only `SHARETRIBE_LIVE_*` aliases. Vercel's production public client ID matches the documented Live client; Integration credentials are sensitive and were not downloaded, printed or exposed. A fresh authenticated Live probe was not possible from this sandbox. |
| Supabase | `LAUNCH_STATUS.md` records the dedicated **carnivalriderental** Supabase project. `ACCESS_DATABASE_URL` exists in Vercel production, sensitive. The source uses `pg` and the transaction-pooler connection through `src/lib/access/db.ts`; production refuses SQLite. The existing schema has products, event requests, purchases, Stripe events, passes, unlocks, magic links and contactability flags. Current production rows/connection ownership remain unverified. |
| Request desk | `REQUEST_DESK_LISTING_ID` is still configured in Vercel, but **no runtime route reads it**. `PAID_ACCESS_IMPLEMENTATION.md` records deletion of the old request-desk scripts and inquiry flow; the Live cutover explicitly excluded the Test desk listing. Therefore a stale ID is not a launch blocker for the current Event Access flow. This MVP does not restore Sharetribe transactions: it saves availability requests in the private ledger referencing Live inventory listing IDs. The retired ID's Live existence is unverified. |
| Pricing | `pricing.ts -> resolveCriteria` chooses authoritative listing classification, then canonical ride type/class. `startEventRequest` uses that same resolution for matching and `productForTier`; `quoteForEvent` rechecks the active product at checkout. Seeded rows are $99 standard / $199 Ferris, 5 operators / 30 days / minimum 3 contactable matches. Prices and purchased terms remain ledger-owned, not AI- or browser-owned. |
| Contact authorization | Existing unlock route verifies the signed `cr_pass` cookie before `accessRuntime -> unlockOperator`. The service checks purchase validity (including test-pass rejection on live Stripe), active/unexpired pass, category-bound event match snapshot, operator eligibility/contactability and guarded transactional balance. Contacts are retrieved through `OperatorSource.contact -> integrationGet('/users/show')`; permitted fields are snapshotted atomically. An already-unlocked contact remains visible after expiry/revocation, preserving existing terms. |
| Credentials | `LAUNCH_STATUS.md` records prior exposure of the Live Integration secret, other Sharetribe secrets and the Supabase password. Later rotation cannot be established from masked environment metadata. **Rotate unless revocation/rotation is independently confirmed.** No credentials were changed by this PR. |
| Rollout branch | The dashboard showed deployed source `main`, but a different configured production branch. This PR targets the actual deployed-source branch; merging it is not proof it will automatically reach production. Verify the deployment source before a separately authorized rollout. |

### Preflight corrections in this PR

- Do not build on the retired Test request desk; save structured, unclaimed-ride requests in the existing private ledger instead.
- Do not fork pricing, pass authorization, checkout or Stripe activation.
- Return verified concierge purchases to the same opaque conversation, including saved event details and selected deterministic search.
- Add private/no-store/noindex handling, bounded validated inputs, same-origin JSON mutations, rate limits, safe error responses and RLS for demand records.
- Disclose anonymous lead capture and model processing in the privacy policy and interface.

No production fixes, secret rotations, external database migration, real charges, operator messages or catalog writes were performed.

## Customer flow and scope

Primary entry: the floating **Chat with us** widget on public pages. It answers customer-service questions using AI Gateway, searches through the existing narrow API and offers explicit checkout, availability-request and pass actions. The structured `/concierge` page remains an optional event review interface; it is not the primary product. Chat history is retained in browser-tab session storage (bounded to 24 messages), not sent with protected contact cards to the model.

The exact opening prompt is: **Tell me about your event — where is it, when is it, and what rides are you looking for?**

1. AI Gateway interprets event planning text into a bounded Zod-validated lead. Only the customer's message/prior lead and public taxonomy reach the model. No operator contacts, pass records, credentials or general-purpose data tools reach it.
2. Dates, city/state/ZIP, event type, attendance, requested canonical ride types and quantities, optional budget, setup constraints and customer contact details are saved. Partial leads can be saved without purchase. The structured form/search works when AI is unavailable.
3. Deterministic public inventory search uses the existing anonymized Live snapshot, distance ranking and `toCard` projection. Counts are **nationwide inventory**, not confirmed availability or service. Details/specs link to the existing listing page. No new catalog mirror is stored.
4. The customer explicitly selects the ride criterion for a quote. Multiple requirements are saved on the lead, but **one purchase covers one existing criterion/event**, not every ride in a mixed event. This preserves the current pricing/entitlement rules.
5. `startEventRequest` computes contactable, qualifying operators and the ledger product. The customer sees the exact server quote before the existing `/api/access/checkout` form is submitted. Insufficient matches are not sold.
6. The existing Stripe return/webhook verifies payment. A success redirect alone never grants access. The signed pass cookie is retained, and concierge-origin purchases resume `/concierge` without repeating the event intake.
7. Explicit buyer actions call narrow server services to inspect a pass and unlock eligible operators. The model is not part of the contact-return path. Reopening an existing unlock is free; new unlocks use the existing atomic counter.
8. **Request My Event** / **Request Availability** saves a structured request with status `received`. It does not send outreach, start a Sharetribe transaction, reserve a ride or confirm availability. The interface says so explicitly.

Narrow services: `searchRides`, `getRideDetails`, `getPublicOperatorProfile`, `checkEventAccess`, `getPassStatus`, `getUnlockedOperators`, `unlockOperator`, `createEventRequest`, `getRequestStatus`. The model performs extraction, not autonomous contact or payment actions. Customer-service replies are grounded in server-loaded product terms and public inventory. Availability disclaimers and privileged actions remain application-controlled.

## Migration and environment

Additive schema in `src/lib/access/schema.sql`:

- `concierge_sessions`: hashed opaque cookie token, structured lead, last selected search, Event Access request reference, 30-day session expiration.
- `concierge_requests`: structured availability/event request, optional listing reference, review status.
- `concierge_events`: action names and session/event/pass IDs only; no message text or contact values.

The existing `npm run access:migrate` initializes these alongside the ledger. The Postgres initialization enables RLS with no anonymous policies and revokes PUBLIC privileges on the new tables. Apply with the existing table-owner connection; do not use an anonymous Supabase browser client. **Production migration has not been applied here.** First ledger initialization also applies the schema, following the existing application's convention. Review the additive migration before deploying.

No new required production secret is introduced. Reuse `ACCESS_DATABASE_URL`, Sharetribe, Stripe and signed pass-session configuration. On Vercel the AI SDK uses AI Gateway's OIDC authentication when no `AI_GATEWAY_API_KEY` is set. `CONCIERGE_MODEL` is optional (default `openai/gpt-4.1-mini`); local development may use an AI Gateway key through protected environment configuration. The installed integration uses AI SDK 6, whose `generateObject` API was checked against installed types and validated through Gateway.

A **functional preview requires isolated Preview values** for the ledger, Stripe test mode, pass signing and appropriate catalog connections. The current Vercel config has the sensitive access/Stripe/Integration settings in Production only. Do not copy production credentials into public files or create test purchases in the production ledger just to make a preview work. A fail-closed preview can render the interface but cannot certify persistence/checkout.

Retired `REQUEST_DESK_LISTING_ID` can be removed after the owner confirms no external legacy scripts depend on it. It is not required by this MVP.

Rotation path: Live Sharetribe Console -> **Build -> Applications**. Create a replacement Integration API application, update **both** standard Integration environment values using protected Vercel inputs, validate the new Live app, then revoke the old application. Deleting the old app first will interrupt contact matching/reveal. Also review the documented Supabase/other credential exposures. Reference: https://www.sharetribe.com/docs/introduction/getting-started-with-integration-api/ and https://www.sharetribe.com/docs/concepts/applications/.

## Launch verification still required outside this sandbox

The sandbox cannot reach Sharetribe, the Supabase database or deployment hosts. Run on a trusted host with this project's protected environment:

```sh
npx tsx --env-file-if-exists=.env.local scripts/concierge-preflight.ts --target live
```

The `--target live` selector uses the repository's existing `SHARETRIBE_LIVE_*` local aliases. On a host already configured with the production standard names, omit that selector; the marketplace-name check still refuses Test.

This script makes read-only marketplace/listing/ledger queries, validates Live marketplace and documented database identity, and prints only product config/table privacy state—never credentials, operator contacts, customer records or raw upstream errors. It does not rotate secrets, create a listing, charge Stripe or migrate data.

Then validate anonymous search, both **Stripe test-mode** checkout tiers, return-cookie continuity, eligible/invalid/exhausted pass behavior, RLS, request persistence and a real unclaimed Live listing using isolated staging services. Do not perform real purchases as a smoke test without separate approval. The retired desk path cannot be certified as working because it no longer exists in production source.

## Phase 2 (not a launch claim)

- Staff SSO/owner authorization and an admin UI: requests, purchases, unlocks, inactive buyers and catalog claim status. Existing staff auth is explicitly development-grade HTTP Basic; do not silently equate it with a Derek-specific production identity.
- Operator dispatch/response workflow with outreach approval and explicit availability records.
- Distributed abuse controls/AI budget limits; current limiter follows the application's process-local pattern.
- Lead retention/deletion operations and conversion reporting over the new funnel events. Session access expires after 30 days, but expiration is not automatic record deletion.
- Unknown/custom ride requirements and multi-product event coverage need explicit business rules; never infer that a standard pass covers Ferris-specific contacts.

## Test evidence

See `reports/concierge-validation.md` for the final command outcomes and limitations. Browser screenshots use fictional buyer/operator contacts and a fake Stripe gateway; they are not evidence of Live purchases or operator availability.
