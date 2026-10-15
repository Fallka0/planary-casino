-- The bank: the house's own account.
--
-- Every bet at a house game is paid into it and every win is paid out of it;
-- chips spent in the shop land in it too. Poker is played player against
-- player with no rake, so its pots never pass through. Staff can deposit into
-- it or withdraw from it by hand. It is allowed to go below zero: a win is
-- always paid, and the panel warns instead.
--
-- It keeps its own books rather than being summed from the ledger, because a
-- player reset deletes that player's ledger rows, and what the house won from
-- them stays won.

-- One row per Zurich day and source. source is the game id, 'shop' or 'staff'.
-- For a game, chips_in is bets taken and chips_out winnings paid; for the shop,
-- chips_in is what was spent; for staff, deposits and withdrawals.
CREATE TABLE bank_days (
  day TEXT NOT NULL,
  source TEXT NOT NULL,
  chips_in INTEGER NOT NULL DEFAULT 0,
  chips_out INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, source)
);

-- Staff deposits (positive) and withdrawals (negative), with the reason given.
CREATE TABLE bank_moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  staff_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX bank_moves_time ON bank_moves(created_at);

-- Opening balance: everything the house has won since launch, day by day.
-- Zurich is UTC+2 from the last Sunday of March to the last Sunday of October
-- (both at 01:00 UTC) and UTC+1 otherwise.
INSERT INTO bank_days (day, source, chips_in, chips_out)
SELECT day, source, SUM(chips_in), SUM(chips_out) FROM (
  SELECT
    date(created_at / 1000 + CASE
      WHEN datetime(created_at / 1000, 'unixepoch') >= datetime(strftime('%Y', created_at / 1000, 'unixepoch') || '-03-31', '-6 days', 'weekday 0', '+1 hour')
       AND datetime(created_at / 1000, 'unixepoch') < datetime(strftime('%Y', created_at / 1000, 'unixepoch') || '-10-31', '-6 days', 'weekday 0', '+1 hour')
      THEN 7200 ELSE 3600 END, 'unixepoch') AS day,
    CASE WHEN kind = 'shop' THEN 'shop' ELSE COALESCE(game, 'unknown') END AS source,
    CASE WHEN amount < 0 THEN -amount ELSE 0 END AS chips_in,
    CASE WHEN amount > 0 THEN amount ELSE 0 END AS chips_out
  FROM ledger
  WHERE kind = 'shop' OR (kind = 'game' AND COALESCE(game, '') <> 'poker')
)
GROUP BY day, source;
