# Inventory pSEO: controlled indexing plan (prepared 2026-10-05; first cohort released 2026-10-14)

Status 2026-10-14: **the first indexing cohort is released** (section 7): an exact list of URLs, on the Live inventory, each still behind its supply, near-duplicate and environment gates. Everything else stays `noindex`. Sections 1–6 are the history and the gate design; section 7 is the current state. Payment readiness is a separate decision and does not gate or unlock SEO.

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
4. **Near-duplicate head (founder decision 2026-10-05, option 1):** the page is the head of its near-duplicate group, or belongs to no group (`src/lib/inventory/index-eligible.json`, written by `npm run pseo:duplicates`). Non-head pages stay live for visitors and keep their self-canonical, but are always `noindex` and never in the sitemap. The list is stamped with the snapshot it was computed from. If the inventory is re-exported and the list isn't regenerated, **nothing** is indexable.

The pilot only stands in for (2) on exact paths. It cannot override (1), (3) or (4). A pilot URL whose supply drops below the threshold becomes noindex and leaves the sitemap on the next build. This is covered by `tests/pseo-pilot.test.ts`.

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

**Decision (founder, 2026-10-05): option 1, one page per group.** This is enforced by gate 4 above.

- The most that can ever be indexed is **2,397 pages: 359 city + 2,038 ride type + city**, out of 17,358 supply-sufficient pages. `groupHeadOf` in the report maps every page to its head.
- Non-head pages stay live, linked and `noindex`, with their self-canonical. Nothing is redirected, re-canonicalised in bulk, or padded with local paragraphs.
- The 200-mile radius drives the overlap. Changing it is a separate product decision; rerun `pseo:report` and `pseo:duplicates` after any change.
- Indexing itself is still **off**. This decision only limits what can be indexed once the founder turns indexing on.

## 5b. Release checklist (prepared 2026-10-12; nothing switched on)

Prepared so the release is a sequence of known switches, each verifiable, with the private pages
excluded at every layer. State on 2026-10-12: `PUBLIC_INDEXING=false`, `APP_ENV=preview`,
`PSEO_PILOT.enabled=false`, `copyApproved=false`; `npm run pseo:report` → 0 indexable; robots.txt is
the blanket `Disallow: /`; the sitemap is empty.

What is already done for the release (deployed, verified by tests):
- Demo fixtures are gone from every public page family (`/rides`, category hubs, state and occasion
  pages are inventory-backed) and `ALLOW_DEMO_CONTENT=false` is set in Vercel production, so step 4
  of section 4 no longer has a demo-content side effect to check.
- Private pages are excluded three ways and must stay so: robots `disallow` for `/internal`, `/api`,
  `/requests`, `/request`, `/connect`, `/pass` (src/app/robots.ts), `robots: noindex` metadata plus
  `X-Robots-Tag: noindex` and `Cache-Control: private, no-store` on `/connect*` and `/pass*`
  (e2e/access.spec.ts, e2e/privacy.spec.ts), and none of them are in `sitemap.ts` (only routes whose
  publication gate passes are listed). `/s` and `/s/{id}` stay `noindex, follow`.
- Price copy on public pages reads product rows and never contains a bare universal "$99"; the only
  `Offer` JSON-LD is on the private matches page (e2e/structured-data.spec.ts asserts no `offers` or
  `price` in public graphs).

Release steps (founder go for each; indexing is a separate authorisation from payments):
1. Approve the pilot list; write the reviewer name and date into `src/lib/inventory/pilot.ts` and set
   `PSEO_PILOT.enabled = true` (or set `PSEO_INVENTORY.copyApproved = true` for the whole family; the
   near-duplicate gate still applies). Run `npm run pseo:duplicates` and `npm run pseo:report`: the
   report must list exactly the intended paths as indexable.
2. Vercel production: `APP_ENV=production`, `PUBLIC_INDEXING=true`. Deploy `main`.
3. Verify on the domain: `robots.txt` shows `Allow: /` with the six disallows and the sitemap line;
   `sitemap.xml` lists exactly the approved URLs; each returns 200, `index, follow`, a self-canonical
   and no `X-Robots-Tag`; `/connect`, `/pass/…` and every non-approved inventory URL still answer
   `noindex` (the headers check in `e2e/access.spec.ts` is the same assertion).
4. Submit the sitemap in Google Search Console; do not request indexing of private URLs; watch
   coverage and "Duplicate without user-selected canonical" for 4–6 weeks before widening.
Rollback: set `PUBLIC_INDEXING=false` (blanket disallow and sitewide noindex return on the next deploy).

## 6. What stays off

`copyApproved`, `PSEO_PILOT.enabled`, `APP_ENV`, `PUBLIC_INDEXING`, the robots change and the sitemap submission all remain unchanged until the founder says go.

## 7. First indexing cohort (released 2026-10-14)

**Authorization and review are separate records.**
- *Authorization:* the founder's instruction of 2026-10-14 authorized a controlled first cohort of
  exactly these URLs, the production indexing flags, and sitemap publication. It did not lower any
  threshold or authorize other families (`src/lib/inventory/pilot.ts`, `authorization`).
- *Content review:* done on 2026-10-14 by the Claude Code session that ran the cutover, on the
  rendered pages of a local production build against the Live snapshot and again on the deployed
  domain. **The founder did not review these pages.** What was checked per URL: the page renders
  from inventory (no demo records, no invented specs, prices, capacities, reviews or availability),
  title/H1/description match the page, the listing cards show only public ride facts and photos,
  no operator identity or contact appears in HTML, JSON-LD, metadata or image URLs, the Event Access
  copy is accurate for the current state (checkout "opening soon" on production), and internal links
  resolve. Results: `reports/indexing-cohort.json` (per URL) and
  `reports/release-verification-carnivalriderental.us.json`.

**Mechanism.** `PSEO_PILOT.enabled = true` with two exact lists: `paths` (the 10-path geographic
pilot) and `corePaths` (`/`, `/rides`, `/categories/ferris-wheels`, resolved from `paths.*`). A path
on either list stands in only for copy approval. It still needs: `APP_ENV=production` and
`PUBLIC_INDEXING=true`; its supply gate on the current snapshot (city ≥ 10 rides within 200 mi;
ride + city ≥ 5 matching rides; category hub ≥ 3 offerings, counted from the operator inventory it
shows; core hubs ≥ 10 rides in the snapshot); and, for city and ride + city pages, being the head of
its near-duplicate group in `index-eligible.json` stamped with the same snapshot. `copyApproved`
stays `false`. Thresholds and the 200-mile radius are unchanged.

**One decision for every surface.** The same gate objects produce each page's robots meta, its
self-canonical and the sitemap entry (`src/app/sitemap.ts`), so the sitemap can't list a page that
says `noindex`. The root layout defaults every page to `noindex, follow`; only a passing gate sets
`index, follow`. The sitemap has no `lastmod` (a build or export timestamp on every URL says nothing
true about any one page).

**Robots.** With indexing on: `Allow: /`, `Disallow: /internal /api /requests /request /connect/
/pass`, and `Sitemap: https://carnivalriderental.us/sitemap.xml`. `/connect` (the public form) is
crawlable so crawlers can read its `noindex`; its private result pages, passes, APIs and the internal
console are disallowed and are also `noindex`, `no-store`, and entitlement- or auth-checked
(robots.txt is not access control). Preview deployments keep `APP_ENV=preview`: blanket
`Disallow: /` and `X-Robots-Tag: noindex, nofollow`.

**Internal links.** The Ferris wheel hub links first to its cohort ride + city pages (Columbus and
Chicago Ferris wheel rentals) before the general state and city lists; the Columbus and Chicago city
pages already link to their ride-type pages; the footer links every category hub sitewide. Nothing
was padded or added as new copy.

**Stays noindex in this release:** every other city and ride + city page; all state, event,
event + state and directory pages; the other four category hubs; `/s`, `/s/{id}` and any
query-string or filter variant; `/guides/*`, `/operators`, legal pages; `/connect`, `/connect/{id}`,
`/pass/*`, `/internal/*`, `/api/*` (also disallowed or private).

**Expansion (not enabled).** `npm run migrate:live -- cohort` writes `reports/indexing-expansion.json`:
every supply-sufficient page outside the cohort, why it is excluded (thin, not its group's head, or
fewer than 3 distinct operators with a usable contact channel in Live), and the ranked next
candidates. A second wave needs: the same gates, ≥ 3 distinct contactable operators, a rendered-page
review, and 4–6 weeks of Search Console evidence from this wave (impressions, crawl stats,
"Duplicate without user-selected canonical"). Each wave is a separate go; nothing widens
automatically.

Rollback: `PUBLIC_INDEXING=false` and redeploy (blanket `Disallow: /`, sitewide `noindex`, empty
sitemap). Or remove a path from `pilot.ts` and redeploy: it leaves the sitemap and turns `noindex`.
