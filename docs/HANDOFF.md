# Handoff — session one (2026-10-01)

## Done
- New, separate repository `derekbowen/carnivalriderental` (was empty). Nothing in PRNM or any other business was touched.
- Next.js 15 + TypeScript + Tailwind 4 app with the development slice: browse demo Ferris wheel → event request → persisted → internal console retrieves it → status updates reflected on the customer page.
- pSEO foundation: canonical route builder, publication gates, five page families (ride, category, city, ride + city, browse), sitemap/robots gating, demo/publishable separation enforced by integrity checks.
- Sharetribe capabilities researched from official docs; mapping recommendation and payment options in `SHARETRIBE_MAPPING.md`.

## Integrations — connected vs mocked
| Integration | State |
|---|---|
| Sharetribe | **Active environment switched to "CarnivalRental Test" on the founder's instruction** (Integration API + Marketplace API client both verified read-only; 0 listings, 0 users). Dev credentials kept in `.env.local` for switching back. Earlier: **read-only connected** to marketplace **"CarnivalRental Dev"** (founder confirmed it is a new marketplace for this business). Verified 2026-10-01 with an Integration API token and `marketplace/show`; 0 listings, 0 users. Credentials live only in the gitignored `.env.local` (`SHARETRIBE_INTEGRATION_CLIENT_ID/_SECRET`). One extra 40-hex value the founder supplied did not pair with this client ID and is stored as unused. Requests, quotes and transactions **still use the local development store**. Nothing has been written to Sharetribe. Check with `npm run sharetribe:check`. A second Integration API app for the **"CarnivalRental Test"** environment was also supplied and verified read-only; it is stored separately and not used (development targets Dev; Test should mirror Live). A third app for **Test** (client ID + secret) was also supplied: its client ID works for anonymous Marketplace API reads and the pair also works for the Integration API. It is stored separately and unused. **Still needed for development: a Marketplace API client ID (and secret) for the Dev environment**, for customer sign-up, quote requests and trusted server-side transitions. |
| Stripe / payments | Demo adapter only. No Stripe keys, no card fields. |
| Magic Patterns | Connected. Design: https://www.magicpatterns.com/c/nl7azuhaqeazotvxqdbyka (preview: https://project-blissful-ketchup-438.magicpatterns.app). The founder uploaded the export; it is committed unchanged in `design/magic-patterns/` as a reference, and its visual system and layouts are ported into `src/`. Invented inventory, specs, prices and payment promises in the export were **not** adopted — see `design/magic-patterns/README.md`. |
| Email / SMS | None. No outreach. |
| Cloudflare | Founder asked to run Cloudflare agent setup: the `cloudflare` plugin marketplace and plugin are installed for this (temporary) session. `/reload-plugins` and the optional `cf` CLI are pending the founder. Nothing deployed. |
| Domain | Founder named `carnivalriderental.us` as the candidate domain. Recorded only; no DNS changes, no deployment, indexing still off. |

## Decisions needed before real transactions
See `SHARETRIBE_MAPPING.md` → "Decisions needed". In short: ~~seller-of-record entity~~ (decided: **10000 Solutions LLC**); payment option (full / deposit+balance / saved card + off-session / pay after supplier commits); deposit %, cancellation and refund policy; handling for events > 75–90 days out; commission lines on our own listings; supplier payment terms; what makes an operator `verified_supplier` (insurance, contract); whether committing should also require a *verified unit* (today it requires a verified supplier and an identified unit).

## Hosting (asked, not done)
No AWS or DigitalOcean server is reachable from this environment. The only AWS-related item is a proxy credential scoped to poolrentalnearme.com (PRNM infrastructure — off-limits). Connected options: Vercel (three teams named "Derekbowencorp 5352") and Cloudflare (three unrelated Workers). Recommended: a new Vercel project plus hosted Postgres (Supabase or Vercel Postgres), password-protected preview, indexing off. Awaiting the founder's choice of team and database.

## Catalog foundation (contract v1.1.0)
Built and tested (88 unit, 11 e2e): approved contract, MATCH/DRIFT/UNVERIFIED config verifier with negative tests, read-side catalog adapter, preview listing page + city pSEO preview, duplicate-safe seed planner, live search-proof script, payment-state doc. **Not yet proven on real Sharetribe data** — blocked on (1) Console changes in Test (`docs/DATA_CONTRACT.md` §7; no API can make them) and (2) a founder-approved seller account email. See `docs/DATA_CONTRACT.md` §8 for exact evidence status.

## Founder to-do (blocked on you — do these from a computer or Cowork)
1. **Sharetribe Console (Test)** — apply `docs/DATA_CONTRACT.md` §7, then tell Claude to run `npm run sharetribe:inspect && npm run contract:diff`.
2. **Seller account email** for 10000 Solutions LLC (company-controlled; needed to create listings).
3. **Dev Marketplace API client ID + secret** (Console → Build → Applications, Dev environment).
4. **Hosting** — pick the Vercel team and database (Supabase or Vercel Postgres).
5. **Payment policy** — deposit %, refunds, events > 75 days out (`docs/PAYMENT_STATES.md`).
6. **Email + SMS provider** for booking communication.
7. **Operator research** — coworker fills `research/operator-research-template.xlsx`; send it to Claude directly (not into the repo).
8. **pSEO copy review** — approve occasion intros and ride types (`docs/PSEO_TEMPLATES.md` §6).
10. **Category hub pilot** — review the five previews and approve or edit their copy (`src/lib/content/category-pages.ts`, `reviewStatus`). Optional: add Magic Patterns credits and run `design/magic-patterns/CATEGORY_PILOT_PROMPT.md`.
9. **Operator program decisions** — who pays the fee and the rate, far-out events, updated-price path, operator requirements, cancellations (`docs/OPERATOR_MARKETPLACE.md` §6). Then approve the `/operators` copy.

## Mobile apps (2026-10-04)
Web build is app-shell ready for a Capacitor wrapper (iOS + Android); see `docs/MOBILE_APP.md` for the wrapper must-dos.

## Operator program (2026-10-04)
`/operators` early-access page (noindex) + application form → `/internal/operators`. No accounts, listings, payments or SMS. See `docs/OPERATOR_MARKETPLACE.md`.

## pSEO families (2026-10-04)
State hubs (51), occasion hubs (75) and occasion × state (3,825) are built and noindex. They show live catalog supply only and become indexable per `docs/PSEO_TEMPLATES.md` §4.

## Next small milestone
1. ~~Confirm the marketplace~~ — done: "CarnivalRental Dev".
2. ~~Read-only connection check~~ — done; the console shows the live status (cached 10 min).
3. Create the house seller account in Dev, onboard Stripe **test mode**, create one Ferris wheel offering listing via the Integration API, and sync it into the content layer.
4. Decide on the export's operator-procurement ideas (closest-unit-first call sheet, yes/no answers, listed-unit catalogue). The call sheet fits the internal console once real, verified unit records with locations exist.
