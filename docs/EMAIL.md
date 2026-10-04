# Email (Resend) — transactional and outreach

Status (2026-10-04): built and proven in **test mode**. A demo request's "request received" email was sent through Resend from `notifications@carnivalriderental.us`, delivered, and received back at `qa@carnivalriderental.us` with the subject `[TEST → pipeline-test@example.com] We received your request BAC-SCW6CH`. No email has gone to a customer or operator.

## Who sends what

| Sender | Emails |
|---|---|
| Sharetribe (its managed SendGrid; can't use Resend) | account emails: verify email, password reset; transaction-process emails. In Test the sender address is fixed (only the name can change). In Live, set a custom sender in Console → General → Outgoing email address (CNAMEs on our domain). |
| **Resend** (this module) | our app's emails: request received, payment received, quote ready, internal paid alert; operator claim invitations (outreach) |

Domain `carnivalriderental.us`:
- verified for sending and receiving in Resend (DKIM, SPF via `send.`);
- DMARC `p=none` is published;
- receiving catches `claims@` (replies to invites), `qa@` (test inbox) and the 184 company claim addresses.

## How it works

- **Outbox:** `email_outbox` table in the app DB. The request service writes the email in the same transaction as the event that causes it (`src/lib/email/notify.ts`). Each logical email has a dedupe key, so retries never double-send.
- **Dispatch:** `npm run email:dispatch` sends pending rows via Resend, with an Idempotency-Key per row. Failures are retried, up to 5 attempts.
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
| `BUSINESS_POSTAL_ADDRESS` | **required for outreach — not set** |
| `EMAIL_APPROVED_CAMPAIGNS` | e.g. `claim-invite-v1`, founder approval |

## Before real sends

1. A postal address for the footer (a PO box or registered agent address is fine).
2. A separate outreach subdomain (`hello.carnivalriderental.us`): add it in Resend and add its DNS records in Cloudflare, then set `EMAIL_FROM_OUTREACH`. This keeps outreach complaints away from transactional delivery.
3. Founder go: `EMAIL_MODE=live` plus the approved campaign.
4. A scheduled dispatcher on the deployed ATM (cron). Today dispatch is a command.
