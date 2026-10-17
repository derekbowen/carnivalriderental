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

**Model boundary.** The model gets the customer's message, recent chat history, the event facts (never the stored name, email or phone: `modelInput`), public inventory cards and the server-loaded product terms. It never gets operator identity or contact data, pass or unlock records, Sharetribe or Stripe credentials, or tools. It cannot authorize contact access: unlocks happen only through the `unlock` action, which checks the signed pass cookie before any contact read. `tests/concierge-model-privacy.test.ts` captures every model call in a paid flow with unlocked contacts and checks this.

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

The concierge is **off until the founder turns it on**. Merging or deploying this code changes nothing in production: the widget, `/concierge` and `/api/concierge` return nothing (404) unless `CONCIERGE_ENABLED=true` (`src/lib/concierge/flags.ts`).

Its tables live in `src/lib/access/schema-concierge.sql`, **not** in `schema.sql`, so the ledger's cold-start initialization never creates them on Postgres:

- `concierge_sessions`: hashed opaque cookie token, structured lead, last selected search, Event Access request reference, 30-day session expiration.
- `concierge_requests`: structured availability/event request, optional listing reference, review status.
- `access_lifecycle_events`: the lifecycle hooks (below). Action names, IDs and the reminder-consent flag only; no message text, email addresses or contact values.

To turn the concierge on, in this order:

1. `npm run access:migrate -- --concierge` against the production ledger with the table-owner connection. It applies `schema-concierge.sql` and enables RLS with no policies and no PUBLIC grants on the three tables (`applyConciergeSchema`). Verify with `scripts/concierge-preflight.ts`.
2. Set `CONCIERGE_ENABLED=true` in Vercel production and redeploy (the widget is rendered by the root layout, so it needs a build).

SQLite (development, tests, e2e) applies the concierge schema automatically. Lifecycle-event writes are best effort and happen after the checkout, activation and unlock transactions commit, so a missing table never breaks a payment or an unlock.

No new required production secret is introduced. Reuse `ACCESS_DATABASE_URL`, Sharetribe, Stripe and signed pass-session configuration. **Model:** the concierge uses the same Claude model as lifecycle email through Vercel AI Gateway (`src/lib/ai/models.ts`): `CONCIERGE_MODEL` if set, else `LIFECYCLE_AI_MODEL`, else `anthropic/claude-haiku-5.5`. There is no other provider default. On Vercel the AI SDK authenticates to the gateway with the deployment's OIDC token; `AI_GATEWAY_API_KEY` works elsewhere.

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

## Pre-launch review (2026-10-14)

Fixed before switching the concierge on (`tests/concierge-review.test.ts`):

- **No duplicate requests after chatting.** Every chat turn used to clear the session's link to its event request, so pressing "Email me these options" or "See access offer" again after more chat created a new request, and could send another saved-search email. The link now stays; `reusableRequest` reuses it only while the email, date, place and ride still match.
- **Tolerant AI extraction.** The model fills a loose schema (US states and ride types as fixed lists). `mergeLead` validates each field on its own and keeps the previous value for anything missing or malformed, so one bad field no longer fails the whole turn. Uses `generateText` with structured output (`generateObject` is deprecated in AI SDK 7).
- **Well-formed history for Claude.** `chatMessages` drops the widget's leading greeting, merges repeated roles, keeps the newest 6,000 characters and ends on the customer's message.
- **Availability requests reach the team.** They are emailed to support@, like a manual search. A request is marked `with_team` only once the email provider accepts the notice; if it fails, the customer is told so and pressing again retries the same request (no duplicate row, same idempotency key). The same request pressed again within a day is not duplicated.
- **No dead end on a no-match search.** The chat links to the request's matches page, where the no-match alternatives and the free manual search live.
- **Operations.** AI and request failures are logged (message only, never payloads). Chat messages have their own per-IP limit (20 per 10 minutes) because each is two AI calls.
- **Display.** Unlocked contacts show labelled fields with phone, email and website links. The floating widget is hidden on `/concierge`, which already is the full concierge.

## Email: one lifecycle system

The chat has no email engine of its own. Its email capture feeds the lifecycle system in `src/lib/lifecycle` (`docs/EMAIL.md`), the same one that serves the web funnel:

- After results are shown, the chat offers **Email me these options** (recorded once per session as `email_capture_offered`). Submitting it records `email_capture_accepted`, saves the email on the lead and, when the event details are complete and the request is sellable, sends the lifecycle `saved_search` email through `sendSavedSearch`. That email is deduplicated per event request, so pressing the button again, or pressing the web "Email me these results" button for the same request, never sends a second one. The chat reuses the same request for the same details within 6 hours instead of creating a new one.
- An optional, **unticked** box, "Also remind me about this search", is the only follow-up consent. Typing an email into the chat, registering or buying is never consent. The lifecycle engine sends sales reminders (`search_abandonment_1h`, `search_abandonment_24h`, `checkout_abandonment_1h`) for a chat-originated request only if the latest `email_capture_accepted` in that chat session has consent (`chatFollowupConsent`); unticking it on a later capture withdraws it. Everything else is the engine's existing rules: newest request only, at most one sales email per address per 20 hours, stop on any paid Event Access, suppression and unsubscribe, the 200/day cap, and in live mode the `lifecycle-v1` campaign approval plus `BUSINESS_POSTAL_ADDRESS`. Until the founder sets those, commercial reminders are recorded as blocked and not sent.
- `purchased_no_unlock_2h` is customer service for a paying customer and follows the engine's rule for every purchase.

Lifecycle hooks (`src/lib/lifecycle/events.ts`, table `access_lifecycle_events`): `chat_started`, `email_capture_offered`, `email_capture_accepted`, `search_submitted`, `listing_viewed`, `event_access_offered`, `checkout_started`, `event_access_purchased`, `operator_unlocked`. Chat actions are recorded with source `chat`; checkout, purchase and unlock carry `chat` or `web` from the request's source path. The hooks never schedule or send anything; the engine reads only the consent flag.

The PR's original follow-up jobs (`concierge_followup_jobs`, `concierge_events`, `scripts/concierge-followups.ts`, the resume and unsubscribe routes) were removed in favour of the above. Unsubscribe is the lifecycle `/api/email/unsubscribe` link in every commercial email.

Not implemented: per-person browsing/UTM profiles tied to an email (needs a consent decision first), lead scoring and email open/click webhooks. Aggregate traffic and the funnel dashboard are below (2026-10-17).

## Model and running without AI (2026-10-15)

- On launch, AI Gateway refused `anthropic/claude-haiku-5.5` ("Free tier users do not have access to this model"), so every chat message got the no-AI fallback. The founder chose OpenAI GPT-3.5 (`openai/gpt-3.5-turbo`), then switched the same day to GPT-4o mini, which follows the policy prompt more closely and costs less: `CONCIERGE_MODEL=openai/gpt-4o-mini` in Vercel production (the code default stays Claude; delete the variable to go back). Topping up AI Gateway credits also lifts the block.
- Extraction asks for a plain JSON object and parses the first one in the reply (`parseExtraction`), so models without JSON-schema output (GPT-3.5) work; `mergeLead` validates every field either way.
- Reading the event details and writing the reply are separate steps that fail independently. With no AI at all, `src/lib/concierge/faq.ts` answers pass and policy questions (expiry, no reply, dead contacts, refunds, lost link, price, booking, support) from the product rows and `/access-policy`; anything else points to the event form and support@. No random ride cards are shown when the details couldn't be read.

## The chat knows where the conversation stands (2026-10-15)

Founder test: "hello" produced four Missouri rides "290 miles" from nowhere (distance from the middle of the country), an "Email me these options" form for them, and "I can't confirm" to "did you send me the email".

- No search without a city/state or a ride type (`leadState().searchable`, `src/lib/concierge/state.ts`); the reply carries `search: null` and the model is told there is no search yet, so it asks. Distances show only once the origin is a city or state.
- Every chat turn gives the model `conversationState()` (service.ts): the public event facts, what is still missing, `emailOnFile`, `savedSearchEmailSent`, `eventRequestSaved`, availability requests and passes in this browser. Never the address, phone or name. The no-AI path answers "did you send the email" from the same record (`emailStatusAnswer`).
- Messages name what is missing (`needDetails`): capture, Request Availability and See access offer say "I need your event date, city and state, and email" instead of a generic sentence; the capture confirmation echoes the address so a typo is visible.
- Widget: the capture form appears only when it can send; otherwise a one-line hint. Request Availability is disabled until it can work. "Start over" clears the tab's chat and the saved event.
- Live replay after the change: "I need a Ferris wheel in Columbus, Ohio on June 15 2030" saved the date and place but no ride (GPT-4o mini wrote the ride type in a form the schema rejected), so the search ran unfiltered and the reply called a kiddie ride an available Ferris wheel. Fixed deterministically: `resolveRideType` accepts ids, names, spaces and underscores; `rideTypesMentioned` takes the ride from the customer's own words when the model returns none; `withAvailabilityGuard` appends a correction to any reply that asserts a ride "is available", and the prompt forbids the wording.

## Price answers, site help, the email offer and tracking (2026-10-17)

Founder test: "How much is it" got "$99 for up to 5 operators for 30 days" with no word on what the fee buys; the assistant never offered to email the options or explained how to use the site; nothing counted visitors.

- **Price answers.** The prompt says every price is a one-time fee for direct contact details of matching independent operators, not the ride rental. `withPriceContext` (help.ts) appends that note to any reply with a `$` amount that doesn't mention both contacts and the rental, whatever the model wrote. The no-AI price answer says it too (faq.ts).
- **Site help.** `src/lib/concierge/site-guide.ts` lists the main pages from `paths.*` (find a ride, ride types, events, locations, how to rent, connect, the event form, find my pass, the policy, operators, contact). The model gets the list and may mention a page only by its exact path; the widget turns only those paths (or `carnivalriderental.us/…` forms of them) into links (`chatSegments`), so an invented URL stays plain text. "How does this work / I'm confused / where do I start" gets the three steps, with or without AI.
- **The email offer is the application's, not the model's.** The first time results are shown in a session (`email_capture_offered`), the route appends one line: "Want these options by email? Add your email under the results…", naming what is still missing. The widget shows the form whenever there are results and nothing was emailed. An email given before the date or city is kept: the chat turn that completes them sends the options (`sendPendingOptions`), once per session, only if the customer pressed "Email me these options" (typing an address is never a request), never after an options email already went to that session. The "remind me" box is still the only follow-up consent.
- **Tracking.** Vercel Web Analytics (`src/components/SiteAnalytics.tsx`, production only) counts page views, referrers, utm_* campaign tags, country and device without cookies. `analyticsUrl` (src/lib/analytics.ts) drops `/internal` and `/api`, counts `/pass/[id]`, `/connect/[id]` and `/requests/[reference]` by route, and drops every query parameter except utm_* (magic-link tokens, purchase ids, search details). The plain React integration is used so only that redacted URL is reported. Web Analytics was enabled on the Vercel project on 2026-10-17 (it collects only after a deployment following the switch); UTM breakdowns depend on the Vercel plan. Disclosed on `/privacy`.
- **Funnel dashboard.** `/internal/funnel` (behind the internal console's Basic auth) shows lifecycle events by name and source with chat sessions and reminder consent, a daily table, availability requests by status, purchases by product with live revenue (live-mode Stripe sessions only, net of refunds) kept apart from test-mode amounts, and lifecycle emails by template and status. Aggregates only: no addresses, messages, event details or contacts (`funnelReport`, src/lib/lifecycle/report.ts; `tests/funnel-analytics.test.ts`). The console needs `INTERNAL_USER` and `INTERNAL_PASSWORD` in Vercel production; without them every `/internal` page answers 503.

## Sales by source (2026-10-17)

Before raising the Google Ads budget (now $25/day; $100/day once cost per sale is under $80, against about $95.83 kept per $99 sale after Stripe fees) the founder needs cost per sale. `src/lib/attribution.ts`: the middleware keeps the latest `utm_source` / `utm_medium` / `utm_campaign` of a landing URL in the first-party `cr_src` cookie (30 days, HttpOnly; tags only, never click ids or personal data). A search started with it, on `/api/access/start` or in the chat, records one row in `access_attribution` (schema-concierge.sql; first tags win; best effort). `/internal/funnel` shows searches, sales and live revenue by source; divide the campaign's Google Ads spend by its sales there. The Google Ads campaign carries `utm_source=google&utm_medium=cpc&utm_campaign=crr-search` as its final URL suffix. Disclosed on `/privacy`. Tests: `tests/attribution.test.ts`.
