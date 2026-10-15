-- The shop becomes cases and a market between players, and achievements pay chips.

-- ── Inventory: one row per copy ─────────────────────
--
-- A player could only ever own one of each item, which is all a shop needs.
-- A market needs copies: a case can drop a border you already have, and that
-- second one is something to sell. Each row is now one copy with its own id,
-- and a sale hands the row itself to the buyer.
-- source: shop | achievement | case | market

CREATE TABLE inventory_copies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES players(user_id),
  item_id TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
INSERT INTO inventory_copies (user_id, item_id, source, created_at)
SELECT user_id, item_id, source, created_at FROM inventory ORDER BY created_at;
DROP TABLE inventory;
ALTER TABLE inventory_copies RENAME TO inventory;
CREATE INDEX inventory_owner ON inventory(user_id, item_id);

-- ── Market ──────────────────────────────────────────

-- A copy up for sale. While it is listed it can't be equipped or listed twice.
CREATE TABLE listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inventory_id INTEGER NOT NULL UNIQUE,
  seller_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  price INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX listings_item ON listings(item_id, price);
CREATE INDEX listings_seller ON listings(seller_id);

-- Every completed sale, for price history. fee is the house's cut, paid into the bank.
CREATE TABLE market_sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id TEXT NOT NULL,
  price INTEGER NOT NULL,
  fee INTEGER NOT NULL,
  seller_id TEXT NOT NULL,
  buyer_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX market_sales_item ON market_sales(item_id, created_at);

-- ── Cases ───────────────────────────────────────────

-- One opening, provably fair the same way a table round is: the server seed is
-- drawn and its hash shown before the player picks a client seed and pays. The
-- seed stays here, unread by anyone, until the case is opened.
CREATE TABLE case_openings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  hash TEXT NOT NULL,
  server_seed TEXT NOT NULL,
  client_seed TEXT,
  price INTEGER,
  roll INTEGER,
  item_id TEXT,
  created_at INTEGER NOT NULL,
  opened_at INTEGER
);
CREATE INDEX case_openings_user ON case_openings(user_id, created_at);

-- ── Achievement chips, paid once for what players already had ──
--
-- New unlocks pay as they happen (achievements.ts, GRADE_CHIPS). These are the
-- same amounts by grade: 500, 1'000, 2'500, 5'000.

CREATE TABLE achievement_backpay AS
WITH grade_chips (achievement_id, chips) AS (
  VALUES
    ('first_hand', 500), ('natural', 500), ('double_win', 500), ('split_aces', 1000),
    ('insured', 1000), ('five_card', 1000), ('bj_hands_100', 1000), ('bj_streak_5', 2500),
    ('four_hands', 2500), ('natural_10', 2500), ('bj_hands_1000', 5000), ('pk_first_hand', 500),
    ('pk_showdown', 500), ('pk_allin', 1000), ('pk_hands_100', 1000), ('pk_boat', 1000),
    ('pk_quads', 2500), ('pk_hands_1000', 2500), ('pk_straight_flush', 5000), ('pk_royal', 5000),
    ('first_spin', 500), ('corner_win', 500), ('blanket', 1000), ('straight_up', 1000),
    ('spins_100', 1000), ('zero_hero', 2500), ('deja_vu', 5000), ('grim_open', 500),
    ('grim_warden', 1000), ('grim_plain', 1000), ('grim_ashen', 1000), ('grim_gilded', 2500),
    ('grim_hollow', 2500), ('grim_crimson', 2500), ('grim_leaden', 5000), ('grim_every', 5000),
    ('big_win_1k', 1000), ('balance_25k', 1000), ('bonus_streak_7', 1000), ('rock_bottom', 500),
    ('big_win_10k', 5000), ('balance_100k', 5000), ('weekly_top', 5000), ('first_friend', 500),
    ('first_message', 500), ('generous', 500), ('host', 500), ('company', 1000),
    ('friends_10', 2500), ('patron', 2500), ('new_face', 500), ('dressed_up', 500),
    ('collector', 2500)
)
SELECT a.user_id, a.achievement_id, g.chips
FROM achievements a JOIN grade_chips g ON g.achievement_id = a.achievement_id;

INSERT INTO ledger (user_id, amount, kind, ref, created_at)
SELECT user_id, chips, 'achievement', achievement_id, CAST(strftime('%s', 'now') AS INTEGER) * 1000 FROM achievement_backpay;

UPDATE players SET balance = balance + (SELECT SUM(chips) FROM achievement_backpay b WHERE b.user_id = players.user_id)
WHERE user_id IN (SELECT user_id FROM achievement_backpay);

INSERT INTO notifications (user_id, kind, data, created_at)
SELECT user_id, 'staff',
  json_object('text', 'Achievements pay chips now. You got ' || replace(printf('%,d', SUM(chips)), ',', '''') || ' chips for the ' || COUNT(*) || ' you already had.'),
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM achievement_backpay GROUP BY user_id;

DROP TABLE achievement_backpay;
