-- Operator tools: staff and roles, audit log, player restrictions, casino settings.

-- role: owner | manager | support | viewer
CREATE TABLE staff (
  user_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  added_by TEXT,
  created_at INTEGER NOT NULL
);

-- Every staff action, append-only.
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  details TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX audit_time ON audit_log(created_at);
CREATE INDEX audit_target ON audit_log(target_id, created_at);

-- Account status. suspended with an end date, or banned for good.
ALTER TABLE players ADD COLUMN status TEXT NOT NULL DEFAULT 'active'; -- active | suspended | banned
ALTER TABLE players ADD COLUMN status_until INTEGER;
ALTER TABLE players ADD COLUMN status_reason TEXT;
-- No table chat or direct messages until then.
ALTER TABLE players ADD COLUMN muted_until INTEGER;
-- Responsible play: most chips a player can lose per Zurich day, and a break from play.
ALTER TABLE players ADD COLUMN loss_limit INTEGER;
ALTER TABLE players ADD COLUMN excluded_until INTEGER;

CREATE TABLE staff_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX staff_notes_user ON staff_notes(user_id, created_at);

-- Casino-wide settings (starter chips, daily bonus, …), JSON values.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Per game: open or closed for maintenance.
CREATE TABLE game_settings (
  game TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'open', -- open | maintenance
  note TEXT,
  updated_at INTEGER NOT NULL
);

-- Shop changes on top of the catalog in code: price or availability.
CREATE TABLE shop_overrides (
  item_id TEXT PRIMARY KEY,
  price INTEGER,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER NOT NULL
);

CREATE INDEX ledger_game_time ON ledger(game, created_at);
