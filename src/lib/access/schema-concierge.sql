-- Concierge (chat) + lifecycle events. NOT applied automatically to Postgres: production gets these
-- tables only through the explicit `npm run access:migrate -- --concierge` (docs/CONCIERGE_MVP.md),
-- so merging or deploying code never migrates the live ledger. SQLite (development, tests, e2e)
-- applies it with the main schema. Portable SQL, same conventions as schema.sql.

-- Concierge stores demand, not a mirror of inventory. Tokens are opaque and stored hashed.
CREATE TABLE IF NOT EXISTS concierge_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  details_json TEXT NOT NULL,
  search_type TEXT,
  searched INTEGER NOT NULL DEFAULT 0,
  event_request_id TEXT REFERENCES access_event_requests(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS concierge_requests (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES concierge_sessions(id),
  listing_id TEXT,
  details_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  created_at TEXT NOT NULL
);

-- Lifecycle events (src/lib/lifecycle/events.ts): one row per customer action, from the chat or the
-- web funnel. Identifiers and flags only: never message text, email addresses or contact fields.
-- consent = 1 only on email_capture_accepted when the customer ticked "remind me" (lifecycle
-- follow-ups for chat-originated searches require it).
CREATE TABLE IF NOT EXISTS access_lifecycle_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source TEXT NOT NULL,
  session_id TEXT,
  event_request_id TEXT,
  purchase_id TEXT,
  pass_id TEXT,
  listing_id TEXT,
  consent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS access_lifecycle_events_name ON access_lifecycle_events (name, created_at);
CREATE INDEX IF NOT EXISTS access_lifecycle_events_session ON access_lifecycle_events (session_id);
CREATE INDEX IF NOT EXISTS access_lifecycle_events_request ON access_lifecycle_events (event_request_id);

-- Campaign attribution (src/lib/attribution.ts): the utm tags a search was started with, one row per
-- event request. Campaign tags only (source / medium / campaign): no personal data, no click ids.
CREATE TABLE IF NOT EXISTS access_attribution (
  event_request_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  medium TEXT,
  campaign TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS access_attribution_source ON access_attribution (source, created_at);
