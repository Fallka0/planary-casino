-- Everyone claims their achievements by hand, the ones they already had too.
--
-- Those were paid out when they unlocked (or by the backpay in 0007), so the
-- chips are set aside now and come back as each one is claimed. A balance
-- can't go below zero, so a player who has spent some of them gives up only
-- what they hold, and claiming returns exactly that: it nets to zero for
-- everyone. What each achievement returns is decided here, oldest first, and
-- kept in claim_chips; NULL means the full amount for its grade, as for
-- anything unlocked from now on. Reward cosmetics stay where they are.

ALTER TABLE achievements ADD COLUMN claim_chips INTEGER;

CREATE TABLE achievement_reclaim AS
WITH grade_chips (achievement_id, chips) AS (
  VALUES
    ('first_hand', 500), ('natural', 500), ('double_win', 500), ('split_aces', 1000),
    ('insured', 1000), ('five_card', 1000), ('bj_hands_100', 1000), ('bj_streak_5', 2500),
    ('four_hands', 2500), ('natural_10', 2500), ('bj_hands_1000', 5000), ('bj_goat', 5000),
    ('pk_first_hand', 500), ('pk_showdown', 500), ('pk_allin', 1000), ('pk_hands_100', 1000),
    ('pk_boat', 1000), ('pk_quads', 2500), ('pk_hands_1000', 2500), ('pk_straight_flush', 5000),
    ('pk_royal', 5000), ('first_spin', 500), ('corner_win', 500), ('blanket', 1000),
    ('straight_up', 1000), ('spins_100', 1000), ('zero_hero', 2500), ('deja_vu', 5000),
    ('grim_open', 500), ('grim_warden', 1000), ('grim_plain', 1000), ('grim_ashen', 1000),
    ('grim_gilded', 2500), ('grim_hollow', 2500), ('grim_crimson', 2500), ('grim_leaden', 5000),
    ('grim_every', 5000), ('big_win_1k', 1000), ('balance_25k', 1000), ('bonus_streak_7', 1000),
    ('rock_bottom', 500), ('big_win_10k', 5000), ('balance_100k', 5000), ('weekly_top', 5000),
    ('first_friend', 500), ('first_message', 500), ('generous', 500), ('host', 500),
    ('company', 1000), ('friends_10', 2500), ('patron', 2500), ('new_face', 500),
    ('dressed_up', 500), ('collector', 2500)
),
held AS (
  SELECT a.user_id, a.achievement_id, g.chips,
         SUM(g.chips) OVER (PARTITION BY a.user_id ORDER BY a.unlocked_at, a.achievement_id ROWS UNBOUNDED PRECEDING) AS upto
  FROM achievements a JOIN grade_chips g ON g.achievement_id = a.achievement_id
  -- Only what was paid: one unlocked since claiming began is still waiting, unpaid.
  WHERE a.claimed_at IS NOT NULL
),
owed AS (SELECT user_id, SUM(chips) AS chips, COUNT(*) AS n FROM held GROUP BY user_id)
SELECT h.user_id, h.achievement_id,
       MAX(0, MIN(h.chips, MIN(p.balance, o.chips) - (h.upto - h.chips))) AS back,
       MIN(p.balance, o.chips) AS taken,
       o.n AS n
FROM held h JOIN owed o ON o.user_id = h.user_id JOIN players p ON p.user_id = h.user_id;

INSERT INTO ledger (user_id, amount, kind, ref, created_at)
SELECT user_id, -MAX(taken), 'achievement', 'set-aside', CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM achievement_reclaim GROUP BY user_id HAVING MAX(taken) > 0;

UPDATE players SET balance = balance - (SELECT MAX(taken) FROM achievement_reclaim r WHERE r.user_id = players.user_id)
WHERE user_id IN (SELECT user_id FROM achievement_reclaim);

UPDATE achievements SET
  claimed_at = NULL,
  claim_chips = (SELECT back FROM achievement_reclaim r WHERE r.user_id = achievements.user_id AND r.achievement_id = achievements.achievement_id)
WHERE EXISTS (SELECT 1 FROM achievement_reclaim r WHERE r.user_id = achievements.user_id AND r.achievement_id = achievements.achievement_id);

INSERT INTO notifications (user_id, kind, data, created_at)
SELECT user_id, 'staff',
  json_object('text', 'Achievements are claimed by hand now, including the ' || MAX(n) || ' you already have. ' ||
    CASE WHEN MAX(taken) > 0 THEN 'Their ' || replace(printf('%,d', MAX(taken)), ',', '''') || ' chips are set aside until you claim them in Achievements.'
         ELSE 'Claim them in Achievements.' END),
  CAST(strftime('%s', 'now') AS INTEGER) * 1000
FROM achievement_reclaim GROUP BY user_id;

DROP TABLE achievement_reclaim;
