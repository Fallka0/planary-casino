-- Planary Casino: one chip wallet per Planary account, friends and presence.

CREATE TABLE players (
  user_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_lower TEXT NOT NULL,
  balance INTEGER NOT NULL CHECK (balance >= 0),
  -- Europe/Zurich calendar day of the last claimed daily bonus (YYYY-MM-DD).
  bonus_day TEXT,
  presence_where TEXT,
  presence_table TEXT,
  last_seen INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX players_name ON players(name_lower);

-- Every chip movement. Balance changes and ledger rows are written in one batch.
-- kind: starter | bonus | game | transfer_in | transfer_out
CREATE TABLE ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES players(user_id),
  amount INTEGER NOT NULL,
  kind TEXT NOT NULL,
  game TEXT,
  ref TEXT,
  counterparty TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX ledger_user_time ON ledger(user_id, created_at);
CREATE INDEX ledger_kind_time ON ledger(kind, created_at);

-- One row per pair; user_low < user_high. status: pending | accepted
CREATE TABLE friendships (
  user_low TEXT NOT NULL,
  user_high TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_low, user_high)
);
CREATE INDEX friendships_high ON friendships(user_high);
