# Operator ride listings import (Carnival_Host_Import.xlsx → Sharetribe listings)

Status (2026-10-04): built and proven on Test with one listing (A&A Attractions, Berry Go Round, `6ac25490-def4-44f9-b32e-8aea9002ecfb`): created `pendingApproval`, no images, approved public keys only, public API returns 404. A rerun returns `exists`. Founder approval: "approved as recommended" (2026-10-04), recorded in `contract/operator-listing-contract.json`.

Code:
- `src/lib/imports/operator-listings.ts` (mapping, privacy, idempotent loop);
- `scripts/listing-import.ts` (CLI);
- `scripts/lib/sharetribe-client.ts` (shared rate-limited client).

Tests: `tests/listing-import.test.ts`.

## What gets imported

| | Count |
|---|---|
| Ride rows in the workbook | 3,721 (all from the 119 A_ready companies) |
| Importable | **3,714** |
| Held for review (`imports/listings/held-for-review.json`) | 7: scraped website footers with a street/ZIP and owner names (Casey's ×2, Campy's), research notes naming the owner (Sunshine Shows ×3), a family name (Dreamland) |
| Dimensions public (from the operator's own website) | 350 |
| Typical dimensions kept private (type range or model-typical) | 1,127 |
| Manufacturer public (printed on operator site, high confidence) | 1,628 |
| Manufacturer kept private (medium/low/none) | 233 |
| Photos uploaded | **0** (3,555 source photo links kept private) |

Each listing:
- is created under its company's imported account, in state **pendingApproval**: visible in Console, never in public queries;
- has `publicData.listingType` = `operator-ride-rental`;
- has **no transaction process bound**, so it cannot be booked.

Two pieces of the text are removed before upload: research-added sentences ("Space needed: ask the owner…", and any sentence citing a link) and phone numbers. Geolocation is rounded to 1 decimal (~11 km).

## Safety

- **No duplicates:** before any create, the run checks the mapping (`imports/listings/<marketplace>/mapping.json`) and the author's existing listings, matched on `metadata.importExternalId`. Reruns report `exists`.
- **No overwrites:**
  - existing listings are never modified;
  - a company whose account is no longer `unclaimed` is skipped entirely (`skipped_claimed`);
  - a mapped listing that disappeared is reported, not recreated.
- **Missing accounts:** rides for companies without an account yet are `waiting_for_author` and picked up on the next run.
- **Live runs:** need Live credentials, `--confirm-live "<name>"`, and the listing type configured in Console. On Test a missing listing type is a warning only.

## Commands

```sh
python3 scripts/company-import-extract.py /path/to/Carnival_Host_Import.xlsx
npm run import:listings                                   # dry run
npm run import:listings -- --apply                        # everything whose company exists (Test)
npm run import:listings -- --apply --company acme-shows   # one company
```

## Console (founder, Test → copy to Dev)

Listings exist without this, but Console can't display or edit the operator fields until it's done.

1. **Listing types → Add** `operator-ride-rental` ("Operator ride rental"). Pick any process for now: the binding isn't approved yet, and the imported listings carry no process alias.
2. **Listing fields → Add**, limited to listing type `operator-ride-rental`:
   - `rideClass`: Select one. Options:

     | ID | Label |
     |---|---|
     | `kiddie` | Kiddie ride |
     | `family` | Family ride |
     | `major` | Major ride |
     | `spectacular` | Spectacular |
     | `coaster` | Roller coaster |
     | `funhouse` | Fun house / walk-through |
     | `dark-ride` | Dark ride |
     | `water` | Water ride |
     | `other` | Other attraction |

     Filter ON.
   - `serviceStates`: Select multiple, the same 51 lowercase codes as `requestableStates`. Filter ON.
   - `homeState`: Select one, the same codes.
   - `manufacturer`, `rideModel`, `riderRules`: Text.
   - `minRiderHeightIn`, `footprintLengthFt`, `footprintWidthFt`, `rideHeightFt`: Number.
3. Run `npm run sharetribe:inspect`. The importer then stops warning.

## Not approved yet

- the operator transaction process;
- fees, payouts and publishing;
- public use of operator-written descriptions before claim;
- photo use.

These listings stay `pendingApproval` until a separate founder go.
