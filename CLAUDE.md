# Instructions for future sessions

Read `docs/PROJECT_BRIEF.md` first. It is the business model; do not drift from it.

- This is a **managed marketplace with operator procurement**. We sell to the customer; operators are our fulfilment suppliers. Do **not** make "List your ride", provider onboarding or operator Stripe enrolment a launch dependency.
- The operator program (`/operators`, `docs/OPERATOR_MARKETPLACE.md`) is a founder-approved second track: early access only. Its page must never claim a feature that isn't live or a fee that isn't decided; numbers come from `src/lib/operators/program.ts`.
- This repo is separate from Pool Rental Near Me. Never touch PRNM code, infrastructure, its Sharetribe marketplace, or any other business.
- PAY FIRST: no sourcing, operator contact or customer quote before payment (`OUTREACH_POLICY`). Never weaken it. Prices shown are estimates: use `src/lib/pricing/policy.ts` wording, never "free to request" or a final-price claim.
- Keep fulfilment status and payment status separate. Never show "booked/confirmed" unless `confirmBooking` succeeded.
- Never invent specs, capacities, reviews, supplier counts, insurance or certification claims. Unknown stays unknown (`null`).
- Demo fixtures live only in `src/lib/content/demo/`; publishable records only in `src/lib/content/published/`. Don't weaken `integrity.ts` or `publication.ts` gates to make something indexable.
- Build every URL with `paths.*` in `src/lib/seo/routes.ts`.
- Listing data follows `contract/listing-contract.json` (see `docs/DATA_CONTRACT.md`). Never invent field IDs/options in components; every listing write goes through `validateOfferingRecord` (validate the merged result for updates); every listing READ goes through `src/lib/catalog` (Console edits bypass the write validator). Verify config with `npm run sharetribe:inspect && npm run contract:diff` — UNVERIFIED is never a pass. The `default-negotiation` binding is a temporary Test scaffold, not the approved transaction process. Configuration changes happen in the Sharetribe **Test** environment and are copied to Dev.
- Payments: test/demo mode only until the founder approves a payment policy (see `docs/SHARETRIBE_MAPPING.md`). Never collect card data in our own fields.
- No real charges, operator/customer outreach, mass imports, production publishing or public indexing without explicit approval.
- Company accounts are imported only via `npm run import:companies` (`docs/COMPANY_IMPORT.md`): A+B tiers, unclaimed, claim domain we control, no research notes in Sharetribe, never overwrite or reset an existing account.
- Secrets live in `.env.local` (gitignored). Never commit or log them.

Checks before pushing: `npm run typecheck && npm test && npm run build && npm run test:e2e`.
