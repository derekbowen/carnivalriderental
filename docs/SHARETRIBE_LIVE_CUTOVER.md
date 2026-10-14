# Sharetribe Live cutover runbook (updated 2026-10-14; Live NOT yet created)

Status on 2026-10-14: the founder has paid for the Live plan. The Live environment itself does not
exist yet: the Live hostname `carnivalrental-9ecfo8.mysharetribe.com` still redirects to
`www.mysharetribe.com`, and no Live API credentials exist. Paying is not the last step; the
**"Go live"** button in Console creates the Live environment as a copy of Test's configuration.

Users and listings can't be copied from Test to Live (Sharetribe docs: "Users and listings created
in the Test and/or Dev environments cannot be moved to the Live environment"). Sharetribe's only bulk
path is its migration service (an Intermediary-format file, a test import, then a one-time Live
import). Our own import scripts recreate the same companies, listings and photos in Live
deterministically, with deduplication and provenance, so they are the route used here.

Scripts select Live with `--target live`, which reads the `SHARETRIBE_LIVE_*` variables
(`scripts/lib/target-env.ts`); the Test values keep their usual names, so nothing is swapped by hand.

## 1. Create Live and its API credentials (owner, Console)

1. In the Test environment, click **Go live** (top right). The Live environment appears in the
   environment picker (top left), configured as a copy of Test.
2. Switch to **Live** → Build → Advanced → Applications → **Add a new application**:
   - "carnivalriderental.us web", type **Marketplace API** → client ID;
   - "carnivalriderental.us server", type **Integration API** → client ID and client secret (the
     secret is shown once; store it in a password manager).
3. Live → General → Marketplace name: note it (the scripts ask for it in `--confirm-live`).
4. Live → General → Access control: "Approve users who want to join" on; **"Make marketplace private"
   OFF** (private marketplaces return 403 to the anonymous Marketplace API and empty our catalog).
5. Do not connect a Stripe account or a payout provider in Sharetribe (we never take rental
   payments; never paste Carnival Ride Rental's Stripe keys into Sharetribe). A map provider is
   optional; our pages don't use Sharetribe's maps.
6. Put the three values in `.env.local` as `SHARETRIBE_LIVE_CLIENT_ID`,
   `SHARETRIBE_LIVE_INTEGRATION_CLIENT_ID`, `SHARETRIBE_LIVE_INTEGRATION_CLIENT_SECRET` (optionally
   `SHARETRIBE_LIVE_MARKETPLACE_URL`), or as cloud-environment secrets for a new session.
7. `npm run sharetribe:inspect -- --target live && npm run contract:diff`: the marketplace name must
   be the Live one and the listing type, fields and `default-inquiry` process must be VERIFIED.

## 2. Copy configuration Test → Live

Console (Test) → Build → **Copy changes to Live** for: listing types (`operator-ride` with the
`default-inquiry` process; the legacy managed type may be left behind), listing fields and options
(`contract/operator-listing-contract.json`), user fields, search configuration, categories, branding,
pages/footer, the outgoing email sender (General → Outgoing email address, CNAMEs on our domain) and
Access control (**"Approve users who want to join" on; "Make marketplace private" OFF**: private
marketplaces return 403 to the anonymous Marketplace API and empty our catalog). Commission stays 0;
no payout provider is configured (we never collect rental payments). Re-run step 1.4 until VERIFIED.

## 3. Import operators, listings, photos; anonymise; re-claim

All against Live, dry run first, then `--apply`:

```
npm run import:companies -- --target live --confirm-live "<Live name>"            # dry run (all commands below read SHARETRIBE_LIVE_*)
npm run import:companies -- --apply --target live --confirm-live "<Live name>"
npm run import:listings  -- --target live --confirm-live "<Live name>"            # dry run
npm run import:listings  -- --apply --target live --confirm-live "<Live name>"
npm run import:photos -- --target live                                             # dry run (counts)
npm run import:photos -- --apply --target live                                     # provenance recorded
npm run listings:enable-inquiry -- --apply --target live                           # founder go
npm run ops:anonymize -- --apply --target live --founder-go                        # public profiles anonymised
npm run ops:claim -- --company <id> --email <operator email> --apply               # each claimed operator
npm run inventory:validate
```

Deduplication is by external id, so re-running never creates duplicates. The claim script keeps the
company name, bio and website out of public fields (CLAUDE.md). Verify counts against Test afterwards
(`npm run sharetribe:inspect` prints listing and user totals): 2026-10-06 Test baseline was 319
companies, 3,716 operator listings, photos per `docs/LISTING_IMPORT.md`.

## 4. Regenerate the snapshots and dependent maps

Live listing ids differ from Test ids, so every snapshot must be rebuilt from Live:

```
npm run inventory:export -- --target live      # src/lib/inventory/rides.json (ids, ride types, photos, geo)
npm run inventory:operators -- --target live   # src/lib/inventory/operators.json (anonymous owner hashes)
npm run inventory:validate
npm run pseo:report
npm run pseo:duplicates       # regenerates reports/pseo-duplicates.json; index-eligible.json is by path, re-check it
npm run typecheck && npm test && npm run build && npm run test:e2e
```

Then commit. Our listing pages are `/s/{listingId}`, so old Test ids 404 after the cutover (they were
never indexed). pSEO city and ride-type×city URLs contain no ids and do not change.

Ledger note: `operator_contact_status` is keyed by Sharetribe user id and simply misses for Live ids
(24 h cache). Existing test-mode purchases reference Test operator ids; they were never real customers.

## 5. Point production at Live

Vercel (project `prj_0bXznA04ruDEAaU6F2IN5gacDm70`, production): `SHARETRIBE_CLIENT_ID` (Live public
client id, plain), `SHARETRIBE_INTEGRATION_CLIENT_ID` and `SHARETRIBE_INTEGRATION_CLIENT_SECRET` (Live,
sensitive), `SHARETRIBE_MARKETPLACE_URL` (Live hosted URL). Remove `REQUEST_DESK_LISTING_ID` (unused).
Deploy `main` (normal workflow: `create_deployment` from GitHub, target production).

## 6. Verify search, matching and unlocks use the same Live inventory

- `/s` total equals the Live operator-listing count from `sharetribe:inspect`; `/s/{id}` renders a Live id.
- `/connect` for Columbus, OH with `ferris-wheel` returns ≥ 3 matches (authors resolved through the
  Live Marketplace API, contactability through the Live Integration API).
- A Stripe **test-mode** purchase on the production domain reveals a contact that matches the operator's
  Live private data; the pass email arrives at `qa@carnivalriderental.us` and its link opens the pass in
  a fresh browser.
- `tests/privacy-*.test.ts`, `e2e/privacy.spec.ts` and `npm run pseo:report` still pass: no operator
  identity in public HTML, JSON-LD, metadata, sitemaps or the snapshot.

## 7. After cutover

Rotate the Test Integration client secret or delete the Test Integration application if it is no longer
used by scripts; put the Test values back in `.env.local` only if Test work continues. Update
`docs/LAUNCH_STATUS.md` with the verified Live counts.
