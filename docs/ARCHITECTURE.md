# Architecture (session one)

```
Browser ──► Next.js 15 app (this repo, Node runtime)
              │
              ├─ Public SEO pages (SSG + ISR, revalidate 1h)  ◄── content layer (src/lib/content)
              │     /rides, /rides/{ride}, /rides/{ride}/{state}/{city},
              │     /categories/{category}, /locations/{state}/{city}
              │
              ├─ Event request flow  /request  ──POST /api/requests──┐
              ├─ Customer status     /requests/{ref}?t=token          │
              │                                                       ▼
              ├─ Internal console    /internal/** (Basic auth) ──► RequestService ──► SQLite (node:sqlite)
              │                                                    (rules, state machines)   data/dev.sqlite
              └─ middleware: internal auth · optional site password · X-Robots-Tag noindex
```

One app, one process, one dev database. No queues, microservices or paid services.

## Layers

| Layer | Files | Notes |
|---|---|---|
| Config | `src/lib/config.ts` | Env-driven; conservative defaults (noindex, demo payments). |
| Content (catalogue) | `src/lib/content/**` | Typed fixtures. `demo/` vs `published/` are separate files; integrity checks run at load and fail the build. |
| SEO | `src/lib/seo/routes.ts`, `publication.ts`, `metadata.ts` | Single canonical route builder; publication gates decide index + sitemap. |
| Requests domain | `src/lib/requests/**` | Types, zod schema, state machines, service (all business rules), public projection, margin maths, HTTP mapping. |
| Integrations | `src/lib/integrations/status.ts` | Honest status only. Sharetribe and payments are **development adapters**. |
| UI | `src/app/**`, `src/components/**` | Server components by default; client components only for the form and action buttons. |

## Sources of truth

| Data | Now | Planned |
|---|---|---|
| Ride offerings / categories / locations | Repo fixtures | Sharetribe listings (owned by our seller account) synced into a cached content store; editorial/local content stays in our store. |
| Event requests, quotes, statuses | SQLite dev store | Our Postgres (customer brief, fulfilment) + Sharetribe transaction (customer quote/payment) linked by ID. |
| Suppliers, units, supplier quotes, costs | SQLite dev store | Our Postgres. **Never** in Sharetribe public/protected data. |
| Payments | Demo adapter (manual state) | Sharetribe + Stripe per approved policy (see SHARETRIBE_MAPPING.md). |

## Key guarantees and where they are enforced

| Guarantee | Enforcement | Test |
|---|---|---|
| Success only after a committed write | `handleCreateRequest` returns 201/200 + `persisted:true` after the SQLite transaction commits; the client (`interpretCreateResponse`) requires that, then navigates to a page that re-reads the DB | `tests/requests.test.ts`, `e2e` "failed persistence" |
| No duplicates on repeat submit | Client idempotency key (sessionStorage) + `UNIQUE(idempotency_key)`; payload hash mismatch → 409 | unit + e2e double-click |
| Customers can't see supplier data/margins | `toPublicView` whitelist; status page renders only that; token-bound capability links | unit + e2e |
| Unconfirmed supply never shown as confirmed | Separate fulfilment/payment state machines; `confirmBooking` requires accepted quote + committed **verified** supplier + required payment state; protected states unreachable by direct transition | unit + e2e full flow |
| Demo data can't be published | Integrity checks (demo flags, no verified claims, no placeholders/demo estimates in publishable set); production never loads demo fixtures; gates require `recordStatus=published` | `tests/content-seo.test.ts` |
| Consistent canonicals | All paths from `paths.*`; `canonicalUrl` rejects query/trailing slash | unit + e2e |
| Non-public environments | `X-Robots-Tag: noindex` on every response unless `APP_ENV=production && PUBLIC_INDEXING=true`; robots.txt disallow; meta robots noindex; optional `SITE_ACCESS_PASSWORD` | e2e |
| No raw card data | No card fields exist; demo adapter records states only | by construction |

## Rendering and caching for pSEO

- SEO pages are statically generated from the content layer (`generateStaticParams`, `dynamicParams = false`, `revalidate = 3600`). No Sharetribe or AI calls per page view.
- Canonical origin is `SITE_URL` **at build time** for static pages.
- Future sync: a scheduled job (Integration API `listings/query`, rate-limited) writes a snapshot into the content store and triggers revalidation — bounded and cached.

## Known limitations

- `node:sqlite` is experimental in Node 22 (prints a warning). Fine for development; production should move to Postgres behind the same `RequestService` API.
- Internal auth is a single shared Basic-auth credential. Replace with staff accounts/SSO before any shared deployment.
- Customer status links are bearer capability URLs (HMAC of request id). Anyone with the link can view and accept a quote. Customer accounts arrive with Sharetribe.
- No rate limiting or bot protection on `/api/requests` yet.
- No email/SMS notifications (deliberately — no outreach in session one).
