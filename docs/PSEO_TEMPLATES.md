# pSEO page templates — state, event type ("occasion"), ride type

Status: **built, noindex**. Every page renders; none is indexable until live supply and approved copy exist (gates below). Code: `src/lib/taxonomy/`, `src/lib/seo/pseo.ts`, `src/lib/seo/structured-data.ts`, `src/components/OccasionPage.tsx`, `src/app/locations/[state]`, `src/app/events/…`. Tests: `tests/pseo.test.ts`, `e2e/pseo.spec.ts`.

## 1. Dimensions (the JSON data)

| Dimension | File | Count | Notes |
|---|---|---|---|
| State | `src/lib/taxonomy/states.ts` | 51 (50 + DC) | Codes = contract `requestableStates` |
| Occasion (event type) | `src/lib/taxonomy/occasions.json` | 75 (zod: 50–75) | Separate from the listing field `eventTypes` (7 coarse values); each occasion maps to one of them |
| Ride type | `src/lib/taxonomy/ride-types.json` | 50, ranked | Search targets, **not inventory**. Priority is a first guess — replace with keyword volume |
| City | content layer `locations` | 3 demo | Real cities need sourced local notes (existing city gate) |

Taxonomy entries never make a page indexable on their own. **Supply on every page is the live Sharetribe catalog** (`getCatalog()`), filtered by state (`requestableStates`) and category.

### Occasion record — field order

```json
{
  "id": "bar-mitzvahs",                     // URL slug; permanent once indexed
  "name": "Bar mitzvah",                    // singular, display case
  "plural": "bar mitzvahs",                 // used in H1/title: "Carnival ride rentals for {plural}"
  "group": "religious-cultural",            // → shared planning notes + section heading
  "eventType": "private",                   // contract eventTypes ID → prefills the request form
  "guestFocus": "all-ages",                 // children | teens | adults | families | all-ages
  "suggestedCategories": ["ferris-wheels", "swing-rides", "family-rides", "thrill-rides"],
  "searchPhrases": ["bar mitzvah carnival rides", "bar mitzvah ride rental"],
  "intro": "One or two sentences specific to the occasion.",
  "related": ["bat-mitzvahs", "sweet-16-parties"],
  "reviewStatus": "draft"                   // founder sets "approved"; draft never indexes
}
```

Shared, defined once: `groups[]` (name, planningNotes) and `commonFaq[]`.

### Ride type record

```json
{ "id": "ferris-wheel", "name": "Ferris wheel", "categoryId": "ferris-wheels", "priority": 1,
  "searchPhrases": ["ferris wheel rental", "rent a ferris wheel"], "reviewStatus": "draft" }
```

No specs (height, riders, footprint, power). Brand-associated names appear only in `searchPhrases` (keyword matching), never in page copy unless a unit is verified to be that make.

## 2. Page families and URLs (all built by `paths.*`)

| Family | URL | Pages | Rendering |
|---|---|---|---|
| State hub | `/locations/{state}` | 51 | SSG + ISR 10 min |
| Occasion index | `/events` | 1 | navigation, always noindex |
| Occasion hub | `/events/{occasion}` | 75 | SSG + ISR 10 min |
| Occasion + state | `/events/{occasion}/{state}` | 3,825 | on first request + ISR 10 min |
| City (existing) | `/locations/{state}/{city}` | per city | existing gate |

## 3. Section order (the template)

**Occasion page** (`OccasionPage.tsx`; same for hub and +state):
1. Breadcrumbs — Home › Events › {Occasion} › {State}
2. Eyebrow (group name) + **H1** "Carnival ride rentals for {plural}[ in {State}]"
3. Intro — `occasion.intro` (+ one state sentence)
4. **Live supply** — offerings in the occasion's suggested categories that accept requests in the state; each card: "Sourcing on request", category, title → offering page, price label (estimate only if approved)
5. Other rides you can request (live, other categories)
6. Request CTA → `/request?state=…&occasion=…` (prefills state, event type, notes)
7. Planning notes (group)
8. Links: hub → 51 states + related occasions; +state → cities in state, state hub, national hub, related occasions in state
9. FAQ (common)
10. JSON-LD: `BreadcrumbList`, `Service` (provider = brand + legalName 10000 Solutions LLC; `areaServed` State/Country), `ItemList` of the listed offerings, `FAQPage`

**State hub**: breadcrumbs → H1 "Carnival ride rentals in {State}" → intro → live supply in state → CTA → event types in {State} (75 links, by group) → cities → how it works → FAQ → JSON-LD.

**Metadata**: title "{H1} | {brand}"; description from template; canonical from `paths`; robots from the gate.

Never in markup: ratings, reviews, prices, "available", supplier counts.

## 4. Gates — when a page may be indexed (`src/lib/seo/pseo.ts`)

All pages: production + `PUBLIC_INDEXING=true` + supply source is the live catalog. Test samples never count.

| Page | Needs |
|---|---|
| State hub | ≥ 3 live offerings accepting requests in the state |
| Occasion hub | `reviewStatus: approved` + ≥ 3 live offerings in suggested categories |
| Occasion + state | both parents indexable + ≥ 3 live suggested offerings accepting requests in the state |

The sitemap lists only pages that pass. Thresholds live in `PSEO_THRESHOLDS`.

## 5. Scale — why the gates matter

| Combination | Pages |
|---|---|
| states | 51 |
| occasions | 75 |
| occasion × state | 3,825 |
| ride type × state | 2,550 |
| ride type × occasion | 3,750 |
| ride type × occasion × state | 191,250 |
| ride type × occasion × city (300 cities) | ~1.1 million |

Google treats large sets of near-identical pages that only swap a place or event name as **scaled content / doorway pages**, and the penalty can hit the whole domain, not just those pages. What makes each page different is real supply, local facts and occasion-specific copy. So we build every URL now, but only pages carrying those things are indexed. The index then grows as listings are added, rather than all at once.

Suggested rollout:
1. Seed ride-family listings for the top ride types, covering the states we can actually serve.
2. Approve copy for the top 10–15 occasions.
3. State hubs and occasion hubs index first, then occasion × state where supply passes.
4. Ride type × state and ride type × occasion pages: next build step (public ride pages need to read the catalog first — today offering cards link to `/preview/rides/…`).
5. City-level pages only with sourced local notes (permits, venues).

## 6. Not done / next

- Public ride and ride-type pages from the live catalog (replacing demo-fixture `/rides/*` and the preview links).
- Ride type × state and ride type × occasion families (same gate pattern).
- Founder review of the 75 occasion intros and the 50 ride types (set `reviewStatus: "approved"`).
- Real city records with sourced local notes.
