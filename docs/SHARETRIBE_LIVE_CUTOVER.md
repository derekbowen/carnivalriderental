# Sharetribe Live cutover (done 2026-10-14)

Status: **production runs on the Live marketplace "CarnivalRental"** (verified by API on 2026-10-14:
the Live Integration API and the Live Marketplace API both answer `marketplace/show` with
"CarnivalRental"; the Test marketplace is "CarnivalRental Test"). The earlier note that Live did not
exist is obsolete: the founder pressed **Go live** and created the two Live applications on
2026-10-14. Evidence and counts: `reports/live-migration-2026-10-14.json`; rollback:
`docs/ROLLBACK_2026-10-14.md`.

Users and listings can't be moved from Test to Live in Console. They were **recreated in Live through
the supported APIs** with the existing importers (`import:companies`, `import:listings`,
`import:photos`), deterministically, with deduplication and provenance.

## Credentials (never in Git)

`.env.local` (gitignored) keeps both environments side by side; nothing is swapped by hand:

| Variable | Environment |
|---|---|
| `SHARETRIBE_CLIENT_ID`, `SHARETRIBE_INTEGRATION_CLIENT_ID/_SECRET` | Test (standard names) |
| `SHARETRIBE_LIVE_CLIENT_ID` | Live Marketplace API app (`467a9abe…`, public) |
| `SHARETRIBE_LIVE_INTEGRATION_CLIENT_ID/_SECRET` | Live Integration API app (`5ef8fcd2…`) |

Scripts select Live only with `--target live` (`scripts/lib/target-env.ts`), and every write asserts
the marketplace name first (`--confirm-live "CarnivalRental"`, and the Integration and Marketplace
clients must name the same marketplace). `scripts/live-migration.ts` reads Live through the
`SHARETRIBE_LIVE_*` names directly and refuses any other marketplace. Vercel production holds the Live
values under the standard names (Integration ones as sensitive).

## Configuration (Live = Test, verified)

`npm run sharetribe:inspect -- --target live && npm run contract:diff -- --target live`: operator
contract **39/39 verified** — listing type `operator-ride-rental` on `default-inquiry/release-1`
(Free messaging, `unitType: inquiry`), no payout details, no availability calendar, every contract
field with its options and listing-type scope, provider commission **0%** (Test still says 10%; the
Live value is the intended one and was left as is), anonymous Marketplace API reads verified.
`contract:diff` now picks the snapshot by the marketplace name and capture time recorded inside it
(filename order once picked an old Test snapshot for a Live check) and checks the operator contract by
default; `--contract managed` runs the retired managed-rental contract.

**Access control:** "Approve users who want to join" is on; **"Make marketplace private" stays OFF**:
it makes the anonymous Marketplace API answer 403 and empties our catalog. Anonymous visitors (and
scrapers) can read user and listing `publicData` and `metadata`, so those fields are anonymous by
construction (next section). The hosted Live web app (`carnivalrental-9ecfo8.mysharetribe.com`)
still redirects to `www.mysharetribe.com` on 2026-10-14; the app does not use it.

## Migration source

The importers read `imports/company-accounts/source/workbook.json` (gitignored: private contacts).
It was rebuilt on 2026-10-14 from the native Google Sheet `Carnival_Host_Import` (Drive file
`12_MAKnyJm7acOGcmrK4gBntDHaso4us-KQo6vbnCR0s`; the second copy `1-o_QFWq…` has identical cells in all
7 tabs) via a Drive XLSX export and `scripts/company-import-extract.py`. The extractor now pads rows
to their header width (Google exports drop trailing empty cells), decodes OOXML `_xHHHH_` escapes, and
records the provenance: the recorded SHA-256 is the export's, not the original 2026-10-04 upload's.

**Freshness check** (`npm run migrate:live -- snapshot-test && npm run migrate:live -- reconcile`):
every planned row was compared with what Test serves today. Titles, public fields, rounded
geolocation and rider rules are identical for all 3,714 listings; none is missing in Test. The only
differences: the unclaimed notice (Test still shows the retired request-desk notice; Live uses the
current Event Access notice) and 5 descriptions in which Test still shows the company's name (Live
removes it: the name set includes the legal entity name). Test's QA ride and request-desk listing are
not migrated.

## Privacy at creation (new for Live)

Test was anonymised after import (`ops:anonymize`), and its public metadata still carries
`companyId` and `importExternalId` (company slugs) on every listing and user. Live never had an
identifying public field, not even briefly:

- accounts: `buildAnonymousPayload` → operator placeholder name and bio; `hqState`/`statesServed`
  only in `publicData`; company name, city, website, other operations, the original profile and the
  phone in `privateData` (the phone is not in `protectedData`, which a transaction process can
  reveal); public `metadata` = `claimStatus`, `importBatch`;
- listings: `buildAnonymousListingPayload` → unclaimed notice first, company names, links and emails
  removed from the description (original kept in `privateData.originalDescription`), inquiry alias set,
  public `metadata` = `claimStatus`, `importBatch`, `footprintSource` (+ `photoSource`), import id and
  company slug in `privateData`;
- created `pendingApproval`, photo attached, then approved.

`contacts.ts` reads the same fields as before (it already read `privateData.companyName/website/phone`
from anonymised Test accounts), so reveal after an entitlement is unchanged
(`tests/live-anonymous-import.test.ts`).

## What ran (2026-10-14)

```
npm run import:companies -- --apply --target live --confirm-live "CarnivalRental" --only <2 canary rows>            # canary (2 accounts)
npm run import:companies -- --apply --target live --confirm-live "CarnivalRental" --only <2 canary rows> --approve-users --founder-go
npm run import:listings  -- --apply --target live --confirm-live "CarnivalRental" --company <canary company>   # canary (3 listings)
npm run import:photos    -- --apply --target live --confirm-live "CarnivalRental" --from-test imports/migration/test-public.json --company <canary company> --approve --founder-go
npm run migrate:live -- verify                                                                                      # canary read-back
# same three commands again → exists / exists / already_has_images, 0 duplicates; then the full run:
imports/migration/run-full.sh   # companies (--approve-users) → listings → photos → approve remaining → verify
npm run import:photos -- --apply --target live --confirm-live "CarnivalRental" --from-test imports/migration/test-public.json --only <the GIF listing> --approve --founder-go
npm run migrate:live -- verify && npm run import:companies -- --apply --target live --confirm-live "CarnivalRental" && npm run import:listings -- --apply --target live --confirm-live "CarnivalRental"   # final read-back, idempotency reruns
```

Verified final state (fully paginated read-back, `npm run migrate:live -- verify`, 2026-10-14):

| Entity | Expected | In Live | Notes |
|---|---|---|---|
| Operator accounts | 184 (119 `A_ready` + 65 `B_account_only`) | **184**, all `active`, unclaimed, email unverified, no Stripe, anonymous public profile | 135 `C_verify_first` held, 11 `D_exclude` and the QA account not migrated. Live answers `409 user-pending-approval` to listings by pending authors, so imported accounts are approved with `--approve-users` (approval lets the account hold listings; it claims or verifies nothing). Claim addresses: `<companyId>@carnivalriderental.us` (our production domain, MX present); Sharetribe's verification emails go to that mailbox, never to operators. No invitations, resets or claims were sent; `ops:claim` was not run. |
| Listings | 3,714 (3,721 source rows − 7 held for privacy review, as in Test) | **3,714 published**, 0 pending, 0 closed | The canary's first attempt failed 3 times with `409 user-pending-approval` before the approval step; all 3 were then created. 0 duplicates (by private import id), 0 without the import marker. |
| Photos | 3,503 listings have a hosted photo in Test | **3,503 with an image**, every image URL serves an image (all 3,503 checked) | Copied from each Test listing's hosted image (Sharetribe CDN), not fetched from operator sites again; provenance in `privateData.photoSource`. One 100 MB animated GIF needed the first-frame JPEG fix (and a 150 MB bound for the Sharetribe CDN) and is attached. |
| Without photo | 211 | **211 published with the honest placeholder** | 159 rides never had a source photo; 52 had one that failed or was rejected in Test. Each is listed by Live listing id in `reports/live-migration-2026-10-14.json`. |
| Relationships | 3,714 | **0 drift** | Every Live listing's author is the Live account of the same company, and the Test listing with the same import id was authored by that company's Test account. |
| Public privacy | — | **0 leaks** | Anonymous Marketplace API read of all 3,714 listings and their authors: no company name (incl. legal names), contact or owner name, email, phone, link, company slug or import id in any public field; authors are the placeholder; public metadata keys are the allowed ones. |
| Idempotency | — | reruns: accounts `exists 184`, listings `exists 3714`, photos `already_has_images` | 0 created on rerun. |

Read-only matching against Live with the app's own `matchOperators` + `resolveCriteria`
(`npm run migrate:live -- match`, `reports/live-matching-check.json`): Columbus any ride → standard
($99), 5 distinct contactable operators from 150 listings; Columbus Ferris wheel → Ferris ($199), 13;
Chicago Ferris wheel → Ferris ($199), 13; Austin carousel → standard ($99), 4; an old Test Ferris
listing id posted with `rideType=carousel` → resolved to its Live listing, Ferris ($199), 14. The
contact lookup for the first match returned real channels (reported as booleans only).

Private working files (reverse-identity mappings, ledgers, the Test snapshot, logs) are in
`imports/migration/` and `imports/*/carnivalrental/`, all gitignored. Sharetribe itself is the
durable record: every migrated account and listing carries `privateData.importExternalId` and
`companyId`, so the mappings regenerate from Live. `import:companies --apply` does that itself before
any create (`recoverMapping`): from a fresh checkout it rebuilds the account mapping from Live, so an
operator who claimed their account and changed its email is found by import id, not missed by the
claim-address lookup and given a second account. Two accounts with one import id, or a mapping that
disagrees with Live, stop the run. Checked read-only on 2026-10-14: from an empty mapping, 184 of 184
Live accounts recovered, 0 conflicts, every one equal to the local mapping. Listings dedupe on the
private import id under the author, so the listing mapping needs no recovery.

## Snapshots and Test ids

`inventory:export -- --target live`, `inventory:operators -- --target live`, `inventory:validate`,
`pseo:duplicates`, `pseo:report`: `rides.json`, `operators.json`, `index-eligible.json` and
`reports/pseo-duplicates.json` are Live. `src/lib/inventory/test-to-live.json` maps each Test listing
id to the same listing in Live (public ids only): `/s/{test id}` answers **308** to `/s/{live id}` and
`/connect?listing={test id}` resolves to the Live listing (same ride and tier). Unknown ids still 404.

Access ledger: every purchase before the cutover was Stripe test mode (`cs_test_…`, QA addresses);
nothing was remapped or deleted. Test-mode passes are never entitlements on a live-keyed site
(`purchaseValidHere`), and while production runs a test key, Event Access is closed ("opening soon").
`operator_contact_status` rows are keyed by Test operator ids, which never collide with Live ids.

## Re-running

Every command above is idempotent: reruns report `exists` / `already_has_images`, and
`npm run migrate:live -- verify` fails on any duplicate, relationship drift or public leak.
A future workbook row whose title or public data (rider rules, location) names the company is held for
privacy review at planning, and `buildAnonymousListingPayload` refuses it as well: only the description
is rewritten (2026-10-14: 0 of 3,714 rows affected; still 7 held).
`imports/migration/run-photos.sh` resumes from the photo step.
