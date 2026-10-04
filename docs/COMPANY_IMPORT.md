# Company-account import (Carnival_Host_Import.xlsx → Sharetribe users)

Status: **built, dry run verified, nothing written to Sharetribe.** Live writes are blocked until a claim-email domain we control is configured (see Blockers). Scope: **company accounts only.** Listings ("Sharetribe Listings" sheet, 3,721 rows) are a later phase.

Code: `scripts/company-import-extract.py` (xlsx → JSON), `src/lib/imports/company-accounts.ts` (validation, payloads, idempotent loop), `scripts/company-import.ts` (CLI, API, guards). Tests: `tests/company-import.test.ts`.

## 1. What gets imported

| Tier (Companies sheet) | Count | Action |
|---|---|---|
| A_ready | 119 | import |
| B_account_only | 65 | import |
| **Eligible** | **184** | |
| C_verify_first | 135 | held: never imported by this script |
| D_exclude | 11 | excluded (Companies sheet only; no user row) |

The 319 Sharetribe Users rows are A + B + C. Only A and B are selected. Every row is cross-checked against the Companies-sheet tier, and any mismatch, duplicate or bad JSON blocks `--apply`.

## 2. API (verified 2026-10-04 against the Sharetribe API reference, plus read-only probes on Test)

Workbook headers are the import contract. These calls are what Sharetribe actually accepts:

| Step | Call | Notes |
|---|---|---|
| Lookup | Integration `GET users/show?id=` / `?email=` | Probe on Test: absent email → 404 `not-found`; malformed → 400 |
| Create | Marketplace `POST current_user/create` (anonymous token) | email, password, firstName, lastName, displayName, bio, publicData, protectedData, privateData. **Metadata is not accepted here.** Sends Sharetribe's verification email to the claim address; `emailVerified` stays false |
| Metadata | Integration `POST users/update_profile {id, metadata}` | operator-only field; claimStatus etc. |
| Evidence | Integration `users/show`, `listings/query?authorId=` | read back after each run |

Test limits: 1 query/s, 1 command/2 s per IP, 10 concurrent. The CLI spaces calls to those limits and retries 429 with backoff. Creates are never retried blindly after a timeout or 5xx: the next run's email lookup decides.

## 3. Data placement (who can see what)

| Field group | Sharetribe | Visible to |
|---|---|---|
| displayName, bio, publicData (companyName, hqCity, hqState, statesServed, website, otherOperations) | public | everyone |
| metadata (claimStatus, importBatch, companyId, importSource, researchStatus) | public, operator-writable | everyone |
| protectedData.phoneNumber | protected | owner, operator; revealable in a transaction |
| privateData (legal entity, owners name/title, contact name/email, street, ZIP, lat/lng, cwId, socials, season, events, route page) + `importExternalId`, `importBatch` | private | owner (after claim) and operator |
| **researchNotes, sources, owners[].source** | **not uploaded** | stay in the workbook: a claiming company would otherwise read our research notes |

Public-text sanitisation (reported on every dry run):
- Phone numbers in public text are removed (cw-880, cw-893, cw-1008, cw-1098).
- `otherOperations` entries that name a person ("contact Rob …", "run by Edwina and Ricky …") move to `privateData.otherOperationsNamingPeople` (cw-893, cw-901, cw-903).
- A row whose bio or display name leaks an email, phone, street or person's name fails validation. The exception is a name that is the company name ("Arnold Amusements").

`externalId` (e.g. `cw-1241`) embeds a private directory id, so it is stored in privateData, not public metadata.

## 4. Safety rules

- **Claim domain:** `IMPORT_CLAIM_EMAIL_DOMAIN` must be set. Validation fails on:
  - `<CLAIM_DOMAIN>`;
  - reserved or example domains;
  - consumer mail providers;
  - a domain without an MX record (checked before `--apply`).

  Emails are `{companyId}@{domain}`. Use a catch-all mailbox we own, because each create sends one verification email there.
- **Marketplace guard:**
  - `--target test` (default) refuses unless both API clients report "CarnivalRental Test".
  - `--target live` refuses on Test credentials and needs `--confirm-live "<exact Live marketplace name>"`.
- **No duplicates:** before any create, the run checks:
  1. the durable mapping;
  2. `users/show?email=`;
  3. that a found account carries our `privateData.importExternalId`.

  An account we didn't create is a `conflict` and is never adopted. A mapped account that has disappeared is reported, not recreated.
- **No overwrites:** an existing account only gets missing metadata completed (`resumed`), and its profile is never rewritten. Accounts with `claimStatus ≠ unclaimed` or a verified email are `skipped_claimed` and not touched.
- **No credentials kept:** the password is 24 random bytes, used for the one create call and discarded. Error text is redacted before it reaches the ledger.
- **Not done, by design:**
  - email verification;
  - Stripe accounts;
  - listings;
  - any contact with companies;
  - password resets.

## 5. State (commit these; they hold no credentials or private contacts)

- `imports/company-accounts/<marketplace-slug>/mapping.json`: externalId → { userId, email, companyId, createdAt }.
- `imports/company-accounts/<marketplace-slug>/ledger.jsonl`: one line per row per run: at, runId, externalId, companyId, outcome (`created | resumed | exists | skipped_claimed | conflict | failed`), userId, email, detail.
- `imports/company-accounts/source/` is **gitignored** (the workbook extract holds private contacts).

Reruns resume. Already-created rows report `exists`, and interrupted rows report `resumed`.

## 6. Commands

```sh
python3 scripts/company-import-extract.py /path/to/Carnival_Host_Import.xlsx   # per workbook version
npm run import:companies                                    # dry run: 184 / 135 / 11, exits 2 while blocked

# Test proof (after IMPORT_CLAIM_EMAIL_DOMAIN is set in .env.local):
npm run import:companies -- --apply --only cw-1241          # creates 1 account, prints verification evidence
npm run import:companies -- --apply --only cw-1241          # rerun: "exists", no create
npm run import:companies -- --apply                         # remaining eligible rows on Test

# Production (needs Live credentials in .env.local and founder approval):
npm run import:companies -- --apply --target live --confirm-live "<Live marketplace name>" --concurrency 3
```

## 7. Blockers

1. **Claim domain:** none configured, and Claude will not invent one. The founder chooses a domain we own with a catch-all inbox (e.g. a subdomain of the brand domain) and sets `IMPORT_CLAIM_EMAIL_DOMAIN`.
2. **Live marketplace:** `.env.local` holds Test (and Dev) credentials only. A production run needs the Live Integration and Marketplace client credentials and explicit approval.
3. **Claim process:** not built. It needs an operator procedure: password reset to the claim mailbox, change the email to the company's, then set `claimStatus` and verify. Until then the accounts are placeholders that only we can reach.
4. If a user type is added in Console later, rows need `publicData.userType`. Test has none today.
