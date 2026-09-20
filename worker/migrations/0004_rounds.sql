-- The game round archive.
--
-- Until now the casino remembered money and counters, but not play: the ledger
-- knows a player lost 200 chips at roulette, and nothing anywhere knows which
-- pocket the ball fell into. Every regulator that licenses a real operator
-- (ESBK here, MGA, UKGC) asks for the same thing — each round uniquely
-- identified, stored unaltered, and reconstructable in full. This is that
-- record, and it doubles as the data every later feature wants: a player's
-- history, a replay, an honest leaderboard, a support case.
--
-- Two ideas:
--
--   commitments  what the table promised before it knew the outcome, and the
--                seed it published afterwards to prove it kept the promise.
--                Roulette commits per spin; blackjack per shoe, so one
--                commitment covers every hand dealt out of it.
--
--   rounds       one row per round, with a JSON log complete enough to replay
--                the round without consulting anything else.

CREATE TABLE commitments (
  id TEXT PRIMARY KEY,
  game TEXT NOT NULL,
  table_id TEXT NOT NULL,
  -- 'spin' for a single outcome, 'shoe' for a shuffle many rounds are dealt from.
  kind TEXT NOT NULL,
  -- SHA-256 of the server seed, published before betting opened.
  hash TEXT NOT NULL,
  -- Player contributions, joined in the order the table accepted them.
  client_seed TEXT NOT NULL,
  nonce INTEGER NOT NULL,
  -- NULL while sealed. Set exactly once, when the round or shoe is finished.
  server_seed TEXT,
  opened_at INTEGER NOT NULL,
  revealed_at INTEGER
);

CREATE INDEX commitments_table ON commitments(table_id, opened_at);

CREATE TABLE rounds (
  id TEXT PRIMARY KEY,
  commitment_id TEXT NOT NULL,
  game TEXT NOT NULL,
  table_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  -- One line a human can read without opening the log: "17 black", "dealer 20".
  outcome TEXT NOT NULL,
  -- Everything needed to replay the round, as JSON.
  log TEXT NOT NULL,
  staked INTEGER NOT NULL DEFAULT 0,
  returned INTEGER NOT NULL DEFAULT 0,
  seats INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX rounds_game_time ON rounds(game, started_at);
CREATE INDEX rounds_table_time ON rounds(table_id, started_at);
CREATE INDEX rounds_commitment ON rounds(commitment_id);

CREATE TABLE round_players (
  round_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  seat INTEGER NOT NULL DEFAULT 0,
  staked INTEGER NOT NULL DEFAULT 0,
  returned INTEGER NOT NULL DEFAULT 0,
  -- This player's side of the round: their bets, their hands, their result.
  detail TEXT NOT NULL,
  PRIMARY KEY (round_id, user_id, seat)
);

CREATE INDEX round_players_user ON round_players(user_id, round_id);

-- A round record that can be edited is not a record. Rows are written once,
-- complete; retention is a matter of deleting old ones, never of rewriting
-- them. Deletes stay possible so a retention job can prune.
CREATE TRIGGER rounds_are_written_once
BEFORE UPDATE ON rounds
BEGIN
  SELECT RAISE(ABORT, 'game round records cannot be altered');
END;

CREATE TRIGGER round_players_are_written_once
BEFORE UPDATE ON round_players
BEGIN
  SELECT RAISE(ABORT, 'game round records cannot be altered');
END;

-- A commitment has exactly two legitimate changes after it is filed, in order:
--
--   1. the client seeds are written, once, when betting closes
--   2. the server seed is revealed, once, when the round or shoe is finished
--
-- The hash and the nonce are fixed the moment the row exists and never move;
-- nothing at all may change after the reveal. The database enforces this
-- rather than trusting the code above it, because the code above it is
-- exactly what a record like this exists to keep honest.
CREATE TRIGGER commitments_change_in_order
BEFORE UPDATE ON commitments
WHEN OLD.server_seed IS NOT NULL
  OR NEW.hash <> OLD.hash
  OR NEW.nonce <> OLD.nonce
  OR NEW.opened_at <> OLD.opened_at
  OR (OLD.client_seed <> '' AND NEW.client_seed <> OLD.client_seed)
BEGIN
  SELECT RAISE(ABORT, 'a commitment is sealed, then opened, and only once each');
END;
