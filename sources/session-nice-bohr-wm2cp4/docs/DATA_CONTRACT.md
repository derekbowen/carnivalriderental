# Listing data contract — v1.1.0 (approved for Test)

Source of truth: [`contract/listing-contract.json`](../contract/listing-contract.json) · code `src/lib/contract`, `src/lib/catalog` · tests `tests/contract.test.ts`, `tests/catalog.test.ts`, `e2e/catalog-preview.spec.ts`.

Commands:
| Command | What it does |
|---|---|
| `npm run sharetribe:inspect` | Read-only snapshot of the active environment's hosted config + record counts (no secrets) |
| `npm run contract:diff` | Verifies the latest snapshot: every check is **MATCH / DRIFT / UNVERIFIED**; exit 0 only if all match |
| `npm run catalog:seed [-- --apply]` | Plans (default) or writes the four Test samples; refuses outside "CarnivalRental Test" or without an approved seller account |
| `npm run catalog:search-proof` | Live category / coverage queries against the public API; **INCONCLUSIVE** until samples are seeded |

## 1. Approved (founder, 2026-10-01)

- Listing type ID `managed-ride-rental` (one type for all ride families).
- Categories: `ferris-wheels`, `carousels`, `swing-rides`, `kiddie-rides`, `family-rides`, `thrill-rides` — an initial taxonomy, not closed.
- Phase-1 fields: `offeringScope`, `requestableStates`, `eventTypes`, `pricingMode`, `estimateLowUsd`, `estimateHighUsd`, `estimateBasis`; `offerKey` stays API-managed.
- Lowercase state codes; request-form event-type IDs; all catalog fields in operator-written **metadata**.

**Not approved:** the transaction process (Test scaffold only — §2), any payment/deposit/capture/refund policy, spec fields (deferred — §6).

**Primary-category rule:** each offering has exactly one category — the ride family a customer would name first. Never create a second listing to appear in another category.

## 2. Process binding — temporary Test scaffold

`processBinding` (separate from offering/category identity): `default-negotiation/release-1`, regular flow, unit `offer`, **customer counter-offers off**, **provider offer updates on** (quote-versioned; an accepted scope/price never changes without renewed customer agreement).

It is used only to prove catalog creation, retrieval and search. It does **not** implement the intended model (payment commitment before sourcing). Before changing the binding: inspect existing listings and transactions — a Console change does not rewrite listings' `publicData.transactionProcessAlias`, and transactions stay on the process they started with. Payment states and the 75-day issue: [`PAYMENT_STATES.md`](PAYMENT_STATES.md).

## 3. Fields (v1.1)

| Key | Type | Required | Rule | Search |
|---|---|---|---|---|
| `offerKey` | text (API-only) | yes | `^ofr-[a-z0-9-]+$`; stable; unique (seed path enforces) | not indexed |
| `offeringScope` | select one | yes | `ride-family` only in phase 1 (`specific-model` rejected until deferred fields exist) | indexed |
| `requestableStates` | select multiple (51) | yes, ≥1 | where we **accept requests**, not where equipment is; missing ≠ nationwide | indexed; our queries use `has_any` |
| `eventTypes` | select multiple (7) | **no** | only **reviewed** suitability; omit if not reviewed | display-only (not indexed) |
| `pricingMode` | select one | yes | `quote-required` \| `indicative-range` | not indexed |
| `estimateLowUsd` / `estimateHighUsd` | number (whole USD) | iff indicative-range | high ≥ low | not indexed |
| `estimateBasis` | **Long text** ≤300 | iff indicative-range | shown beside the estimate | not indexed |

Native: no `geolocation` (location search must never require fake pins), no `price`, no `availabilityPlan`, no `privateData`.

## 4. Two kinds of validation (do not confuse them)

| Layer | Where | Proves | Does not prove |
|---|---|---|---|
| Structural | `validateOfferingRecord` (all writes; updates validate the **merged result**) | keys, types, options, cross-field rules | that any value is true |
| Read-side | `normalizeListing` (every record read from Sharetribe, because **Console edits bypass the write validator**) | re-validates structure; rejects unpublished/deleted, duplicate `offerKey`s, records without a catalog-store entry | — |
| Publication | catalog store `catalog/offerings.json` | estimate shown **only** with an approved provenance entry, otherwise withheld; test samples never indexable | — |

Invalid records never render (the preview returns 404), and nothing from `privateData` is ever carried into a catalog record.

## 5. Configuration verification

`verifyConfiguration` checks listing type + binding, retirement of other types, six categories, each Console field's **scope, schemaType, indexForSearch and options**, search settings (`mainSearch.searchType = keywords`, keywords filter on, **price filter off**, **date filter off**, category filter on) and commission (**provider 0%, customer 0%** — Test setting only, not an accounting or fee decision).

- **UNVERIFIED** = the property is unreadable, or differs from an expected encoding we have not yet observed (e.g. the spelling of metadata scope, the long-text schema type, the keyword search type, the customer-commission path, the categories asset format). UNVERIFIED is never a pass.
- `fullyVerified` is true only when every check matched. Even then it covers **checked properties only**. Outside coverage: transaction process definition/timers, negotiation toggles (unless exposed in `listing-types.json`), CLI search schemas, Stripe, email templates.

Current Test result (2026-10-01): **NOT verified** — 2 match, 20 drift, 1 unverified (untouched defaults).

## 6. Deferred: model specifications

Not created. Proposed before the first specific-model offering: lengths in **integer inches** (display converts; source never changes), equipment dimensions **separate** from site clearances, structured power (volts/phase/amps/services or self-powered). Every value needs an approved provenance record. Does not block ride-family listings.

## 7. Console worksheet — CarnivalRental Test (only Console can change these)

1. **Listing types →** add `managed-ride-rental` ("Managed ride rental"): Price negotiation, **Regular** flow; customers can make counter offers **OFF**; providers can update offers **ON**.
2. **Listing types →** delete `daily-booking` (0 listings use it — verified 2026-10-01).
3. **Listing categories →** add the six IDs in §1 (level 1, no subcategories).
4. **Listing fields →** delete `exampleField` (0 listings). Add, access level **Metadata**:
   - `offeringScope` Select one: `ride-family` "Ride family (unit sourced per event)", `specific-model` "Specific model" — **Add a filter: ON**.
   - `requestableStates` Select multiple: the 51 lowercase codes in the JSON (`al` … `wy`, incl. `dc`) — **Add a filter: ON**.
   - `eventTypes` Select multiple: `corporate, municipal, school, college, festival, private, other` — filter **OFF**.
   - `pricingMode` Select one: `quote-required` "Tailored quote", `indicative-range` "Planning estimate shown" — filter OFF.
   - `estimateLowUsd`, `estimateHighUsd` Number, min 1 — filter OFF.
   - `estimateBasis` **Long text** — keyword search OFF.
5. **Listing search →** main search **Keyword**; keyword filter ON; price filter OFF; date range filter OFF; category filter ON.
6. **Commission →** provider 0%, customer 0% (Test only).
7. Run `npm run sharetribe:inspect && npm run contract:diff`. Record which checks become MATCH and which stay UNVERIFIED; update `CONFIRMED_ENCODINGS` only from what the real assets show.
8. Then **Copy changes to… → Dev**. Re-inspect Dev (needs a Dev Marketplace API client ID). Records do not copy.

## 8. Evidence status (be precise)

| Claim | Status |
|---|---|
| Contract, validators, verifier, adapter, preview pages | built; 88 unit + 11 e2e tests pass |
| Test configuration matches contract | **No** — Console changes not yet applied |
| Real Test listings, saved/reloaded | **Not done** — needs approved seller email + Console config |
| Category / `has_any` coverage search on real data | **INCONCLUSIVE** — 0 listings. Note: the API returned HTTP 200 for `meta_requestableStates` / `pub_listingType` filters with no search index configured, so an unindexed filter may be silently ignored; the exclusion cases detect that once data exists |
| Listing page + pSEO preview from **real** Sharetribe data | **Not done** — proven only with the labelled `test-harness-file` source |
| Dev configuration | Not copied; Dev not readable without a Dev Marketplace API client ID |
