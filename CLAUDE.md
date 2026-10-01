# Instructions for future sessions

Read `docs/PROJECT_BRIEF.md` first. It is the business model; do not drift from it.

- This is a **managed marketplace with operator procurement**. We sell to the customer; operators are our fulfilment suppliers. Do **not** make "List your ride", provider onboarding or operator Stripe enrolment a launch dependency.
- This repo is separate from Pool Rental Near Me. Never touch PRNM code, infrastructure, its Sharetribe marketplace, or any other business.
- Keep fulfilment status and payment status separate. Never show "booked/confirmed" unless `confirmBooking` succeeded.
- Never invent specs, capacities, reviews, supplier counts, insurance or certification claims. Unknown stays unknown (`null`).
- Demo fixtures live only in `src/lib/content/demo/`; publishable records only in `src/lib/content/published/`. Don't weaken `integrity.ts` or `publication.ts` gates to make something indexable.
- Build every URL with `paths.*` in `src/lib/seo/routes.ts`.
- Payments: test/demo mode only until the founder approves a payment policy (see `docs/SHARETRIBE_MAPPING.md`). Never collect card data in our own fields.
- No real charges, operator/customer outreach, mass imports, production publishing or public indexing without explicit approval.
- Secrets live in `.env.local` (gitignored). Never commit or log them.

Checks before pushing: `npm run typecheck && npm test && npm run build && npm run test:e2e`.
