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
   npm run import:companies -- --apply --target live --confirm-live "CarnivalRental"
   ```
   Existing accounts report `exists`, which rebuilds the Live mapping. New accounts are created anonymous.
4. Create the listings:
   ```sh
   npm run import:listings -- --target live
   npm run import:listings -- --apply --target live --confirm-live "CarnivalRental"
   ```
5. Photos and approval. The photo importer copies Live photos from Test by default. New rides have no Test copy, so they need a direct-from-source option. That option has not been added yet.
6. Refresh the inventory and release:
   ```sh
   npm run inventory:export -- --target live
   npm run inventory:operators -- --target live
   npm run inventory:validate
   npm run migrate:live -- verify    # anonymous read-back: no leaks
   ```
   Then run the full checks and deploy.

## Not done yet

- The photo importer option to download new rides' photos from the operator's page on Live, under `--founder-go`.
- Full operator ride text for the 389 rides whose audit summary is empty or was all notes: about 165 operator pages, 151 of them about a single ride.
- Contact updates from the audit for existing live accounts: the importers never rewrite accounts, so this needs a separate, reviewed tool.
