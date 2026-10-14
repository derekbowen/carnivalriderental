# Concierge and customer chat validation

Reconciled with `main` at `9aec442` (fallback offers, lifecycle email, 10-minute cron) on 2026-10-14. The full pre-push sequence from `CLAUDE.md` ran in order on the final code and exited 0:

| Check | Result |
| --- | --- |
| `npm run typecheck` | passed |
| `npm test` | 324 passed, 30 files |
| `npm run build` | passed (concierge off: `/concierge` and `/api/concierge` built as dynamic routes; the widget is absent from prerendered pages) |
| `npm run inventory:validate` | passed: snapshot is safe to render |
| `npm run pseo:report` / `npm run pseo:duplicates` | passed; no indexing policy changed |
| `npm run test:e2e` | 51 passed |

What the new and updated tests cover:

- **One lifecycle system** (`tests/concierge-lifecycle.test.ts`): all nine hooks recorded with identifiers only. Chat "Email me these options" sends `saved_search` once however often it is pressed, and the web button can't send a second. No consent means no reminders. With consent there is at most the 1 h and next-day reminder. Unticking withdraws consent. Typing an email is never consent. A chat purchase stops sales email and sends `purchased_no_unlock_2h` once. An abandoned chat checkout gets one checkout reminder. Chat and web searches by the same address share one sales email per 20 h. A newer unconsented chat search is never chased through an older web one. Without the campaign approval and postal address (production today), consented reminders stay blocked.
- **Merging enables nothing**: the concierge is off unless `CONCIERGE_ENABLED=true` (404). The runtime Postgres schema creates no concierge or lifecycle-event tables, and the opt-in migration is called only from `access:migrate -- --concierge`. There are no follow-up tables, jobs, scripts or extra cron entries. A missing lifecycle-events table never breaks checkout.
- **Model boundary** (`tests/concierge-model-privacy.test.ts`): every AI call is captured in a paid flow with unlocked contacts. That covers the chat extraction, the chat answer and the lifecycle personalizer. No call contains operator contacts, the customer's email, name or phone, Sharetribe credentials or the session secret. No call gets tools, and every call uses an `anthropic/claude-*` model. A model reply claiming it unlocked contacts unlocks nothing. The unlock action refuses without the pass cookie before any contact read.
- **Browser** (`e2e/concierge.spec.ts`, `e2e/chat-widget.spec.ts`): anonymous search, contact refusal and the email capture (no provider in e2e, so it reports it couldn't send). Unconfirmed availability, durable requests, and $99 standard and $199 Ferris wheel checkout in the same conversation, through authorized unlocks to an exhausted balance. Widget open, send, refusal and close.

Browser checks run locally with fictional operators, fake Stripe, SQLite and no AI Gateway credentials. Screenshots are fixture evidence, not production smoke tests. No production purchases, migrations, environment changes or operator outreach were performed.

Live Sharetribe verification, Supabase connection and the production concierge migration remain unverified from this sandbox. Secret rotation remains an owner action.
