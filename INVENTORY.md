# Inventory — Carnival Rental Master

Compiled 2026-10-04 for verification. Everything below says where it comes from. "Verified" means checked against the
Sharetribe Web Template source or live Sharetribe docs (`reference/sharetribe-negotiation-ground-truth.md`); "claimed"
means a source says so but it has not been checked here.

## 1. Sources

| # | Source | Where | Snapshot | Size |
|---|---|---|---|---|
| A | "Carnival ride rental marketplace" Claude Code session (`session_011NGEMCmhQmoBB7994AR8nG`, started 2026-10-01, last active 2026-10-04) | `sources/session-nice-bohr-wm2cp4/` | branch `claude/nice-bohr-wm2cp4` @ `52a72cb` | 224 files |
| B | "Sharetribe marketplace templates" Claude Code session (this one) — carnival build, **removed from its branch on 2026-10-04** | `sources/session-lucid-goodall-d95lps/` | branch `claude/lucid-goodall-d95lps` @ `cc081e0` (removal commit `2761c0b` came after) | 167 files |
| C | Magic Patterns — two designs | `sources/magic-patterns/README.md` (exports inside A and B) | MP editors `nl7azuhaqeazotvxqdbyka` (A), `epnrxvfjbkqzxxv162nzqs` (B) | — |
| R | Sharetribe ground truth | `reference/` | web-template v12.3.0 `4dd9b8b` + live docs | — |

Both source branches still exist on GitHub with full history; this branch copies their contents unchanged.

## 2. Deliberately NOT in this branch
- **Credentials.** Source A's Sharetribe Integration API / Marketplace API credentials ("CarnivalRental Dev" and
  "CarnivalRental Test") live only in that session's gitignored `.env.local`. They were never committed. A scan of both
  sources found no API keys or secrets.
- **Personal data.** `Carnival_Host_Import.xlsx` (184 companies) is not in either source; only an empty research
  template is. Only two placeholder test emails appear in code.
- **Sharetribe data.** Source A reports 0 listings and 0 users in both marketplaces; nothing was written to Sharetribe.

## 3. Side by side

| Area | A — nice-bohr (newer, larger) | B — lucid-goodall (removed) |
|---|---|---|
| Stack | Next.js 15, Tailwind 4, own app | Next.js 15, Tailwind 3, own app |
| Uses the Sharetribe Web Template? | **No** | **No** |
| Sharetribe connection | Read-only, verified against real "CarnivalRental Dev/Test" marketplaces; contract verifier (MATCH/DRIFT/UNVERIFIED) + snapshots in `contract/` | None (development stub) |
| Event request storage | Local development store (not Sharetribe transactions) | Local SQLite (not Sharetribe transactions) |
| Payment | Demo states; founder decision "pay first" enforced in code (HTTP 402 before sourcing) | None; confirmation disabled until policy approved |
| Internal console | `/internal`, requests, operators | `/internal`, requests, suppliers, supplier quotes/costs |
| Operators | `/operators` early-access page + application form; company-account import (184 eligible, dry run, not executed) | Supplier records entered by hand (researched → contacted → verified) |
| pSEO | State hubs (51), occasions (75), occasion × state (3,825), categories, ride/city previews — all noindex | Ride, category, city, ride + city (demo data) |
| URL scheme | `/[state]/[slug]/[ride]`, `/events/[occasion]`, `/categories/[category]`, `/rides/[ride]` | `/locations/[state]/[city]/[ride]`, `/rides/category/[category]`, `/rides/[ride]` |
| Design | MP design A, ported | MP design B, partly ported (palette, hero, placeholders) |
| Docs | Brief, architecture, **architecture split**, data contract, Sharetribe mapping, payment states, pSEO templates, operator marketplace, company import, mobile app, handoff | Brief, architecture, decisions |
| Tests | 88 unit + 11 e2e (claimed in its handoff) | 22 unit + 33-check e2e (run 2026-10-04, passing) |
| Founder decisions recorded | Seller of record **10000 Solutions LLC**; Sharetribe = system of record; ATM separate from pSEO layer; pay first; estimates not prices; domain candidate `carnivalriderental.us` | none beyond the brief |

**B adds nothing that A lacks**, except a supplier-quote/cost model with versioned quotes and a "projected
contribution" view. B's other features are covered by A.

## 4. Conflicts and problems found (must be resolved before building more)

1. **Neither build uses the Sharetribe Web Template.** Both are separate Next.js apps. Source A's founder decision says
   Sharetribe is the system of record, but which front end runs the transaction ("the ATM") — the template or a custom
   app — is not decided. A custom ATM must reproduce every page in R §3 itself.
2. **No real Sharetribe transaction has ever run** in either build. Requests, quotes and acceptance live in local
   development stores. (A's own evidence table says the same: Test config does not match its contract; no real listings.)
3. **"Pay first" vs. the stock process.** A enforces payment of the estimate before any sourcing. Stock
   `default-negotiation` takes payment only when the customer accepts an offer (R §2). Paying at request time needs a
   **custom process**, plus A's own notes: 7-day authorization limit, all-or-nothing capture, re-authorization when the
   price changes.
4. **Contradiction inside A about operators.** `SHARETRIBE_MAPPING.md` (2026-10-01): operators are **not** Sharetribe
   users. Later docs (2026-10-04: architecture split, company import, operator program, payment states): companies are
   imported into Sharetribe as accounts and identified by Stripe Connect onboarding. Which model is current?
5. **Payout timing in A's `PAYMENT_STATES.md`** describes the calendar-booking rule ("2 days after the booking ends").
   The negotiation process pays out at completion: after delivery is accepted, or automatically 14 days after delivery
   (R §2). Needs correcting if negotiation is used.
6. **Transaction field limits** (R §4): no date field type, 70-character single-line text, no editing after
   submission. Both builds' request forms use date pickers and editable briefs.
7. **Sign-up before requesting a quote** (R §1). Both builds accept requests without an account.
8. **Customer-visible data** (R §5): supplier costs and margins can never sit on a Sharetribe transaction — they need a
   separate back office (B had one; A's console stores operator data locally).
9. **Two URL schemes and two designs** — pick one of each.
10. **B was built before any verification**; its custom statuses (`sourcing`, `supplier_committed`, `confirmed`) don't
    exist in Sharetribe. Keep it for comparison only.

## 5. Verification status

| Claim | Status |
|---|---|
| Negotiation process states, page fields, field types, visibility (R) | **Verified** (template source + live docs) |
| A's read-only connection to "CarnivalRental Dev/Test" | Claimed by A (handoff + snapshots in `contract/snapshots/`) |
| A's Test Console config matches its contract | **No** (A's own report) |
| Any listing, user or transaction created in Sharetribe | **None** |
| A's tests pass (88 unit, 11 e2e) | Claimed; not re-run here |
| B's tests pass (22 unit, 33 e2e) | Ran 2026-10-04; irrelevant now that B is retired |

## 6. Open founder actions (merged from both sessions)
1. Sharetribe Console (Test): apply A's `docs/DATA_CONTRACT.md` §7 — but only after deciding item 4.1 and 4.4 above.
2. Seller account email for 10000 Solutions LLC.
3. Dev Marketplace API client ID + secret.
4. Hosting choice (A recommends a Vercel project + hosted Postgres, password-protected, indexing off).
5. Payment policy: deposit / full / saved card; refunds; events > 75 days out; how "pay first" maps to a custom process.
6. Email + SMS provider; claim-email domain for imported companies.
7. Operator program decisions (A `docs/OPERATOR_MARKETPLACE.md` §6).
8. pSEO copy review (A `docs/PSEO_TEMPLATES.md` §6) and category hub copy.
9. Make `derekbowen/carnivalriderental` private (it is public).
10. Decide whether to delete MP design B and branch `claude/lucid-goodall-d95lps`.

## 7. Suggested order for the independent check
1. Read `reference/sharetribe-negotiation-ground-truth.md`; spot-check it against the template source and Sharetribe docs.
2. Check every item in §4 against the files named.
3. Confirm §2 (no credentials, no personal data) by scanning `sources/`.
4. Decide §4.1, §4.3 and §4.4 — they determine everything else.
