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
- **Card wording:** "Operator ~N mi away, based in XX". That is the operator's home base, not where the ride is now and not the event location. The price slot reads "Request a quote" unless the listing has an operator-approved rate for its rental unit (`src/lib/pricing/public-price.ts`). Category, ride-size and rate-card estimates are never shown publicly.
- **Structured data:** CollectionPage, BreadcrumbList, the site's rental Service, FAQPage (only when the FAQ is shown), and an ItemList of the visible ride names. No Offer, price, availability, rating, review, address or Event.

## Counts (from `reports/pseo-routes.json`)

| Measure | Pages |
|---|---|
| City pages | 1,580 (1,433 with supply; 147 empty-state) |
| Ride-type + city pages | 15,931 |
| **Total renderable** | **17,511** |
| Meeting the supply gate (city) | 1,427 |
| Meeting the supply gate (ride + city) | 15,931 |
| Indexable now | 0 |
| In the sitemap | 0 |

## Refresh

1. `npm run inventory:export && npm run inventory:validate && npm run pseo:report`
2. Commit the changed JSON, then deploy.

The export is deterministic (sorted by id), so unchanged inventory produces an identical file.

## Indexing

See `docs/PSEO_INDEXING_PLAN.md` for the robots correction, the disabled 10-URL pilot (`src/lib/inventory/pilot.ts`) and the near-duplicate findings (`npm run pseo:duplicates`). Data reports: `npm run inventory:unmatched` (1,660 unmatched rides, classified) and `npm run photos:gaps` (211 listings without photos, by reason).

## Founder decisions needed before indexing

1. Approve the city and ride-type + city copy, then set `copyApproved: true`.
2. Turn on indexing: `PUBLIC_INDEXING=true` and `APP_ENV=production` in Vercel production.
3. Optionally tune the radius and minimum-ride thresholds, which change the counts above.
