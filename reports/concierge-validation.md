# Concierge and customer chat validation

- TypeScript check passed.
- Unit tests: 276 passed, 2 pre-existing skips, 26 test files.
- Customer chat widget + concierge browser flows: 4 passed (site-wide widget open/send/close and anonymous contact refusal; anonymous search/contact refusal/request persistence; $99 standard and $199 Ferris checkout, same conversation, authorized unlock and exhausted balance).
- Existing Event Access/pricing browser flows: 12 passed in the focused regression run.
- AI Gateway extraction: fictional county-fair input correctly extracted date, Perris/CA, attendance and Ferris requirement.
- AI Gateway customer-service check: model answered the $199 question and explicitly refused to guarantee June 12 availability.
- Next.js production builds succeeded for the customer-chat application.
- Inventory validation and pSEO report/duplicate checks passed, no indexing policy changed.

Browser checks run locally with fictional operators, fake Stripe and SQLite. Screenshots are fixture evidence, not production-service smoke tests. Browser installation was recovered using registry-distributed headless Chromium and bundled fonts because Ubuntu system-library downloads were unavailable. No production purchases or operator outreach were performed.

Live Sharetribe verification, retired request-desk listing lookup, Supabase connection and production migration remain unverified due to sandbox egress restrictions. The retired desk is unused by current application routes. Secret rotation remains an owner action.

Existing dependency audit reports 2 moderate, 1 high and 2 critical vulnerabilities (Next.js/PostCSS and Vitest-related packages). This feature does not attempt a framework/test-runner upgrade; review separately before production launch.
