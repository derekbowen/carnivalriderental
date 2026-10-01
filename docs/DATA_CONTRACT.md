# Listing data contract — v1.0.0 (PROPOSED, not created anywhere)

Machine-readable source: [`contract/listing-contract.json`](../contract/listing-contract.json).
Code: `src/lib/contract` (validator for every write path, drift detection). Tests: `tests/contract.test.ts`.
Commands: `npm run sharetribe:inspect` (read-only snapshot of the active environment) → `npm run contract:diff`.

> Nothing in this document has been created in Sharetribe. Field IDs, category IDs, listing-type IDs and option values **cannot be changed after creation** — approve them before the Console steps in §8.

## 1. What the marketplace actually contains (verified 2026-10-01, read-only)

| Item | CarnivalRental **Test** (active) | CarnivalRental **Dev** |
|---|---|---|
| Listings / users / transactions | 0 / 0 / 0 | 0 / 0 (listings, users) |
| Listing types | `daily-booking` → `default-booking/release-1`, unit `day` (Sharetribe default) | not readable (no Marketplace API client ID for Dev) |
| Categories | none configured | — |
| Listing fields | `exampleField` (public enum, placeholder, indexed) | — |
| Search config | location search; price filter $0–500; category filter on; keywords off | — |
| Commission | provider 10% (default) | — |
| Minimum transaction | $5.00 | — |
| Transaction processes, CLI search schemas, Stripe | **not readable** with these credentials (Sharetribe CLI / Console only) | — |

Snapshot: `contract/snapshots/carnivalrental-test-2026-10-01.json` (no secrets). The marketplace is untouched defaults. Nothing from PRNM or Carnival Safety Institute was accessed.

## 2. Listing type and transaction mapping

**One listing type: `managed-ride-rental`.** Ride families are categories, not listing types.

| Option | Fits customer commitment → sourcing → supplier confirmation → booking confirmation? |
|---|---|
| `default-booking` (current default) | **No.** Reserves a seat on one listing calendar; one national offering would block itself after one booking. Rider capacity would wrongly become inventory. |
| `default-inquiry` (free messaging) | **No.** No payment; turns the business into lead capture. |
| **`default-negotiation`, regular flow, unit `offer`** (proposed) | **Mostly.** Customer requests a quote (commitment signal + brief) → we source offline (our store) → we send an offer once a supplier has confirmed in principle → customer accepts **and pays immediately** → we record supplier commitment → confirm. No availability calendar, matching the national-offering model. |

Known gaps in `default-negotiation` that must be decided **before real payments** (not before Test sample listings):
1. **Who sends offers.** The provider is our own seller account. Either our backend acts as that account (trusted user token) or we customise the process so the **operator** makes offers via the Integration API. Recommended: custom process with operator offers.
2. **Payment timing.** Stock process charges the full amount at acceptance; one PaymentIntent per transaction (deposit + balance = two transactions or a custom process). See `SHARETRIBE_MAPPING.md` options A–D.
3. **75-day window.** Stock process auto-cancels/refunds if not marked delivered within 75 days of payment — events booked further out need a different payment path.
4. **Supplier commitment step** is not in the stock process; today it lives in our fulfilment store.

Because a listing's type cannot change after publication, Test sample listings may use this type; a **custom process** would be pushed with Sharetribe CLI and attached to the same listing type ID later (process alias changes; listing type ID stays).

## 3. Categories (native, level 1 only)

Stored by Sharetribe at `publicData.categoryLevel1`. **Category ID = URL slug** (`/categories/{id}`), so there is no second category definition.

| ID | Label |
|---|---|
| `ferris-wheels` | Ferris wheels |
| `carousels` | Carousels |
| `swing-rides` | Swing rides |
| `kiddie-rides` | Kiddie rides |
| `family-rides` | Family rides |
| `thrill-rides` | Thrill rides |

No subcategories in v1. Manufacturer/model is data on the offering, not a category. "Full carnival packages" is deferred (it may need a different transaction behaviour).

## 4. Entities (where each lives)

| Entity | Lives in | Notes |
|---|---|---|
| A. Customer-facing **offering** | Sharetribe listing (author: our 10000 Solutions LLC seller account) + our catalog record keyed by `offerKey` (URL slug, SEO copy, publication gate, provenance) | |
| B. **Ride model** with verified specs | Specific-model offering fields (phase 1b) + provenance documents in our store | |
| C. **Physical unit** | Our fulfilment store only | Never on a listing. |
| D. **Supplier / operator** | Our fulfilment store only | No accounts in operators' names. |
| E. **Event request & fulfilment** | Our store now; later linked to the Sharetribe transaction (customer brief in transaction protected data) | Dates, venue, hours, budget, contact never on listings. |

## 5. Field dictionary (v1)

All contract fields are **metadata**: publicly readable, writable only by the operator (Integration API / Console), so no author login can change them. Console "metadata" fields cannot be marked mandatory — **required-ness is enforced by our validator** on every write.

| Key | Label | Type / unit | Required | Values / rule | Filter | Phase |
|---|---|---|---|---|---|---|
| `offerKey` | Offering key | single-line text | yes | `^ofr-[a-z0-9-]+$`; never changes; independent of title/URL/listing UUID | no (join key) | 1 (API-only, not a Console field) |
| `offeringScope` | Offering scope | select one | yes | `ride-family` \| `specific-model` | single | 1 |
| `requestableStates` | States we accept requests for | select multiple | yes, ≥1 | 50 states + `dc`, lowercase | **ANY** | 1 |
| `eventTypes` | Suited event types | select multiple | yes, ≥1 | `corporate, municipal, school, college, festival, private, other` (same IDs as the request form) | ANY | 1 |
| `pricingMode` | Pricing mode | select one | yes | `quote-required` \| `indicative-range` | no | 1 |
| `estimateLowUsd` | Planning estimate — low | number, whole USD | iff indicative-range | ≥1 | no | 1 |
| `estimateHighUsd` | Planning estimate — high | number, whole USD | iff indicative-range | ≥ low | no | 1 |
| `estimateBasis` | Planning estimate — basis | long text ≤300 | iff indicative-range | shown beside the estimate | no | 1 |
| `manufacturer` | Manufacturer | single-line text ≤70 | iff specific-model; **forbidden** for ride-family | provenance required; never AI-guessed | no | 1b |
| `model` | Model | single-line text ≤70 | iff specific-model; forbidden for ride-family | provenance required | no | 1b |
| `specHeightFt` | Height | number, feet | optional; forbidden for ride-family | provenance required | no | 1b |
| `specRidersPerCycle` | Riders per cycle | number, riders | optional; forbidden for ride-family | **a spec, never inventory** | no | 1b |
| `specFootprintLengthFt` / `specFootprintWidthFt` | Footprint | number, feet | optional; forbidden for ride-family | incl. documented clearance | no | 1b |
| `specPower` | Power requirement | single-line text ≤70 | optional; forbidden for ride-family | as documented | no | 1b |

Native attributes: `title`, `description` required; `images` owned/licensed only; **`geolocation` never set** (a pin implies equipment is there); `price` unused in v1; `availabilityPlan` unused. `publicData.listingType = managed-ride-rental`, `transactionProcessAlias = default-negotiation/release-1`, `unitType = offer`, `categoryLevel1` from §3 — and **no other publicData keys**.

**Unknown stays unknown:** optional fields are omitted, never defaulted. The validator rejects unknown keys (no `poolAmenities` vs `advantagesSelection` drift), out-of-set options, non-integers, specs on ride-family offerings, estimates on quote-required offerings, and high < low.

Phase **1b** fields are defined now so their IDs are reviewed once, but are created in Console only when the first specific-model offering is approved.

## 6. Access-control / storage map

| Data | Store | Who can read | Who can write |
|---|---|---|---|
| Offering title/description/images/category | Listing attributes / publicData | everyone | listing author (our seller account), operator |
| Contract fields (§5) | Listing **metadata** | everyone | **operator only** |
| Listing privateData | — not used — | author + operator | Anyone holding our seller-account login could read it, so it is not "operator-only". |
| Supplier identities, units, supplier quotes, costs, margins, contracts | **Our database only** | team (internal console, auth) | team |
| Customer event brief | Our database (now); later transaction protected data | customer + operator | customer, operator |
| Transaction metadata | — never costs/margins — | **visible to transaction participants (the customer)** | operator |

## 7. Search behaviour

| Customer action | Query | Semantics |
|---|---|---|
| Choose a category | `pub_categoryLevel1=ferris-wheels` | exact match |
| Event state = TX | `meta_requestableStates=has_any:tx` | offerings that accept TX requests |
| Event state TX **or** AZ | `meta_requestableStates=has_any:tx,az` | covers TX **or** AZ — never "both" unless the UI says so |
| Event type | `meta_eventTypes=has_any:festival` | suited to festivals (guidance) |
| Scope | `meta_offeringScope=ride-family` | exact |

- Console creates the search index for Console fields; we do **not** create competing CLI schemas for the same keys (Sharetribe rejects that with 409).
- Sharetribe's hosted template uses `has_all` for Console multi-select filters. **Our frontend sets `has_any` in its own query** — to be verified with published sample listings (§9) before relying on it.
- No filter implies date availability. Coverage ≠ physical location.

## 8. Frontend and pSEO connection

- One adapter (`src/lib/catalog`, next step) reads offerings from a **cached snapshot** of Sharetribe listings + our catalog records; the marketplace UI and the pSEO renderer both use it. No per-page-view Sharetribe or AI calls; revalidate on a schedule and on Sharetribe `listing/updated|deleted` events.
- Stable identities: offering = `offerKey`; category = category ID (= slug); location = `{stateSlug}/{citySlug}` record in our store.
- City / ride+city pages list an offering **only if the city's state is in `requestableStates`**. (Current development code renders every ride × city combination from fixtures; that changes when the adapter lands.)
- SEO copy may use: title, description, category label, event-type labels, verified specs, estimate (only when `indicative-range`). Never: supplier data, unverified specs, invented local claims.
- Closure/removal of a listing removes the offering from all derived pages on the next sync; pages with no eligible offerings keep their "request sourcing" empty state and stay non-indexable.

## 9. Proposed Test configuration changes (do NOT apply until approved)

In Sharetribe Console → **CarnivalRental Test**:
1. **Listing types →** add `managed-ride-rental` ("Managed ride rental"): transaction setting **Price negotiation**, flow **Regular**. (Choose whether customers may counter-offer and whether offers can be updated — decision below.)
2. **Listing types →** retire `daily-booking` (no listings use it) so nothing is created on the calendar model.
3. **Listing categories →** add the six level-1 categories in §3 with exactly those IDs.
4. **Listing fields →** delete `exampleField`; add the phase-1 Console fields from §5 with exactly those IDs, access level **Metadata**, option values exactly as listed (51 state options; 7 event types). Enable "Add a filter" for `offeringScope`, `requestableStates`, `eventTypes`.
5. **Commission →** decide provider commission (we are the provider; likely 0%).
6. **Listing search →** price filter off (prices are quote-based); keep category filter.
7. Run `npm run sharetribe:inspect && npm run contract:diff` → must report **0 differences**.
8. **Copy changes to… → Dev** (Sharetribe's supported workflow); never recreate fields in Dev by hand.

Then (separate approval) the §9-style proof: company-controlled seller account, four clearly marked sample listings (family Ferris wheel; different category; different coverage; unknown optional specs), idempotent seed keyed by `offerKey`, and the verification list (save/reload, API types, category filter, `has_any` coverage, no invented attributes, frontend + one pSEO preview reading real values, edit propagation, invalid writes rejected, anonymous responses free of procurement data).

## 10. Unresolved decisions

1. Approve the field IDs, option values and category IDs above (permanent once created).
2. Approve `default-negotiation` (regular) as the starting process, and whether customers can counter-offer / offers can be updated.
3. Who makes offers: our seller-account login vs. a custom operator-offer process.
4. Payment policy (A–D in `SHARETRIBE_MAPPING.md`) and the >75-day event path.
5. Provider commission on our own listings (accountant).
6. Do we want `eventTypes` as a customer filter in v1, or display only?
7. Seller account login email for 10000 Solutions LLC (Test), and Stripe **test** keys in Test.
8. Sharetribe CLI API key (only needed if we push a custom process; not needed for the Console steps).
9. A Marketplace API client ID for **Dev** (for reading Dev configuration and for development against Dev after the copy).
