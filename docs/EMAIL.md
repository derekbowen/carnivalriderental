# Email (Emailit; Resend fallback) — transactional and outreach

Production status (2026-10-14): **`EMAILIT_API_KEY` is set on Vercel production** (founder, 13:04 UTC)
and Emailit accepts mail from `notifications@carnivalriderental.us` (domain approved). A production
"Lost my link" request for `qa@` sent its pass links without error. `EMAIL_MODE` is unset (= `test`), so
all mail, including buyers' pass emails, goes to `qa@carnivalriderental.us` until the founder sets
`EMAIL_MODE=live`. The pass still opens through the Checkout return URL and the signed cookie.

Provider (2026-10-05): **Emailit** for transactional and marketing mail. The key is `EMAILIT_API_KEY` in `.env.local`. The Emailit account is shared with another business: only ever send from carnivalriderental.us addresses, and never read or touch the other domains' mail or settings. Domain status in Emailit on 2026-10-05: SPF, DKIM, return-path and DMARC all OK, verification **pending Emailit's manual review**; nothing sends until Emailit approves it. Resend still receives inbound mail (root MX), so keep the Resend domain until inbound moves.

Status (2026-10-04): built and proven in **test mode**. A demo request's "request received" email was sent through Resend from `notifications@carnivalriderental.us`, delivered, and received back at `qa@carnivalriderental.us` with the subject `[TEST → pipeline-test@example.com] We received your request BAC-SCW6CH`. No email has gone to a customer or operator.

Update (2026-10-14, later): `EMAIL_MODE=live` is set on production (founder), so pass emails, recovery links and requested saved searches go to customers. Outreach and commercial lifecycle email stay blocked until `BUSINESS_POSTAL_ADDRESS` and the campaign approval are set (below).

Update (2026-10-17): the founder set `BUSINESS_POSTAL_ADDRESS` and approved `lifecycle-v1` only (`EMAIL_APPROVED_CAMPAIGNS=lifecycle-v1`, production), and production was redeployed, so the follow-up templates (search and checkout abandonment) now send under the rules below. Operator outreach (`claim-invite-v1`) is **not** approved.

## Lifecycle email (founder decision 2026-10-14)

Five approved templates, rendered by the app from ledger facts (`src/lib/lifecycle/templates.ts`). Rules decide who is due what (`engine.ts`); Vercel AI Gateway, when enabled, only picks among the templates already due and may add one validated intro line (`ai.ts`); the email API (Emailit, `src/lib/email`) sends. AI never writes an email, never sees the customer's address, and any line with a number that isn't a fact, a price, availability, booking, guarantee or urgency claim, a link or contact details is discarded for the default copy.

| Template | Kind | Trigger | Stops |
|---|---|---|---|
| `saved_search` | transactional | the customer presses "Email me these N {city} options" on the matches page, or "Email me these options" in the chat concierge; sent at once | once per request, whichever button |
| `search_abandonment_1h` | commercial | matched request, no checkout, the address inactive ≥ 60 min, request 1–6 h old | any paid Event Access for the address |
| `search_abandonment_24h` | commercial | matched request 24–48 h old, inactive | same |
| `checkout_abandonment_1h` | commercial | checkout started, not paid, 1–24 h ago, inactive ≥ 60 min | same |
| `purchased_no_unlock_2h` | transactional | active pass, 0 unlocks, 2–72 h after purchase; the button is a fresh pass sign-in link | first unlock |

Everywhere: only the address's newest search is chased; never a zero-match request or a past event date; at most one sales email per address per 20 h; never to carnivalriderental.us or reserved test domains; unsubscribed addresses (ledger table `access_email_suppressions`, written by `/api/email/unsubscribe`) get nothing; commercial sends are capped at 200 a day. Creating an account or typing an email sends nothing by itself.

Chat concierge (`docs/CONCIERGE_MVP.md`, off unless `CONCIERGE_ENABLED=true`): its email capture feeds this system; there is no second engine. A request created in the chat (source path `/concierge`) gets the three sales templates only if the customer ticked the optional, unticked "Also remind me about this search" box when giving their email, recorded as `email_capture_accepted` with consent in `access_lifecycle_events`; the latest capture in the session wins. Typing an email into the chat is never consent. The chat and web funnel record the lifecycle hooks `chat_started`, `email_capture_offered`, `email_capture_accepted`, `search_submitted`, `listing_viewed`, `event_access_offered`, `checkout_started`, `event_access_purchased` and `operator_unlocked` in the same table (identifiers only); hooks never send anything themselves. `tests/concierge-lifecycle.test.ts` covers duplicates across chat and web.

Gates (live mode): commercial templates need `BUSINESS_POSTAL_ADDRESS` (CAN-SPAM footer) **and** `lifecycle-v1` in `EMAIL_APPROVED_CAMPAIGNS`. Until both are set they are recorded as `blocked` in `access_lifecycle_emails` (with the reason) and retried on every run while still due, so nothing is lost and nothing goes out early. Transactional templates send now. Unsubscribe links are signed with `EMAIL_UNSUBSCRIBE_SECRET`, or a key derived from `ACCESS_SESSION_SECRET` when that isn't set.

Schedule: Vercel Cron (Pro plan) calls `GET /api/lifecycle/run` every 10 minutes (`vercel.json`), so the "1 h" emails go out 60–70 minutes after the customer goes quiet. Vercel Cron is internal; calls from outside Vercel (Supabase `pg_net`, cloud servers) get Vercel's Security Checkpoint (HTTP 429 challenge) on every path, so an external scheduler can't reach the app. The endpoint sends only what is due, once per logical email (`dedupe_key`), and a run lock skips calls less than 4 minutes apart; set `CRON_SECRET` (Vercel Cron sends it as a bearer token) or `LIFECYCLE_RUN_TOKEN` to require one.

Review: `npm run lifecycle:preview -- <dir>` renders all five with sample data. What went out, and why something didn't:

```sql
SELECT template, status, reason, personalized, count(*) FROM access_lifecycle_emails GROUP BY 1, 2, 3, 4 ORDER BY 1, 2;
```

## Who sends what

| Sender | Emails |
|---|---|
| Sharetribe (its managed SendGrid; can't use Resend) | account emails: verify email, password reset; transaction-process emails. In Test the sender address is fixed (only the name can change). In Live, set a custom sender in Console → General → Outgoing email address (CNAMEs on our domain). |
| **Emailit** (this module; founder choice 2026-10-05, Resend kept as fallback via `EMAIL_PROVIDER=resend`) | our app's emails: request received, payment received, quote ready, internal paid alert; operator claim invitations (outreach) |

Domain `carnivalriderental.us`:
- verified for sending and receiving in Resend (DKIM, SPF via `send.`);
- DMARC `p=none` is published;
- receiving catches `claims@` (replies to invites), `qa@` (test inbox) and the 184 company claim addresses.

## How it works

- **Outbox:** `email_outbox` table in the app DB. The request service writes the email in the same transaction as the event that causes it (`src/lib/email/notify.ts`). Each logical email has a dedupe key, so retries never double-send.
- **Dispatch:** `npm run email:dispatch` sends pending rows via the configured provider (`EMAILIT_API_KEY` set → Emailit v2 API, open/click tracking off; else Resend), with an Idempotency-Key per row. Failures are retried, up to 5 attempts.
- **Test mode (default):** `EMAIL_MODE` is unset or `test`. Every email goes to `EMAIL_TEST_RECIPIENT` (default `qa@carnivalriderental.us`) and the subject names the intended recipient. `EMAIL_MODE=live` is a founder decision.

Outreach gates, all enforced in code:
- the campaign must be listed in `EMAIL_APPROVED_CAMPAIGNS` (live mode), otherwise the row is `blocked`;
- every outreach email needs an unsubscribe link: an HMAC link to `/api/email/unsubscribe`, plus a `List-Unsubscribe` one-click header (RFC 8058);
- unsubscribed addresses are `suppressed` forever;
- a warm-up daily cap applies: 25 → 50 → 100 → 200 → 400 sends per UTC day;
- `BUSINESS_POSTAL_ADDRESS` is required (CAN-SPAM). Invites can't be queued without it.

## Claim invitations (`npm run email:claim-invites`)

- **Recipients:** imported, unclaimed companies with a contact email in the workbook. Today that's 77 of 184, of which 46 already have accounts; the number grows as the account import finishes.
- **One invite per company.** The copy is factual. It says the profile is unclaimed and unpublished, and offers claim, correction or removal by reply. It makes no fee, traffic or feature claims (operator copy isn't approved).
- **Steps:**
  1. Dry run.
  2. `--enqueue` (needs the postal address).
  3. `email:dispatch`.

  In test mode the invites land in `qa@`, so you can review them before any approval.

## Env (`.env.local`)

| Name | Purpose |
|---|---|
| `RESEND_API_KEY` | send/receive (set) |
| `EMAIL_MODE` | `test` (default) or `live` |
| `EMAIL_TEST_RECIPIENT` | default `qa@carnivalriderental.us` |
| `EMAIL_ADMIN_RECIPIENT` | founder alert on paid requests (optional) |
| `EMAIL_FROM_TRANSACTIONAL` / `EMAIL_FROM_OUTREACH` / `EMAIL_REPLY_TO` | defaults on `carnivalriderental.us` |
| `EMAIL_UNSUBSCRIBE_SECRET` | HMAC for unsubscribe links (set) |
| `BUSINESS_POSTAL_ADDRESS` | required for commercial email (CAN-SPAM footer); set on production 2026-10-17 |
| `EMAIL_APPROVED_CAMPAIGNS` | founder approval per campaign; production: `lifecycle-v1` (2026-10-17) |

## Before real sends

1. A postal address for the footer (a PO box or registered agent address is fine).
2. A separate outreach subdomain (`hello.carnivalriderental.us`): add it in Resend and add its DNS records in Cloudflare, then set `EMAIL_FROM_OUTREACH`. This keeps outreach complaints away from transactional delivery.
3. Founder go: `EMAIL_MODE=live` plus the approved campaign.
4. A scheduled dispatcher on the deployed ATM (cron). Today dispatch is a command.
