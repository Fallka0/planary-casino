-- Picking your own casino name (name_custom, 0006_custom_name.sql) is free
-- the first time; every name after that costs chips.
--
-- name_changes counts the names a player picked themselves. Renames by staff
-- don't count. Anyone who already picked a name has used their free change.

ALTER TABLE players ADD COLUMN name_changes INTEGER NOT NULL DEFAULT 0;
UPDATE players SET name_changes = 1 WHERE name_custom = 1;
