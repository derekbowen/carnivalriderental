# Handoff — session one (2026-10-01)

## Done
- New, separate repository `derekbowen/carnivalriderental` (was empty). Nothing in PRNM or any other business was touched.
- Next.js 15 + TypeScript + Tailwind 4 app with the development slice: browse demo Ferris wheel → event request → persisted → internal console retrieves it → status updates reflected on the customer page.
- pSEO foundation: canonical route builder, publication gates, five page families (ride, category, city, ride + city, browse), sitemap/robots gating, demo/publishable separation enforced by integrity checks.
- Sharetribe capabilities researched from official docs; mapping recommendation and payment options in `SHARETRIBE_MAPPING.md`.

## Integrations — connected vs mocked
| Integration | State |
|---|---|
| Sharetribe | **Read-only connected** to marketplace **"CarnivalRental Dev"** (founder confirmed it is a new marketplace for this business). Verified 2026-10-01 with an Integration API token and `marketplace/show`; 0 listings, 0 users. Credentials live only in the gitignored `.env.local` (`SHARETRIBE_INTEGRATION_CLIENT_ID/_SECRET`). One extra 40-hex value the founder supplied did not pair with this client ID and is stored as unused. Requests, quotes and transactions **still use the local development store**. Nothing has been written to Sharetribe. Check with `npm run sharetribe:check`. |
| Stripe / payments | Demo adapter only. No Stripe keys, no card fields. |
| Magic Patterns | Connected. Design: https://www.magicpatterns.com/c/nl7azuhaqeazotvxqdbyka (preview: https://project-blissful-ketchup-438.magicpatterns.app). The founder uploaded the export; it is committed unchanged in `design/magic-patterns/` as a reference, and its visual system and layouts are ported into `src/`. Invented inventory, specs, prices and payment promises in the export were **not** adopted — see `design/magic-patterns/README.md`. |
| Email / SMS | None. No outreach. |
| Cloudflare | Founder asked to run Cloudflare agent setup: the `cloudflare` plugin marketplace and plugin are installed for this (temporary) session. `/reload-plugins` and the optional `cf` CLI are pending the founder. Nothing deployed. |
| Domain | Founder named `carnivalriderental.us` as the candidate domain. Recorded only; no DNS changes, no deployment, indexing still off. |

## Decisions needed before real transactions
See `SHARETRIBE_MAPPING.md` → "Decisions needed". In short: ~~seller-of-record entity~~ (decided: **Ten Thousand Solutions LLC**); payment option (full / deposit+balance / saved card + off-session / pay after supplier commits); deposit %, cancellation and refund policy; handling for events > 75–90 days out; commission lines on our own listings; supplier payment terms; what makes an operator `verified_supplier` (insurance, contract); whether committing should also require a *verified unit* (today it requires a verified supplier and an identified unit).

## Hosting (asked, not done)
No AWS or DigitalOcean server is reachable from this environment. The only AWS-related item is a proxy credential scoped to poolrentalnearme.com (PRNM infrastructure — off-limits). Connected options: Vercel (three teams named "Derekbowencorp 5352") and Cloudflare (three unrelated Workers). Recommended: a new Vercel project plus hosted Postgres (Supabase or Vercel Postgres), password-protected preview, indexing off. Awaiting the founder's choice of team and database.

## Next small milestone
1. ~~Confirm the marketplace~~ — done: "CarnivalRental Dev".
2. ~~Read-only connection check~~ — done; the console shows the live status (cached 10 min).
3. Create the house seller account in Dev, onboard Stripe **test mode**, create one Ferris wheel offering listing via the Integration API, and sync it into the content layer.
4. Decide on the export's operator-procurement ideas (closest-unit-first call sheet, yes/no answers, listed-unit catalogue). The call sheet fits the internal console once real, verified unit records with locations exist.
