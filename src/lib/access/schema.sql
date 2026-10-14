-- Event Access ledger. Portable SQL: runs unchanged on Postgres (production) and SQLite (local, e2e).
-- Text ids, ISO-8601 text timestamps, integer flags, JSON as text. References Sharetribe ids only;
-- never a copy of listing content. See docs/PAID_ACCESS_ARCHITECTURE.md.

CREATE TABLE IF NOT EXISTS access_products (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  stripe_price_id TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  currency TEXT NOT NULL,
  unlock_limit INTEGER NOT NULL CHECK (unlock_limit > 0),
  validity_days INTEGER NOT NULL CHECK (validity_days > 0),
  minimum_matches INTEGER NOT NULL CHECK (minimum_matches >= 1),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS access_event_requests (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  event_date TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT,
  event_type TEXT,
  ride_type TEXT,
  ride_class TEXT,
  listing_id TEXT,
  attendance INTEGER,
  budget_cents INTEGER,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  -- Anonymised match snapshot (operators, their matching rides, distance). No identity, no contact.
  match_json TEXT NOT NULL,
  matched_operators INTEGER NOT NULL,
  product_id TEXT NOT NULL REFERENCES access_products(id),
  status TEXT NOT NULL CHECK (status IN ('matched', 'insufficient')),
  source_path TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS access_event_requests_email ON access_event_requests (email);

CREATE TABLE IF NOT EXISTS access_purchases (
  id TEXT PRIMARY KEY,
  event_request_id TEXT NOT NULL REFERENCES access_event_requests(id),
  product_id TEXT NOT NULL REFERENCES access_products(id),
  email TEXT NOT NULL,
  -- Terms copied at purchase time so later product changes never alter old purchases.
  unlock_limit INTEGER NOT NULL,
  validity_days INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'refunded', 'partially_refunded', 'disputed')),
  refund_cents INTEGER NOT NULL DEFAULT 0,
  paid_at TEXT,
  refunded_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS access_purchases_email ON access_purchases (email);

CREATE TABLE IF NOT EXISTS access_stripe_events (
  stripe_event_id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  purchase_id TEXT,
  received_at TEXT NOT NULL,
  processed_at TEXT,
  result TEXT
);

CREATE TABLE IF NOT EXISTS access_passes (
  id TEXT PRIMARY KEY,
  purchase_id TEXT NOT NULL UNIQUE REFERENCES access_purchases(id),
  event_request_id TEXT NOT NULL REFERENCES access_event_requests(id),
  email TEXT NOT NULL,
  unlock_limit INTEGER NOT NULL CHECK (unlock_limit > 0),
  unlocked_count INTEGER NOT NULL DEFAULT 0 CHECK (unlocked_count >= 0 AND unlocked_count <= unlock_limit),
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked', 'expired')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  revoked_at TEXT,
  revoke_reason TEXT
);
CREATE INDEX IF NOT EXISTS access_passes_email ON access_passes (email);

CREATE TABLE IF NOT EXISTS access_unlocks (
  id TEXT PRIMARY KEY,
  pass_id TEXT NOT NULL REFERENCES access_passes(id),
  sharetribe_operator_id TEXT NOT NULL,
  first_revealed_at TEXT NOT NULL,
  -- Immutable: exactly the fields shown to the customer at reveal time.
  contact_snapshot TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  reported_dead_at TEXT,
  credit_restored_at TEXT,
  UNIQUE (pass_id, sharetribe_operator_id)
);

CREATE TABLE IF NOT EXISTS access_magic_links (
  token_hash TEXT PRIMARY KEY,
  pass_id TEXT NOT NULL REFERENCES access_passes(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

-- Cache of "does this operator have a usable contact channel" so the pre-payment count doesn't call
-- the Integration API for every candidate on every visit. Flags only; never contact values.
CREATE TABLE IF NOT EXISTS operator_contact_status (
  sharetribe_operator_id TEXT PRIMARY KEY,
  has_phone INTEGER NOT NULL,
  has_email INTEGER NOT NULL,
  has_website INTEGER NOT NULL,
  claimed INTEGER NOT NULL,
  checked_at TEXT NOT NULL
);

-- Zero-match funnel (founder decision 2026-10-14, src/lib/access/fallback.ts). One row per event:
-- zero_exact_match        the exact search couldn't be sold (fewer contactable operators than the minimum)
-- fallback_match_shown    alternatives were offered; detail_json holds the offers (counts and distances only)
-- fallback_match_clicked  the customer picked one; result_event_request_id is the request it created
-- manual_search_requested the customer asked us to search by hand
-- No identity or contact data: offers are anonymous counts, and the customer's details stay on the request.
CREATE TABLE IF NOT EXISTS access_funnel_events (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (name IN ('zero_exact_match', 'fallback_match_shown', 'fallback_match_clicked', 'manual_search_requested')),
  event_request_id TEXT NOT NULL REFERENCES access_event_requests(id),
  result_event_request_id TEXT REFERENCES access_event_requests(id),
  requested_ride_type TEXT,
  requested_ride_class TEXT,
  fallback_kind TEXT,
  fallback_ride_type TEXT,
  radius_miles INTEGER,
  detail_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS access_funnel_events_request ON access_funnel_events (event_request_id);
CREATE INDEX IF NOT EXISTS access_funnel_events_result ON access_funnel_events (result_event_request_id);
CREATE INDEX IF NOT EXISTS access_funnel_events_name ON access_funnel_events (name, created_at);

-- Lifecycle email (founder decision 2026-10-14, src/lib/lifecycle). One row per logical email:
-- dedupe_key makes each one at most once (a 'blocked' or 'failed' row is retried while still due).
-- Holds the customer's own address and which template went out; never operator data.
CREATE TABLE IF NOT EXISTS access_lifecycle_emails (
  id TEXT PRIMARY KEY,
  template TEXT NOT NULL CHECK (template IN ('saved_search', 'search_abandonment_1h', 'search_abandonment_24h', 'checkout_abandonment_1h', 'purchased_no_unlock_2h')),
  dedupe_key TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  event_request_id TEXT REFERENCES access_event_requests(id),
  purchase_id TEXT REFERENCES access_purchases(id),
  pass_id TEXT REFERENCES access_passes(id),
  status TEXT NOT NULL CHECK (status IN ('sending', 'sent', 'blocked', 'suppressed', 'failed')),
  reason TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  subject TEXT,
  personalized INTEGER NOT NULL DEFAULT 0,
  delivered_to TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS access_lifecycle_emails_email ON access_lifecycle_emails (email, updated_at);

-- Unsubscribed addresses (durable; the app's SQLite suppression list is not durable on Vercel).
CREATE TABLE IF NOT EXISTS access_email_suppressions (
  email TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Scheduled jobs: last start per job, so overlapping or too-frequent runs are skipped.
CREATE TABLE IF NOT EXISTS access_job_runs (
  name TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  result TEXT
);
