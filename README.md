# Book a Carnival (working name) — development

A managed national carnival ride rental marketplace. Customers request rides through **us**; **we** quote, manage the transaction and source fulfilment from carnival operators. See [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md).

> **Development only.** Not public, not indexed. Demo data. Payments are a demo adapter — no card details are collected and no money moves. Sharetribe is connected **read-only** (Dev marketplace); transactions are not yet routed through it.

## Run it

Requires Node ≥ 22.13 (uses the built-in `node:sqlite`).

```bash
npm install
npm run setup          # creates .env.local with generated dev secrets (never committed)
npm run db:seed-demo   # optional: fictional demo suppliers for the internal console
npm run dev            # http://localhost:3000
```

- Customer site: `/`, `/rides`, `/rides/ferris-wheel-rental`, `/request`
- Customer status page: the link shown after submitting (`/requests/BAC-XXXXXX?t=…`)
- Internal console: `/internal` — HTTP Basic auth with `INTERNAL_USER` / `INTERNAL_PASSWORD` from `.env.local`
- Gate report: `npm run content:check`

## Tests

```bash
npm run typecheck
npm test               # unit/domain tests (vitest)
npm run build
npm run test:e2e       # Playwright against the production build, isolated DB (data/e2e.sqlite)
```

Playwright uses the preinstalled Chromium at `/opt/pw-browsers/chromium` (override with `CHROMIUM_PATH`).

## What works (session one)

| Area | Status |
|---|---|
| Homepage, browse, ride detail, category, city, ride + city pages | Working, server-rendered/SSG from structured content |
| Multi-step event request with "Not sure" options, review, acknowledgement | Working |
| Persistence, idempotent submit, success only after commit | Working (SQLite dev store) |
| Customer status page (fulfilment + payment tracks, quotes, accept quote) | Working (capability link) |
| Internal console: queue, brief, supplier candidates, supplier cost quotes, versioned customer quotes, commit supplier, demo payment states, confirm booking, margin projection, history | Working |
| Canonicals, noindex, robots, sitemap gates | Working; sitemap intentionally empty |
| Sharetribe | **Read-only connected** to "CarnivalRental Dev" (`npm run sharetribe:check`). No writes; transactions still use the dev store. Mapping in `docs/SHARETRIBE_MAPPING.md` |
| Payments (Stripe) | **Not connected** — demo state adapter only |
| Email / notifications | Not implemented |

## Docs

- [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md) — business model, entities, rules
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — layers, sources of truth, guarantees
- [`docs/SHARETRIBE_MAPPING.md`](docs/SHARETRIBE_MAPPING.md) — verified Sharetribe facts, recommended mapping, payment options, decisions needed
- [`docs/HANDOFF.md`](docs/HANDOFF.md) — session log, open decisions, next milestone
