# Handoff — session one (2026-10-01)

## Done
- New, separate repository `derekbowen/carnivalriderental` (was empty). Nothing in PRNM or any other business was touched.
- Next.js 15 + TypeScript + Tailwind 4 app with the development slice: browse demo Ferris wheel → event request → persisted → internal console retrieves it → status updates reflected on the customer page.
- pSEO foundation: canonical route builder, publication gates, five page families (ride, category, city, ride + city, browse), sitemap/robots gating, demo/publishable separation enforced by integrity checks.
- Sharetribe capabilities researched from official docs; mapping recommendation and payment options in `SHARETRIBE_MAPPING.md`.

## Integrations — connected vs mocked
| Integration | State |
|---|---|
| Sharetribe | Not connected (development adapter). The founder pasted a UUID and two 40-hex values mid-session, probably a client ID and secrets. They are stored only in the gitignored `.env.local` and are **unused and unverified**. A read-only check of which marketplace they belong to was blocked by the session's permission policy. |
| Stripe / payments | Demo adapter only. No Stripe keys, no card fields. |
| Magic Patterns | Connected. Design generated: https://www.magicpatterns.com/c/nl7azuhaqeazotvxqdbyka (preview: https://project-blissful-ketchup-438.magicpatterns.app). Its component code has **not yet been pulled** into the repo: reading it was blocked by the session's permission policy. The repo UI follows the same written design direction. |
| Email / SMS | None. No outreach. |
| Cloudflare | Founder asked to run Cloudflare agent setup: the `cloudflare` plugin marketplace and plugin are installed for this (temporary) session. `/reload-plugins` and the optional `cf` CLI are pending the founder. Nothing deployed. |
| Domain | Founder named `carnivalriderental.us` as the candidate domain. Recorded only; no DNS changes, no deployment, indexing still off. |

## Decisions needed before real transactions
See `SHARETRIBE_MAPPING.md` → "Decisions needed". In short: seller-of-record entity; payment option (full / deposit+balance / saved card + off-session / pay after supplier commits); deposit %, cancellation and refund policy; handling for events > 75–90 days out; commission lines on our own listings; supplier payment terms; what makes an operator `verified_supplier` (insurance, contract); whether committing should also require a *verified unit* (today it requires a verified supplier and an identified unit).

## Next small milestone
1. Founder confirms which Sharetribe marketplace/environment the pasted credentials belong to (must be a **new** marketplace for this business, Dev environment), or creates one.
2. Read-only connection check (`marketplace/show`) → replace the Sharetribe "not connected" status with a verified one.
3. Create the house seller account in Dev, onboard Stripe **test mode**, create one Ferris wheel offering listing via the Integration API, and sync it into the content layer.
4. Pull the Magic Patterns components into `src/components` and reconcile with the current UI.
