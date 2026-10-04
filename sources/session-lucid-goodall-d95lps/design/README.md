# Magic Patterns design (reference only)

`magic-patterns/` is the exported source of the initial product design:
https://www.magicpatterns.com/c/epnrxvfjbkqzxxv162nzqs (artifact `8e206bc1-9257-4928-bec3-1a5ee83aa395`).

It is **not part of the app build** (excluded in `tsconfig.json`, Tailwind and Vitest) and is not a runtime
dependency. The app took from it: the colour palette and typefaces (`tailwind.config.ts`, `src/app/layout.tsx`),
the hero layout (`src/app/page.tsx`), and `RideGlyph` / `PlaceholderImage` (`src/components/design/`).

Its demo data (`data/*.ts`) is design filler — it may include invented prices, specs or names and must never be
copied into `src/data/production/`.

Screenshots of the five designed screens (A homepage, B browse, C ride detail, D request + status, E internal queue + detail) are in `screenshots/`.
