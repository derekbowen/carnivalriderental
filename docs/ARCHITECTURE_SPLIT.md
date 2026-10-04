# Architecture split — the ATM and the pSEO layer (founder decision 2026-10-04)

**Decision (founder):**
- **Sharetribe is the backend and the system of record.** Companies, rides and listings live in the Sharetribe Console, imported there.
- The **transaction side ("the ATM")** stays separate and is guarded like Fort Knox.
- The **pSEO layer** is a completely separate deployment on its own server, not connected to the money side.

## The two systems

| | ATM (transactional) | pSEO layer |
|---|---|---|
| Purpose | accounts, listings, requests, payments, transactions | thousands of public landing pages that send traffic to the ATM |
| Backend | Sharetribe (Test → Live) + Stripe via Sharetribe | none of its own |
| Secrets | the only place holding the Integration API secret, Stripe keys and import scripts | **none**: at most the public Marketplace API client ID (read-only, public by design) or a published JSON export |
| Can write data | yes (operators and approved scripts only) | **no**: it cannot create, change or pay for anything |
| Links | its own domain/subdomain | CTAs link out to the ATM's request/checkout URL |
| Hosting | own Vercel project (or Sharetribe-recommended host), own env vars, locked down | own Vercel project / server, separate account access if possible |
| Deploy | protected branch, founder approval, no preview of production secrets | can ship freely; a compromise cannot touch money or user data |

## Proposed mechanics (not yet decided; Claude's recommendation)

1. **Separate repositories, not just branches.** Branches of one repo share CI, collaborators and often env vars, so a branch is not a security boundary. Proposed:
   - `carnivalriderental` (this repo) becomes the ATM;
   - a new repo (e.g. `carnivalriderental-pseo`) holds the pSEO site.
2. **Move the pSEO code out:**
   - taxonomy (`src/lib/taxonomy/`);
   - pSEO routes (`/[state]`, `/events`, `/categories`, city/ride pages);
   - structured data, sitemap and category illustrations.

   It reads listings through the public Marketplace API (client ID only) or a nightly JSON export, never the Integration API.
3. **ATM hardening:**
   - Integration secret and Stripe keys only in the ATM's production env;
   - branch protection and required review;
   - the import scripts are run by an operator, never deployed;
   - no pSEO pages on the ATM domain;
   - Vercel deployment protection on previews.
4. **Data flow is one-way:** Console/Sharetribe → (public read) → pSEO. Nothing flows back except the customer clicking through to the ATM.

## What stays true regardless

- Data goes **into Sharetribe** (Console), not a separate database: company accounts via `npm run import:companies`, and listings via the listing importer (next phase), under the contract in `docs/DATA_CONTRACT.md`.
- Console configuration (`docs/DATA_CONTRACT.md` §7) can only be applied by a human in Console. Our API credentials can read it, not change it.
