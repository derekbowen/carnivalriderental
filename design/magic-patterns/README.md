# Magic Patterns design reference — NOT APP CODE

Source: Magic Patterns design https://www.magicpatterns.com/c/nl7azuhaqeazotvxqdbyka
(exported as a zip by the founder on 2026-10-01 and committed here unchanged, except that its README was renamed to `EXPORT_README.md`).

This folder is a **design-time reference**. It is a standalone Vite/React prototype. It is excluded from the app's TypeScript build, and nothing in `src/` may import from it. Magic Patterns is not a runtime dependency.

## Adopted into the app (`src/`)
- Design tokens: cool canvas `#F3F5FA`, navy ink `#0B1B3F`, marigold accent `#FFC629`, red "pop" `#E5352B`, red-and-white **awning stripe**, Bricolage Grotesque display + Inter body.
- Layout patterns: sticky header with awning, dark hero with search card and image collage, featured category grid, accent "How managed booking works" band, old-way vs our-way comparison table, price/availability legend, ride card with badge overlay, specs table with "Not yet verified", sticky request panel plus mobile bottom bar, vertical progress track, choice cards with dashed "Not sure", dark footer.

## Deliberately NOT adopted (conflicts with docs/PROJECT_BRIEF.md)
| Export content | Why not |
|---|---|
| `src/data/listings.ts`: 24 "listed units" with cities and specs (e.g. "Orlando, FL — 32 m, 36 gondolas") | Invented inventory. We have no verified units. Unit records live in the internal store only after verification. |
| `src/data/rides.ts` spec values marked "Typical" (heights, riders per rotation, setup times) and price ranges | Invented dimensions, capacities and prices. App specs stay `null` → "Not yet verified" until sourced. |
| Hero "Every carnival ride. All in one place." / "We list rides from carnival operators across the country" | That is the long-term ambition, not a current fact. |
| "We hold the money and pay the operator", "One payment to Book a Carnival", "Booked once an operator says yes" | Pre-empts the undecided payment and confirmation policy. The app confirms only after supplier commitment **and** the approved payment step. |
| "Operator confirmed" availability badge meaning a per-event yes | Mixes per-event status with public availability. Public pages say "Sourcing on request" or, only with a verified coverage record, "Verified equipment in this area". |
| `OperatorCallSheet` (closest unit first, yes/no, our offer) | Good internal procurement idea. Candidate for the next console iteration once distance data and real units exist. |
| Demo customer and internal request data | Fixtures; the app reads real persisted requests. |
