# Sharetribe Live cutover runbook (prepared 2026-10-12; Live NOT verified active)

Status on 2026-10-12: the founder intends to pay for the Sharetribe Live plan. **Nothing in this repo or its
environments proves Live is active**: `.env.local` and Vercel hold only Test-marketplace credentials
(`carnivalrental-9ecfo8.mysharetribe-test.com`), and the hosted Live hostname of the same marketplace
(`carnivalrental-9ecfo8.mysharetribe.com`) redirects to `www.mysharetribe.com`, which is what an
unactivated Live environment does. Treat Live as not started until step 1 passes.

Everything below is owner-driven because it needs Live credentials from the Console. Each step is
idempotent and refuses to touch the Test marketplace by accident (`--target live --confirm-live "<name>"`).

## 1. Prove Live is active

1. Console → environment switcher shows **Live** with an active plan (not "Build"/"Hold").
2. Console (Live) → Build → Applications: create/read the **Live Marketplace API client** (public client
   id) and a **Live Integration API application** (client id + secret). Never paste Stripe keys here.
3. Put them in `.env.local` *for the cutover session only*, replacing the Test values of the same names
   (`SHARETRIBE_CLIENT_ID`, `SHARETRIBE_INTEGRATION_CLIENT_ID`, `SHARETRIBE_INTEGRATION_CLIENT_SECRET`;
   keep the Test values in a comment, the scripts' `--target test` guard will need them back).
4. `npm run sharetribe:inspect && npm run contract:diff` → the printed marketplace name must not be the
   Test marketplace, and the inspect must say VERIFIED for the operator listing type, fields and
   `default-inquiry` process. UNVERIFIED is never a pass.

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
npm run import:companies -- --target live --confirm-live "<Live name>"            # dry run
npm run import:companies -- --apply --target live --confirm-live "<Live name>"
npm run import:listings  -- --target live --confirm-live "<Live name>"            # dry run
npm run import:listings  -- --apply --target live --confirm-live "<Live name>"
npm run import:photos                                                              # dry run (counts)
npm run import:photos -- --apply                                                   # provenance recorded
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
npm run inventory:export      # src/lib/inventory/rides.json (ids, ride types, photos, geo)
npm run inventory:operators   # src/lib/inventory/operators.json (anonymous owner hashes)
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
