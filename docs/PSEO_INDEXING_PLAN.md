# Inventory pSEO: controlled indexing plan (prepared 2026-10-05; first cohort and second wave released 2026-10-14)

Status 2026-10-18: **1,000 URLs are indexable** (section 8: wave 1's 13 plus wave 2's 987; wave 2 refreshed on the 4,512-ride snapshot), an exact list on the Live inventory, each still behind its supply, near-duplicate and environment gates. Everything else stays `noindex`. Sections 1–6 are the history and the gate design; section 7 is the first cohort; section 8 is the current state. Payment readiness is a separate decision and does not gate or unlock SEO.

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

**Cohort on the final Live snapshot** (`reports/indexing-cohort.json`, inventory exported
2026-10-14 from Live; gates evaluated with production indexing on; supply = rides in
the 200-mile radius, or matching rides for ride + city, or the category's inventory; operators are
distinct Live authors; "contactable" = a usable phone, email or website in Live):

| URL | Family | Supply (rides) | Distinct operators | Contactable operators | Duplicate head | Result |
|---|---|---|---|---|---|---|
| `/ohio/columbus` | city | 499 | 15 | 15 | yes | **indexable** |
| `/ohio/columbus/ferris-wheel` | ride-city | 22 | 13 | 13 | yes | **indexable** |
| `/texas/austin` | city | 158 | 6 | 6 | yes | **indexable** |
| `/texas/austin/carousel` | ride-city | 6 | 4 | 4 | yes | **indexable** |
| `/illinois/chicago` | city | 452 | 19 | 19 | yes | **indexable** |
| `/illinois/chicago/ferris-wheel` | ride-city | 18 | 13 | 13 | yes | **indexable** |
| `/florida/orlando` | city | 241 | 4 | 4 | yes | **indexable** |
| `/georgia/atlanta` | city | 103 | 4 | 4 | yes | **indexable** |
| `/minnesota/minneapolis` | city | 176 | 8 | 8 | yes | **indexable** |
| `/washington/seattle` | city | 148 | 3 | 3 | yes | **indexable** |
| `/` | core | 3714 | 119 | 119 | n/a (not a city page) | **indexable** |
| `/rides` | core | 3714 | 119 | 119 | n/a (not a city page) | **indexable** |
| `/categories/ferris-wheels` | category | 185 | 109 | 109 | n/a (not a city page) | **indexable** |

All 13 candidates pass every gate; none was forced. Seattle sits exactly at the Event Access minimum
of 3 contactable operators: if that drops on a later snapshot, the cohort manifest flags it.

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
candidates. On the final Live snapshot: city pages: 320 candidates,
1068 not their group's head, 32 with fewer than 3 contactable
operators, 6 thin; ride + city pages: 2001 candidates,
13893 not their group's head, 34 with fewer than 3 contactable operators. A second wave needs: the same gates, ≥ 3 distinct contactable operators, a rendered-page
review, and 4–6 weeks of Search Console evidence from this wave (impressions, crawl stats,
"Duplicate without user-selected canonical"). Each wave is a separate go; nothing widens
automatically.

Rollback: `PUBLIC_INDEXING=false` and redeploy (blanket `Disallow: /`, sitewide `noindex`, empty
sitemap). Or remove a path from `pilot.ts` and redeploy: it leaves the sitemap and turns `noindex`.

## 8. Second indexing wave: 1,000 URLs (released 2026-10-14)

**Authorization.** Founder instruction, 2026-10-14: "lets index 1000 pages". The founder chose to
widen now, without the 4–6 weeks of Search Console evidence from wave 1 that section 7 asked for.
The authorization and the content review are recorded separately in
`src/lib/inventory/indexing-wave-2.json` and `pilot.ts`.

**Selection (`npm run migrate:live -- wave --size 1000`, read-only against Live).** Only pages
that already pass every gate unchanged. No threshold, radius or duplicate rule was touched:

- supply: city ≥ 10 rides within 200 mi; ride + city ≥ 5 matching rides; category ≥ 3;
- head of its near-duplicate group (`index-eligible.json`);
- at least 3 distinct Live operators with a usable contact channel (the Event Access minimum).

Of 2,321 gated city and ride + city candidates, the strongest were taken first, ranked by distinct
contactable operators, then rides. The lowest selected page still has **6** contactable operators.

**Refresh on the 2026-10-18 snapshot (gap-audit import, 4,512 rides).** The new rides regrouped the
near-duplicate map, and 132 wave-2 pages stopped being their group's head. The founder chose to
refill to 1,000 rather than let the set shrink: `wave --size 1000 --keep` kept the 851 pages that
still pass every gate and added the 132 strongest gated candidates. A plain re-run would have
re-ranked everything and swapped 288. Same rules, same cap; the cohort manifest shows 1,000 of
1,000 eligible under production gates.

| Indexed set | URLs |
|---|---|
| Wave 1: `/`, `/rides`, `/categories/ferris-wheels` and 10 geo pages | 13 |
| Wave 2: category hubs (carousels, swing rides, thrill rides, kiddie rides) | 4 |
| Wave 2: city pages | 165 |
| Wave 2: ride + city pages (27 ride types) | 818 |
| **Total in the sitemap** | **1,000** |

The 983 wave-2 geo pages cover 27 states, weighted toward where operators are: Indiana, New York,
Michigan, Pennsylvania, Ohio, Illinois, Wisconsin and California lead.
`reports/indexing-cohort.json` lists every indexed URL with its rides, distinct operators, contactable
operators and duplicate-head status: 1,000 of 1,000 eligible under production gates.

**Gates stay live.** The wave stands in only for template copy approval on these exact paths. Every
build evaluates environment, supply and duplicate-head again. A page that falls below its threshold,
or stops being its group's head after a new inventory snapshot, leaves the sitemap and turns
`noindex` by itself.

**Content review.** Wave 2 was not reviewed page by page by the founder. Every URL is checked on the
production domain after deploy by `scripts/verify-release.ts`:

- 200, `index`, self-canonical;
- no private contact data, no Offer or price in JSON-LD;
- the excluded families stay `noindex`: near-duplicate non-heads, gated pages not yet authorized,
  `/s/*`, state, directory, `/connect`, `/pass`.

**Internal links.** Each category hub links to at most 24 of its indexed ride + city pages: wave 1
first, then the strongest of wave 2. The sitemap lists every page.

**Still noindex:**
- 1,338 gated candidates not selected: 155 city and 1,183 ride + city (`reports/indexing-expansion.json`);
- every near-duplicate non-head;
- state, event, event + state and directory pages;
- `/s`, `/s/{id}` and any filter or query variant;
- guides, operators and legal pages;
- `/connect` and `/pass` (private).

**What to watch in Search Console.**
- Coverage: "Crawled – currently not indexed" and "Duplicate without user-selected canonical" on
  ride + city pages.
- Crawl stats.
- Impressions by family.

If many ride + city pages land in "not indexed", shrink the wave: rerun `wave` with a smaller `--size`
and redeploy.

**Rollback.**
- Everything: `PUBLIC_INDEXING=false` and redeploy.
- Wave 2 only: empty `paths` and `categoryPaths` in `indexing-wave-2.json` and redeploy. Wave 1 stays.

## 9. Third wave: event pages and buyer guides (2026-10-24)

**Authorization.** Founder instruction, 2026-10-24, after the Search Console review: "Open wedding pages" and "Ferris wheel content + guides". Recorded in `WAVE_3` (`src/lib/inventory/pilot.ts`). Content review: automated checks only, NOT a page-by-page review by the founder.

**Search Console evidence (Oct 9–22).**
- 431 impressions and 10 clicks, average position 28.
- "rent ferris wheel for wedding": 29 impressions at position 6.8 and no clicks, with no page written for it.
- Private-party, birthday and corporate Ferris wheel searches also appear.

**Opened (8 URLs).**
- Event pages: `/events/weddings`, `/events/birthday-parties`, `/events/backyard-parties`, `/events/company-picnics`.
- Buyer guides:
  - `/guides/how-to-rent-carnival-rides`;
  - `/guides/ride-owner-vs-rental-broker`;
  - `/guides/ferris-wheel-rental-cost` (new);
  - `/guides/ferris-wheel-wedding-rental` (new).
- Until now the guides followed the site default, which is noindex, and were not in the sitemap.

**Gates.**
- `occasionGate` accepts the exact allowlisted path in place of approved copy. Its supply is now the operator inventory of the page's suggested categories: the page shows that inventory, while the managed catalog it used to count is retired.
- `guideGate` has no supply gate.
- Both need `PUBLIC_INDEXING` on and APP_ENV production.
- State versions (`/{state}/{id}`) were unchanged and stayed closed (opened 2026-10-27, section 10).

**Also on 2026-10-24.**
- Search-matched titles and descriptions: homepage, Ferris wheel and carousel hubs, and the city and ride + city descriptions. Canonical URLs are unchanged.
- The wedding page leads with "Ferris wheel and carousel rentals for weddings" and links its guides.

**IndexNow.** `npm run seo:indexnow -- --submit` sends exactly the sitemap's pages to Bing. Bing shares IndexNow submissions with the other participating engines.
- The key is the public file `public/<key>.txt`.
- Run it after any deploy that opens pages.
- First run (2026-10-24, after deploy `c4ca14f`): HTTP 403 for all 1,008 URLs, meaning the key could not be validated.
  - Vercel's security checkpoint challenges every automated fetch of the site, including the key file (429, `x-vercel-mitigated: challenge`), so IndexNow's verifier most likely never reached it.
  - Fallback: in Bing Webmaster Tools, import the site from Google Search Console, then submit `/sitemap.xml`.
  - Rerun the script once the key file loads without a challenge.

**Rollback.**
- Empty `WAVE_3.eventPaths` and `WAVE_3.guidePaths`, then redeploy.

## 10. Open indexing: every public page (2026-10-27)

**Authorization.** Founder instruction, 2026-10-27, after the Search Console overview (412 indexed, 4,417 not indexed): "unleash it, undo all no index". Recorded in `OPEN_INDEXING` (`src/lib/inventory/pilot.ts`).

**Content review.** Automated checks only (tests, privacy guards, the release crawl). The founder did not review the pages one by one.

**What changed.** One switch, `OPEN_INDEXING.enabled`, approves every public page. It replaces, for every page:
- copy approval (`PSEO_INVENTORY.copyApproved`, `OPERATOR_PROGRAM.copyApproved` and the occasion and category `reviewStatus`, all of which stay as they were);
- the wave allowlists;
- the near-duplicate gate (`index-eligible.json`), which no longer holds back nearby city pages.

The gates call it through `approvedForIndexing(path)`.

**What did not change.**
- `PUBLIC_INDEXING` and APP_ENV production are still required.
- Every family keeps its supply floor, so thin pages stay noindex (without a canonical for inventory pages):
  - city: 10 rides within 200 mi;
  - ride + city: 5;
  - state, event, event + state and category hub: 3;
  - core hubs: 10 in the snapshot.
- Private pages stay noindex and out of the sitemap whatever the switch says: connect, pass, internal, API, requests, concierge, search results (`/s`, filtered `/rides`) and previews.
- The managed-catalog gates in `publication.ts` (demo fixtures, record status, verified specs) are unchanged.

**Supply now counted from the operator inventory each page shows** (the managed catalog is retired):
- state pages: rides based in or serving the state;
- event + state pages: rides of the event's suggested ride types within 200 mi of the state's centre.

The retired catalog's live offerings still count when there are any.

**Newly open families.**
- Ride listings (`/s/{id}`), now with a self-canonical.
- State pages.
- Every event page and event + state page.
- The directory.
- The operator program page.
- The events index, legal and contact pages (`SITE_PAGES`).

**Size.** 29,602 indexable URLs, all in one sitemap (the protocol limit is 50,000):

| Family | Pages |
|---|---|
| Core | 2 |
| Operator page | 1 |
| Guides | 4 |
| Category hubs | 5 |
| States | 50 |
| Events | 75 |
| Event + state | 2,965 |
| Cities | 1,467 |
| Ride + city | 20,463 |
| Directory | 52 |
| Ride listings | 4,512 |
| Site pages | 6 |

**One list.** `sitemapRoutes()` (`src/lib/seo/sitemap-routes.ts`) feeds the sitemap, `npm run seo:indexnow` and `scripts/verify-release.ts` (`--sample N` checks every Nth URL).

**Risk the founder accepted.** Most of the new URLs are near-duplicates: neighbouring cities share most listings, and event + state pages share their template. Google may index only some of them or pick its own canonical, and a large share of similar pages can weigh on how the whole site ranks. Watch Search Console's Pages report ("Duplicate, Google chose different canonical", "Crawled – currently not indexed") over the next weeks.

**Rollback.** Set `OPEN_INDEXING.enabled` to false and redeploy. Waves 1–3 apply again, the near-duplicate gate returns, and the rollback tests in `tests/pseo-pilot.test.ts` cover that state.
