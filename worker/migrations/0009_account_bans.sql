-- Set when staff ban the whole Planary account (planary-auth), not just the casino.
-- There's no undo for that here, so the casino status can't be lifted either.
ALTER TABLE players ADD COLUMN account_banned_at INTEGER;
