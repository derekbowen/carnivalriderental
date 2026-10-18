# National gap audit import (2026-10-06 audit, founder go 2026-10-18)

Founder go 2026-10-18: "All missing equipment, with photos, and full descriptions." Also: hold the possibly inactive live operator from matching (done: `src/lib/access/holds.ts`).

Code:
- `src/lib/imports/gap-audit.ts` (pure: selection, rows, merge);
- `scripts/gap-audit-merge.ts` (`npm run import:gap-audit`).

Tests: `tests/gap-audit-import.test.ts`. Sanitized plan: `reports/gap-audit-import-plan.json` (counts only).

## What is imported

- **Rides:**
  - every row the audit marks READY;
  - REVIEW rows that are on the operator's own current site and already named.
- **Rides left out:**
  - registry-only or uncertain-ownership rows;
  - HOLD rows (a single weak source);
  - REJECT rows (not carnival rides: bounce houses, fixed parks);
  - rides at companies the audit flags inactive, renamed or historical;
  - REVIEW rows still waiting for a person to name them.
- **Companies:**
  - new companies the audit marks READY, each with at least one importable ride;
  - existing `C_verify_first` companies, promoted to `A_ready` only when the audit has a READY ride for them. Their missing HQ is taken from the audit's READY updates.
  - Existing accounts are never rewritten.
- **Descriptions:**
  - the audit's ride summary, with inspection, registration, insurance, price and availability claims removed;
  - research notes ("details on operator page") removed;
  - any clause naming the operator removed;
  - then the facts it recorded: minimum height, capacity, footprint and height.
  - Nothing is invented. A ride with no usable summary reads "<Class> ride listed by an independent operator."
- **Photos:** the first photo URL, which goes to `privateData.sourceImageUrl` (the photo importer's normal source, with provenance recorded and removal on request).

Dry run (2026-10-18), all with 0 blocking issues:
- 26 new accounts;
- 10 promoted accounts;
- 798 new listings, 627 with a source photo;
- 1 listing held for privacy (its title names the company).

## Live run (2026-10-18, done)

Founder go to apply on Live given in session on 2026-10-18, after the dry run matched. Every step ran a single canary first.
- **Merge:** rebuilt from the Drive export of `Carnival_Host_Import` and the uploaded audit zip; same counts as the dry run above.
- **Accounts:** 36 created and approved (26 new, 10 promoted); the 184 existing accounts were left untouched (`exists`). All 220 read back unclaimed, with an unverified email, no Stripe and an anonymous public profile.
- **Listings:** 798 created; 3,714 existing reported `exists`; 0 failures.
- **Photos:** 566 attached from the operator's page and published.
  - 61 could not be used: 35 were not JPEG/PNG/GIF and 26 failed to download (mostly 404).
  - Those 61 and the 171 rides with no source photo (232 in all) were published without a photo (`--approve-remaining`).
- **Verify** (`migrate:live -- verify`, Live side only):
  - 220 accounts and 4,512 listings, all published;
  - 0 duplicates, 0 author drift;
  - 0 leaks in the anonymous public read;
  - all 4,069 photos serve.
- **Inventory:** 4,512 rides from 164 operators.
- **Indexing:** the new snapshot moved 132 wave-2 pages out of their near-duplicate head position. `migrate:live -- wave --size 1000 --keep` swapped exactly those 132 for the next strongest gated candidates (`docs/PSEO_INDEXING_PLAN.md` §8).

## Running it (needs the Live credentials)

1. Set the Live credentials as environment variables or in `.env.local`:
   - `SHARETRIBE_LIVE_CLIENT_ID`;
   - `SHARETRIBE_LIVE_INTEGRATION_CLIENT_ID`;
   - `SHARETRIBE_LIVE_INTEGRATION_CLIENT_SECRET`;
   - `IMPORT_CLAIM_EMAIL_DOMAIN`: the same claim domain as the 2026-10-14 migration.
2. Rebuild the original extract, then merge the audit:
   ```sh
   python3 scripts/company-import-extract.py <Carnival_Host_Import.xlsx>
   npm run import:gap-audit -- <unzipped carnival-gap-audit folder>
   ```
   Check that the counts match the report above.
3. Create the accounts:
   ```sh
   npm run import:companies -- --target live                                       # dry run
   npm run import:companies -- --apply --target live --confirm-live "CarnivalRental" --approve-users --founder-go
   ```
   Existing accounts report `exists`, which rebuilds the Live mapping. New accounts are created anonymous. `--approve-users` is needed because Live answers `409 user-pending-approval` to listings by pending authors; it approves only unclaimed accounts this import created.
4. Create the listings:
   ```sh
   npm run import:listings -- --target live
   npm run import:listings -- --apply --target live --confirm-live "CarnivalRental"
   ```
5. Add photos and publish. The new rides never existed in Test, so their photos come from the operator's page. `--from-source` is limited to the gap-audit rows (the workbook's `source.gapAudit.listingIds`) and needs `--founder-go` on Live:
   ```sh
   npm run import:photos -- --from-source --target live --confirm-live "CarnivalRental"   # dry run
   npm run import:photos -- --apply --approve --from-source --founder-go --target live --confirm-live "CarnivalRental"
   npm run import:photos -- --approve-remaining --founder-go --target live --confirm-live "CarnivalRental"   # rides without a photo
   ```
   Every photo records its source URL, ride page, date and basis. `--remove <company>` takes a company's imported photos down.
6. Refresh the inventory and release:
   ```sh
   npm run inventory:export -- --target live
   npm run inventory:operators -- --target live
   npm run inventory:validate
   npm run migrate:live -- verify    # anonymous read-back: no leaks
   ```
   Without the local Test snapshot (`imports/migration/test-public.json`), verify checks the Live side only and says so; gap-audit rides are never compared with Test.
   Then run the full checks and deploy.

## Operator ride text

`imports/gap-audit/ride-text.json` (committed) holds each ride's own description, keyed by listing externalId:
- copied verbatim from the ride's source page (the operator's own site), one fetch per page (2026-10-18);
- no link following, and blocked pages left blank;
- emails, phone numbers and links removed before saving.

The merge prefers this text over the audit's one-line summary. The same filters apply:
- claims, including ownership ("we own our rides") and guarantees;
- research notes;
- the operator's name;
- height and size lines when the audit already recorded those values.

Descriptions are capped at about 1,200 characters.

Result (2026-10-18), across 345 pages fetched:
- 491 of 798 rides have operator text (296 pages had none, 5 were blocked, 6 errored).
- Two entries were discarded on review:
  - one page Firecrawl fetched through a stealth proxy on its own;
  - one text that named a different ride.
- 270 rides keep only the class line plus their recorded specs: their pages show nothing beyond a name, a photo or a spec table.

## Not done yet
- Contact updates from the audit for existing live accounts: the importers never rewrite accounts, so this needs a separate, reviewed tool.
