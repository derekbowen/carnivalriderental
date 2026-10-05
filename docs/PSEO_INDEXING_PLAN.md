# Inventory pSEO: controlled indexing plan (prepared 2026-10-05, NOT enabled)

Status: **indexing is off.** Nothing in this document has been switched on. Every step below needs an explicit founder go. Payment readiness (Stripe, commission, bookability) is a separate decision and does not gate or unlock SEO.

## 1. Current state (verified on carnivalriderental.us)

| Control | Where | Current value | Effect |
|---|---|---|---|
| `APP_ENV` | Vercel production env | `preview` | `publicIndexingEnabled()` is false; demo fixtures may load on the legacy `/rides` pages |
| `PUBLIC_INDEXING` | Vercel production env | `false` | same |
| `PSEO_INVENTORY.copyApproved` | `src/lib/inventory/index.ts` | `false` | no inventory page passes the approval gate |
| `PSEO_PILOT.enabled` | `src/lib/inventory/pilot.ts` | `false` | the pilot allowlist does nothing |
| `robots.txt` | `src/app/robots.ts` | `User-agent: * / Disallow: /` | crawlers are asked not to fetch any URL |
| `X-Robots-Tag` header | `src/middleware.ts` | `noindex, nofollow` on every response | applies only when the URL is fetched |
| Page `<meta name="robots">` | `inventoryMetadata()` | `noindex, follow` (supply OK) / `noindex, nofollow` (thin) | applies only when the URL is fetched |
| Canonical | `inventoryMetadata()` | self-canonical when supply OK; none when thin | |
| Sitemap | `src/app/sitemap.ts` | 0 inventory URLs | only gate-passing routes are listed |

## 2. Why `Disallow: /` is not a guarantee, and the correction

`robots.txt` controls **crawling**, not **indexing**. While `Disallow: /` is in place, Google cannot fetch our pages, so it never sees the `noindex` meta tag or the `X-Robots-Tag` header. A disallowed URL that is linked from elsewhere can still be indexed as a bare URL (no title or snippet, "No information is available for this page"). Combining `Disallow` with `noindex` therefore weakens `noindex`.

**What the code does once both env flags are on** (verified in `robots.ts` and `middleware.ts`): `robots.txt` becomes `Allow: /` with `Disallow: /internal /api /requests /request` plus the sitemap line, and the blanket `X-Robots-Tag` is no longer sent. Each page's own `<meta name="robots">` then decides, and that is the intended control. `/internal` and 401 responses keep `noindex, nofollow` regardless.

**The gap is today's state.** Every URL is behind `Disallow: /`, so Google cannot read our `noindex`, and any URL linked from elsewhere can appear as a bare result.

**Correction (documented; apply only with a founder go):**

1. *Recommended, before or with the pilot:* make `robots.ts` return `Allow: /` (still disallowing `/internal`, `/api`, `/requests`, `/request`) whenever `APP_ENV=preview` on the production domain, without a sitemap line. The middleware header (`noindex, nofollow`) and the page meta tags stay as they are. Crawlers can then fetch pages and see `noindex`, so nothing gets indexed and any bare URLs drop out. Preview deployments on `*.vercel.app` should keep `Disallow: /`.
2. *At pilot start:* set `APP_ENV=production` and `PUBLIC_INDEXING=true`. Robots and headers switch automatically, as described above. Non-approved pages stay `noindex` through their meta tag; approved pages get `index, follow`, a self-canonical and a sitemap entry.
3. Pages that should not exist (unknown slugs, thin ride + city) stay **404**, not noindex.
4. In Search Console, use URL Inspection on a few non-pilot URLs after step 1 to confirm Google sees "Excluded by 'noindex' tag".

## 3. The gates (unchanged by the pilot)

A page is indexable, gets a self-canonical, and is listed in the sitemap only when **all** of these hold:

1. `publicIndexingEnabled()`: `APP_ENV=production` **and** `PUBLIC_INDEXING=true`.
2. Copy approval: `PSEO_INVENTORY.copyApproved === true` (whole template), **or** the exact path is on `PSEO_PILOT.paths` with `PSEO_PILOT.enabled === true`.
3. Supply: ≥ 10 rides within 200 mi (city), ≥ 5 matching rides (ride + city), computed from the current snapshot at build time.

The pilot only stands in for (2) on exact paths. It cannot override (1) or (3). A pilot URL whose supply drops below the threshold becomes noindex and leaves the sitemap on the next build. This is covered by `tests/pseo-pilot.test.ts`.

The sitemap holds only URLs that pass every gate, as canonical absolute URLs. It never holds query strings, filtered search URLs, thin pages, or noindex pages.

## 4. Proposed pilot (10 URLs, disabled)

Each URL is the head of its near-duplicate group (section 5), so no two pilot pages show substantially the same listings.

| URL | Rides in radius | Why |
|---|---|---|
| `/ohio/columbus` | 499 | highest supply; review example |
| `/ohio/columbus/ferris-wheel` | 22 | review example; strong ride-type supply |
| `/texas/austin` | 158 | review example |
| `/texas/austin/carousel` | 6 | review example; near the ride + city threshold |
| `/illinois/chicago` | 452 | large metro, separate group |
| `/illinois/chicago/ferris-wheel` | 18 | second ride + city sample |
| `/florida/orlando` | 241 | Southeast, separate group |
| `/georgia/atlanta` | 103 | Southeast, separate group |
| `/minnesota/minneapolis` | 176 | Upper Midwest |
| `/washington/seattle` | 148 | West Coast |

**To start the pilot (founder go required for each line):**

1. Founder reviews the five examples and approves the pilot list (record the name and date in `pilot.ts`).
2. Set `PSEO_PILOT.enabled = true`.
3. Apply the robots and header correction from section 2.
4. Set `APP_ENV=production` and `PUBLIC_INDEXING=true` in Vercel production. This also disables demo fixtures sitewide; check the legacy `/rides` and category pages first.
5. Deploy. Verify that `sitemap.xml` lists exactly the 10 URLs and that each returns 200, `index, follow`, a self-canonical and no `X-Robots-Tag`. Verify that every other inventory URL still says `noindex`.
6. Submit the sitemap in Search Console. Watch impressions, crawl stats and "Duplicate without user-selected canonical" for 4–6 weeks before widening.

Other page families gated by `src/lib/seo/publication.ts` (state hubs, categories, occasions, `/operators`) have their own approval flags. Turning on `PUBLIC_INDEXING` does not make them indexable unless their own gates pass. Check `npm run pseo:report` and the sitemap before step 5.

## 5. Near-duplicate findings (`npm run pseo:duplicates` → `reports/pseo-duplicates.json`)

Adjacent city pages share one template, so the only thing that differs between them is the listing set and its order. With a 200-mile radius, neighbouring cities see almost the same operators.

- **City pages:** 1,427 pages meet supply. Of the 24,500 pairs within 60 miles, 68.9% share ≥ 90% of listing IDs, 50.1% display the identical 12 cards in the identical order, and the median overlap is 100%. Grouping pages that share ≥ 90% of listings and ≥ 90% of displayed cards leaves **359 distinct pages** (175 groups hold 1,243 pages).
- **Ride type + city pages:** 15,931 pages meet supply, and 14,946 of them fall in near-duplicate groups. That leaves **2,038 distinct pages**.
- **Largest groups (head +members):** San Jose +79 (San Francisco, Oakland, Stockton, Fremont, Modesto…); Miami +46 (Port St. Lucie, Hialeah, Fort Lauderdale…); Dallas +41 (Fort Worth, Arlington, Plano…); New York +39 (Newark, Jersey City, Yonkers…); Long Beach +38; Seattle +31 (Tacoma, Bellevue…); Atlanta +29; Boston +29.

**Implications (decisions for the founder; nothing has been changed):**

- Index at most one page per group, the head (the most populous city). `groupHeadOf` in the report maps every page to its head.
- Non-head pages can stay live, linked and `noindex`. We have **not** redirected them, changed canonicals in bulk, or written local paragraphs to make them look different.
- The 200-mile radius drives the overlap. A smaller radius for page content (for example 75 miles) would make adjacent pages genuinely different but would thin out supply. This is a product decision, not an SEO trick. Rerun `pseo:report` and `pseo:duplicates` after any change.

## 6. What stays off

`copyApproved`, `PSEO_PILOT.enabled`, `APP_ENV`, `PUBLIC_INDEXING`, the robots change and the sitemap submission all remain unchanged until the founder says go.
