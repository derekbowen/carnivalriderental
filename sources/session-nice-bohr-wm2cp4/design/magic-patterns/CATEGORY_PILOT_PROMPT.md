# Magic Patterns — category pSEO pilot prompt

**Status (2026-10-04): NOT generated.** The design was reachable (editor `nl7azuhaqeazotvxqdbyka`,
active artifact `2652f8cb-30a3-4600-8526-2c4d498825d0`), but `create_design` (fork of that design + the
prompt below) returned: *"Insufficient credits. Please upgrade your plan or add credits at
magicpatterns.com/settings."* No Magic Patterns output exists for this pilot, and none was used.

The working previews in the app (`/categories/{ferris-wheels,carousels,swing-rides,thrill-rides,kiddie-rides}`)
were built locally from the **existing exported design** in this folder: tokens, awning stripe, type,
header/footer, cards and request flow. The illustrations are original SVGs (`scripts/make-category-illustrations.py`).

To run it once credits are added: fork `https://www.magicpatterns.com/c/nl7azuhaqeazotvxqdbyka` with this prompt,
then compare against the local previews. Only adopt changes that keep `docs/PROJECT_BRIEF.md` rules.

## Exact prompt (as sent)

```
Using THIS existing design as the base (keep its brand exactly: navy ink #0B1B3F, marigold accent #FFC629, red pop #E5352B, red-and-white awning stripe, Bricolage Grotesque display + Inter body, same SiteHeader, SiteFooter, navigation and the existing request flow), add ONE reusable "Category rental page" template and render it for five categories via a theme/content config object — not five copied pages. Add routes /categories/ferris-wheels, /categories/carousels, /categories/swing-rides, /categories/thrill-rides, /categories/kiddie-rides.

Page structure (same order for every category):
1. Breadcrumbs (Home › Rides › Category).
2. Category hero: clear rental-intent H1 (e.g. "Ferris wheel rentals", "Carousel & merry-go-round rentals"), 1–2 sentence intro, one large illustrative image area, primary CTA "Start an event request" plus a secondary "See rides" anchor.
3. Photo-led listing cards early on the page (3-up desktop, 1-up mobile): image with meaningful alt, listing name, short factual description, up to two spec rows ONLY if provided, price line that shows a "Planning estimate $X–$Y" with its basis when provided, otherwise "Request pricing", a quiet text line "Sourcing on request", and a "View details" link. NO badges, ratings, favorites, hearts, "instant book" or "popular" labels. Include an empty state: "No listings published in this category yet — send a request and we'll source one."
4. Planning guidance in 5 short cards: venue access, setup space, power, audience, what we need for a quote. Wording must be general guidance (e.g. "Tell us gate widths and the surface") — never numbers for heights, capacities, power or prices.
5. "How sourcing and quotes work" band: request → we contact operators → one written quote → booked only after operator commits and payment step completes.
6. FAQ accordion (4 items) per category.
7. Related categories + popular state links.
8. Final request CTA band.

Per-category personality (accents and motifs only — layout, type and components stay identical):
- Ferris wheels: evening skyline, sense of scale, warm string-light glow; restrained circular/spoke motif; deep navy-to-dusk hero.
- Carousels (copy must naturally say "carousel and merry-go-round rentals"): cream background, burgundy and brass accents, subtle scalloped canopy edge detail, nostalgic feel.
- Swing rides: open sky, airy light-blue composition, curved arc lines suggesting motion.
- Thrill rides: dramatic deep background, energetic diagonal accent, strong high-contrast readable type.
- Kiddie rides: bright, welcoming, playful rounded shapes, very clear planner information.

Constraints: no emoji, no excessive gradients, no flashing or heavy animation, no autoplay video, mobile-first and accessible (contrast AA, 44px tap targets). Do not invent ride specifications, minimum heights, capacities, power requirements, insurance claims, prices, reviews, supplier counts or availability. Imagery is illustrative and must not depict a specific available unit — label hero images "Illustration".
```
