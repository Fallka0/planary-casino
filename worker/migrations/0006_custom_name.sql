-- Players can pick their own casino name. Until they do, the name follows
-- their Planary account on every sign-in; once name_custom is set, that sync
-- leaves it alone. Clearing it hands the name back to the account.

ALTER TABLE players ADD COLUMN name_custom INTEGER NOT NULL DEFAULT 0;
