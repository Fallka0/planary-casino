-- Achievements still unlock on their own, at the table or wherever they're
-- earned. Their chips and any reward cosmetic now wait in the Achievements tab
-- until the player claims them; claimed_at is that moment, NULL while waiting.

ALTER TABLE achievements ADD COLUMN claimed_at INTEGER;

-- Everything unlocked so far was paid as it happened, or by the backpay in
-- 0007, so it all counts as claimed.
UPDATE achievements SET claimed_at = unlocked_at;
