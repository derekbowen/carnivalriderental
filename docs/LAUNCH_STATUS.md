# Launch status — Carnival Ride Rental (2026-10-05)

Model: **marketplace** (founder decision 2026-10-05). Operators supply and fulfil; Carnival Ride Rental runs discovery, requests and transactions. Everything below is in the Sharetribe **Test** marketplace (`carnivalrental-test`, hosted at https://carnivalrental-9ecfo8.mysharetribe-test.com). Payments are test mode only, and every page is noindex.

## 1. Where it stands

| Level | Status |
|---|---|
| **Working on the deployed domain in test mode** | **Yes.** Search, ride detail, requests, request desk and replies work on https://carnivalriderental.us against Sharetribe Test. |
| **Ready for real customer requests** | **No.** The site reads the Test marketplace, which is not production data. Real requests need the Live marketplace, the request desk in Live, and someone watching the desk inbox. Owner actions are in §5. |
| **Ready for real payments** | **No.** Five blockers: no Carnival Ride Rental Stripe account yet; commission not decided (Console currently says provider 10%, `program.ts` promises operators 0%); no claimed operator; no operator-approved prices; Live not set up. |

## 2. Deployed

- Domain: https://carnivalriderental.us (www redirects to it). Vercel project `prj_0bXznA04ruDEAaU6F2IN5gacDm70`.
- Branch `main`, fast-forwarded from `claude/nice-bohr-wm2cp4`.
- Production deployments (manual, because Vercel's production branch is not yet `main`; see §5):
  - `dpl_F7rTNGvqFxJFKdnXpQ1PxrqmUz3d` (b6a54bb);
  - `dpl_4tVpRqnh9n7UBYEePzXizWYkijh3` (9ebe495).
- Production env still has `APP_ENV=preview` and `PUBLIC_INDEXING=false`. Result: `robots.txt` is `Disallow: /` and every page has `noindex`.
- Public env added: `SHARETRIBE_CLIENT_ID` (Marketplace API client ID, read-only), `REQUEST_DESK_LISTING_ID`, `SHARETRIBE_MARKETPLACE_URL`. The site holds **no** secrets: no client secret, no Integration API key, no Stripe key.

## 3. What works, with evidence

### Search (`/s`)

- Searches every live operator ride: Sharetribe returns **3,714**.
- Sorted nearest first by Sharetribe's `origin` search across the whole inventory, not per page.
  - Evidence: from Cleveland, page 1 runs 17→92 mi and page 2 starts at 92 mi.
- Search origin, in order of preference:
  1. the visitor's exact location, if they opt in with a button;
  2. a state they pick from the selector (the fallback when there's no geolocation);
  3. Vercel's IP location;
  4. the centre of the US.
- Cards say "Based in <city> · ~N mi away", measured to the operator's home base. They never claim where a ride is today.
- Ride-type filters and paging work.
- Price shows the rate-card estimate, or "Request a quote" for sizes without a confirmed rate. Never $0.
- Buttons:
  - "Request this ride" on every ride today.
  - "Book this ride" appears only when the listing is claimed **and** `metadata.bookable=true`. Only `npm run ops:bookable` writes that flag, after server-side checks.
  - "View ride details" appears only once the Sharetribe listing page renders (see §4).
- Mobile menu, "Find a ride" link → `/s`: e2e `mobile.spec.ts`.
- State and city pages show the 8 nearest operator rides, from the same search and one cached query.

### Requests (no payment)

- `/request?listing=<id>` sends a **Sharetribe inquiry** (`default-inquiry/release-1`) from the customer's own marketplace account.
  - The request is created straight from the browser with the public client ID; the password goes only to Sharetribe.
  - It records: date, start and end time, address, city, state, ZIP, guests, name, phone, email (the account email) and notes.
  - Success shows only after the transaction **and** the first message are saved.
  - A per-request key stops duplicates (a double-click or a resubmit shows "You already sent this request").
- Unclaimed ride → inquiry on the **request desk** listing `6ac33abd-b76c-40b2-adce-c7057e92b2e2`, owned by the house account support@carnivalriderental.us. The copy says the operator has **not** received it.
- Claimed operator → inquiry on the operator's own listing.
- General `/request` (no ride chosen) → request desk.
- Evidence:
  - Local build: tx `6ac33c30-74e1-4dc6-8542-53208e92d5c6`; resubmitting returned the same reference (duplicate guard).
  - Live domain: tx `6ac34b49-8dcc-479d-8145-a03bc572b5ab`.
  - Desk reply sent with `npm run desk:reply`; the thread shows both messages.
  - Sharetribe emailed support@ ("new inquiry", "new message"). The mail arrived in Resend inbound.

### Operator flow, proven with QA accounts only (`npm run qa:journey`)

1. `npm run ops:claim` checks ownership:
   - the operator's email must be on the company's own website domain, or the founder records a manual verification;
   - a gmail address for Alamo Attractions was refused.
2. It hands over the existing placeholder account:
   - password reset through our inbound mail, then `change_email` to the operator;
   - `claimStatus=claimed`, and the unclaimed notice is removed from the listings.
3. Listings, images and source mappings stay where they were; nothing is duplicated.
4. Results (QA operator `6ac349fa-…`, QA listing `6ac349fd-…`):

| Check | Result |
|---|---|
| Operator logs in | PASS |
| Operator sees only its own inventory | PASS |
| Operator edits its own ride | PASS |
| Operator edits another company's ride | Refused, HTTP 403 |
| Customer inquiry reaches the claimed operator's inbox (tx `6ac34a60-8db6-4e8a-8de2-eddc95d5c413`) | PASS |
| Operator replies | PASS |
| Thread is still there after logging in again | PASS |
| Payment attempt on a non-bookable ride | Refused, HTTP 403 |

### Payments, Sharetribe test mode (`npm run qa:payment`, QA fixture only)

Used Sharetribe's own Stripe integration: `default-booking/release-1`, destination charges, commission as an application fee.

| Step | Result |
|---|---|
| QA operator Stripe onboarding (Custom account through Sharetribe) | `stripeConnected=true` |
| Booking request | tx `6ac34c71-14d9-4dbc-84fe-4b35ac1a4a6d` |
| Line items | day $100.00 (QA test price); provider commission −$10.00 from Console's current **10%** |
| Test-card authorisation | `pi_3UN5yfINWe8ia18U0nhyUrAz` → `requires_capture` |
| Same dates again | Refused, 409 `transaction-booking-time-not-available` |
| Operator accepts | PaymentIntent `succeeded`, i.e. captured |
| Marketplace `transition/cancel` | Full refund |
| Declined card (`pm_card_chargeDeclined`) | Never authorised; confirm-payment refused (409) |

- The QA listing went back to inquiry-only afterwards.
- **Caveat:** this used the Stripe **test** key already configured on the Test marketplace (publishable `pk_test_51IDRRz…`). That is **not** the Pool Rental Near Me account (`acct_1PZNAW…`), and it is also **not** a Carnival Ride Rental account. The mechanics are proven; the Carnival account is not connected yet.

### Booking eligibility (server side)

- `src/lib/operators/claim.ts → bookingBlockers` sets the rules; `npm run ops:bookable` applies them.
- A listing is bookable only with **all** of:
  - claimed account;
  - `rideApproved` (team review);
  - `stripeConnected`, read from Sharetribe;
  - payouts and charges enabled, read from Stripe's API with the platform key;
  - an operator price;
  - a decided commission.
- Connecting Stripe alone never makes a ride bookable.
- Every operator listing is currently on the inquiry process, which cannot take payment.

### Inventory

- 3,714 operator listings are published in Test, and 3,501 have the operator's own photo.
- Gaps:
  - 159 rides have no source photo;
  - 54 photo exceptions, listed in `imports/photos/carnivalrental-test/exceptions.json`:
    - 22 are bot-check pages, deliberately not bypassed;
    - 21 were HTTP 503, now on a one-time retry;
    - 11 were 404, 403 or 406.
- A sample of 8 photos was checked by eye: all match their ride.
- `npm run listings:enable-inquiry` is still running. It sets the inquiry process and the truthful unclaimed notice on every listing; before that, Sharetribe listing pages showed "The listing contained invalid data". Progress is in `imports/listings/carnivalrental-test/inquiry-ledger.jsonl`. It can be resumed, and `/s` hides the details link until a listing is done.

### Email

- **Sharetribe** sends account mail (verification, password reset) and every transaction notification (inquiry, message, booking). This is in Test mode, and the subjects carry "[TEST MODE]".
- **Emailit** sends only our outbox: legacy request emails and future claim invites. The marketplace request flow sends nothing from Emailit, so nothing is duplicated.
- The Emailit domain carnivalriderental.us is **pending_review**: SPF, DKIM, return-path and DMARC are all OK, and `manual_review_required` is true. Nothing sends from Emailit until it's approved.
- A support draft is in `docs/drafts/emailit-domain-review.md`; it has not been sent.
- Claim invites are prepared (template updated for listed, not-yet-claimed operators) and not sent. Sending needs the postal address, Emailit approval and your explicit go.

## 4. Known gaps (not hidden)

- The hosted Sharetribe marketplace UI still has default branding ("YOUR LOGO") and default footer text: Console → Design.
- The hosted Test marketplace's own search lists the request desk listing and the QA listing. They are labelled, and `/s` excludes them.
- The **Console commission is provider 10%**. That contradicts the operator page's "0% for operators". Commission is undecided, so real money stays gated.
- Booking far ahead: a card hold lasts 7 days; the operator must accept within about 6 days; capture happens at acceptance; payout comes after the booking ends; Stripe holds funds about 90 days at most. Events more than ~80 days out need a decision (saved card plus later charge, or a different flow). See `OPERATOR_MARKETPLACE.md` §3. Not built.
- Vercel's production branch isn't `main` yet, so pushes to `main` build previews. Production deploys are triggered manually for now.

## 5. Owner actions (only these need you)

1. **GitHub** → derekbowen/carnivalriderental → Settings → General → Default branch → `main`.
2. **Vercel** → carnivalriderental → Settings → Environments → Production → Branch tracking → `main`.
3. **Stripe**:
   - Create a new Stripe account for Carnival Ride Rental / 10000 Solutions LLC (not Pool Rental's).
   - Follow Sharetribe's setup: Marketplace business model, Connect with "Onboarding hosted by Stripe" and "Build your own with our API", manual payout schedule.
   - In Sharetribe Console (**Test**) → Build → Integrations → Payments, paste that account's `pk_test_…` and `sk_test_…`.
   - Put `STRIPE_SECRET_KEY=sk_test_…` in `.env.local` for `ops:bookable`, or tell me to.
4. **Commission**: decide the rate and who pays (customer fee or operator commission). Until then, real payments stay off.
5. **Request desk login**: the house account support@carnivalriderental.us has a new password, set during this work and stored as `HOUSE_ACCOUNT_PASSWORD` in `.env.local`. To work the desk in the browser, use "Forgot password" on the marketplace with support@; the reset mail lands in Resend → Receiving.
6. **Emailit**: wait for domain review, or send the prepared support draft.
7. **Claim invites**: give a real business mailing address and an explicit "send".
8. **Console → Design**: logo, colours and footer for the hosted marketplace.

## 6. Live environment (not started; nothing carries over automatically)

Test users, listings, images, transactions, connected Stripe accounts and the request desk do **not** exist in Live. To launch:

1. Sharetribe Live plan, with the custom domain and sender (Pro plan for the custom domain).
2. Live Console config: listing types, fields, search, the inquiry and booking processes, commission. Copy them from Test.
3. Stripe **live** keys from the Carnival account in Live Console.
4. Re-run the imports against Live:
   - companies, then listings, then photos, then `listings:enable-inquiry --target live --founder-go`;
   - the scripts refuse Live without that flag.
5. `desk:setup --target live --founder-go`, then point production env at the Live client ID, desk listing and marketplace URL.
6. Operators claim with `ops:claim --target live --founder-go`, connect payouts in the marketplace, then go through `ops:bookable`.
7. Set `PUBLIC_INDEXING=true` and `APP_ENV=production` only on your explicit go.
