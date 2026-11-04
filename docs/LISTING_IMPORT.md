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

## Photo recovery (2026-11-04)

Founder: "fix it.. make the photos appear". The basis is unchanged: the founder decision of 2026-10-05 to use the operator website photo and remove it on request.

**Audit of the 4,512 snapshot rides (2026-11-04):**
- 4,069 have a photo, and every one loads.
- 443 have none:
  - 232 from the gap audit (171 with no source photo, 61 failed downloads);
  - 211 older rides (`reports/photo-gaps.json`).
- 17 photos were placeholder graphics copied from operator sites: 11 grey camera icons, 5 "Photo Coming Soon" cards and 1 "COMING SOON" overlay.
- 1 photo was a flyer printing the operator's website.

**Hidden on the site now.** These 18 images read as no photo everywhere: `src/lib/catalog/hidden-images.ts`, keyed by the image id in the CDN path. Add an id there to hide another one.

**Importer safeguards** (all runs):
- WebP, AVIF/HEIC, BMP and TIFF are converted to JPEG (ImageMagick).
- Placeholders are rejected:
  - by file name (`coming-soon`, `no-image`, `placeholder`, …);
  - by look (`scripts/lib/image-tools.ts`): 4 colours or fewer, or close to a known placeholder in `scripts/lib/placeholder-signatures.json`. Calibrated on all 4,069 photos: it flags exactly the 17 placeholders and no real photo.

**Recovery run** (needs the Live credentials, below). It reads Live directly, so no workbook or mapping is needed. It covers every imported listing that is published or pending and shows no photo: no image, or only a placeholder this importer added. Operators' own uploads, claimed accounts, takedowns and operator-created listings are never touched.

```sh
npm run import:photos -- --recover --target live --confirm-live "CarnivalRental"              # dry run: counts by reason
npm run import:photos -- --recover --discover --target live --confirm-live "CarnivalRental"   # rides with no recorded photo: search their ride page
# review imports/photos/carnivalrental/discovered/sheet-*.jpg (gitignored: operator URLs), then:
npm run import:photos -- --recover --approve-discovered all --reject-discovered <listingId>,… --target live --confirm-live "CarnivalRental"
npm run import:photos -- --recover --apply --founder-go --use-discovered --target live --confirm-live "CarnivalRental"
npm run inventory:export -- --target live && npm run inventory:operators -- --target live && npm run inventory:validate
```

- **Recorded source photos** are retried with the new conversion and checks.
- **Rides without a recorded photo** get a candidate from their own ride page (`discoverRideImage`):
  - an `<img>` whose alt text or file name names the ride;
  - or the page's og:image when the page is about the ride.
- **Candidates are uploaded only after review.** Reject any that shows another ride, a logo, or a flyer or watermark naming the operator.
- **Provenance:** every upload records its source, the ride page and how it was found.
- **Sites that refuse automated downloads** (403, 406, 503 or bot checks) are respected, not worked around. Those rides keep the no-photo tile until the operator adds a photo.

**Credentials.** Add these to the cloud environment's settings (environment variables), then start a new session:
- `SHARETRIBE_LIVE_CLIENT_ID`;
- `SHARETRIBE_LIVE_INTEGRATION_CLIENT_ID`;
- `SHARETRIBE_LIVE_INTEGRATION_CLIENT_SECRET`.

## Not approved yet

- the operator transaction process;
- fees, payouts and publishing;
- public use of operator-written descriptions before claim;
- photo use.

These listings stay `pendingApproval` until a separate founder go.
