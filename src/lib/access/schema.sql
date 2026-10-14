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
