# Inventory pSEO: real cities × real rides (2026-10-05)

Status: **built, all noindex.** Pages render from deterministic local data, never from per-card API calls. Nothing is indexable until the founder approves the copy (`PSEO_INVENTORY.copyApproved` in `src/lib/inventory/index.ts`) **and** public indexing is switched on for production.

## Data (generated, committed)

| Artifact | Built by | Contents |
|---|---|---|
| `src/lib/inventory/rides.json` | `npm run inventory:export` (public Marketplace API, client ID only) | 3,714 rides: id, title, ride class, canonical ride type, rate-card key, home state, states served, 0.1°-rounded operator base, Sharetribe CDN photo, approved facts, claimed flag. **No company name, city, website, contact, description or internal IDs.** |
| `src/lib/geo/cities.json` | `npm run geo:cities` (US Census, public domain) | 1,580 incorporated places with population ≥ 25,000: name, slug, state, internal-point coordinates, population |
| `reports/inventory-match.json` | `npm run inventory:validate` | counts per canonical ride type, unmatched and ambiguous titles |
| `reports/pseo-routes.json` | `npm run pseo:report` | renderable / indexable / sitemap counts and blocking reasons |

Run `npm run inventory:validate` after every export. It fails on contact-like strings, identity keys, non-CDN URLs, coordinates finer than 0.1°, unknown classes or types, and, on the transactional side where the private workbook exists, any company, legal, owner or contact name or company domain anywhere in the snapshot.

## Ride types

The matcher (`src/lib/inventory/match.ts`) maps titles to exactly the 50 canonical ride types in `src/lib/taxonomy/ride-types.json`. The first rule that matches wins. Rides that don't match are left unassigned and logged; they are never forced into a type. They still appear on city pages and in search.

## Page templates (routes from `paths.*`)

| Template | Route | Renders | Supply gate for indexing |
|---|---|---|---|
| City | `/{state}/{city}` (`paths.city`) | every Census city; an honest empty state when nothing is within the radius | ≥ 10 rides within 200 mi |
| Ride type + city | `/{state}/{city}/{rideType}` (`paths.rideCity`) | only when ≥ 5 matching rides are within 200 mi; otherwise **404** | same |

- **Thin pages:** pages below the supply gate get `noindex` and **no canonical**. Supply-sufficient pages keep a self-canonical while the approval and environment gates are closed.
- **Sitemap:** includes only pages that pass every gate, and never query or filter URLs.
- **Unknown values:** unknown state, city or ride-type slugs return 404.
- **Demo content:** a demo content location with the same slug as a real city is ignored.
- **Card wording:** "Operator ~N mi away, based in XX". That is the operator's home base, not where the ride is now and not the event location. The price slot reads "Priced by the operator" unless the listing has an operator-approved figure (`src/lib/pricing/public-price.ts`). Category, ride-size and rate-card estimates are never shown publicly. The card CTA is "Connect with operators" (Event Access, `/connect`).
- **Structured data:** CollectionPage, BreadcrumbList, the site's rental Service, FAQPage (only when the FAQ is shown), and an ItemList of the visible ride names. No Offer, price, availability, rating, review, address or Event.

## Internal linking (measured: `reports/internal-links.json`)

Every link between pSEO pages is **bidirectional**, and the structure is checked by a full crawl of a production build.

- **City → ride type + city:** every ride-type page that exists for the city, uncapped. **Ride type + city → city:** breadcrumb plus "All carnival rides near X".
- **Nearby cities** and **the same ride in nearby cities** are symmetric. Each page links its 12 nearest peers plus every peer that links to it (at most 30). See `linkedNearbyCities` and `linkedRideCities`.
- **Listing detail (`/s/{id}`):** breadcrumbs Home › State › nearest index-eligible city › ride-type page › ride, plus links back to that ride-type page, the same ride in nearby cities, nearby city pages and the state directory.
- **Site directory:** `/directory` and `/directory/{state}`, linked from the header ("Locations") and the footer. It lists every city page with supply, every ride-type page for index-eligible cities, and every ride listing from operators based in the state. It follows the same environment and approval gates as the inventory pages.
- **Result (before → after):** pages with no inbound body link 5 → 0; city → own ride-type pages 15,577 → 15,931 of 15,931; reciprocated nearby links 71% → 100%; listings linked 2,324 → 3,714 of 3,714; indexable pages beyond 4 clicks from home 17 (8 unreachable) → 0.

## Counts (from `reports/pseo-routes.json`)

| Measure | Pages |
|---|---|
| City pages | 1,580 (1,433 with supply; 147 empty-state) |
| Ride-type + city pages | 15,931 |
| **Total renderable** | **17,511** |
| Meeting the supply gate (city) | 1,427 |
| Meeting the supply gate (ride + city) | 15,931 |
| Eligible ever (near-duplicate group heads) | 2,397 (359 city + 2,038 ride + city) |
| Indexable now | 0 |
| In the sitemap | 0 |

## Refresh

1. `npm run inventory:export && npm run inventory:validate && npm run pseo:duplicates && npm run pseo:report`. `pseo:duplicates` regenerates `src/lib/inventory/index-eligible.json`; skipping it leaves every page non-indexable.
2. Commit the changed JSON, then deploy.

The export is deterministic (sorted by id), so unchanged inventory produces an identical file.

## Indexing

See `docs/PSEO_INDEXING_PLAN.md` for the robots correction, the disabled 10-URL pilot (`src/lib/inventory/pilot.ts`) and the near-duplicate findings (`npm run pseo:duplicates`). Data reports: `npm run inventory:unmatched` (1,660 unmatched rides, classified) and `npm run photos:gaps` (211 listings without photos, by reason).

## Founder decisions needed before indexing

1. Approve the city and ride-type + city copy, then set `copyApproved: true`.
2. Turn on indexing: `PUBLIC_INDEXING=true` and `APP_ENV=production` in Vercel production.
3. Optionally tune the radius and minimum-ride thresholds, which change the counts above.

## Operator counts (2026-10-06)

`src/lib/inventory/operators.json` maps listing id → an opaque operator key (truncated SHA-256 of the Sharetribe author id). Pages use it only to count distinct operators ("listed by 13 operators serving the area", "similar rides from 3 other operators") and to exclude an operator's own other listings from "similar rides". It holds no names, contacts or locations and cannot be reversed. Regenerate with `npm run inventory:operators` (public Marketplace API) whenever `rides.json` is re-exported.
