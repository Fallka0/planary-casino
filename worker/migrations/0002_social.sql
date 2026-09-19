-- Planary Casino social layer: profiles, cosmetics, messages, notifications, achievements.

-- Profile. Equipped cosmetics are catalog item ids (see src/catalog.ts); null = the free default.
ALTER TABLE players ADD COLUMN bio TEXT;
ALTER TABLE players ADD COLUMN avatar_version INTEGER NOT NULL DEFAULT 0; -- 0 = no picture
ALTER TABLE players ADD COLUMN border TEXT;
ALTER TABLE players ADD COLUMN banner TEXT;
ALTER TABLE players ADD COLUMN title TEXT;
ALTER TABLE players ADD COLUMN cardback TEXT;
ALTER TABLE players ADD COLUMN chipset TEXT;
-- JSON array of up to three achievement ids pinned to the profile.
ALTER TABLE players ADD COLUMN showcase TEXT;
-- Consecutive Zurich days with a claimed daily bonus.
ALTER TABLE players ADD COLUMN bonus_streak INTEGER NOT NULL DEFAULT 0;

-- Profile pictures, resized in the browser to 256 × 256 before upload.
CREATE TABLE avatars (
  user_id TEXT PRIMARY KEY REFERENCES players(user_id),
  data BLOB NOT NULL,
  mime TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Shop purchases (and cosmetics granted by achievements).
CREATE TABLE inventory (
  user_id TEXT NOT NULL REFERENCES players(user_id),
  item_id TEXT NOT NULL,
  source TEXT NOT NULL, -- shop | achievement
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, item_id)
);

-- Direct messages between friends.
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at INTEGER
);
CREATE INDEX messages_sender ON messages(sender_id, recipient_id, id);
CREATE INDEX messages_recipient ON messages(recipient_id, read_at);

-- kind: friend_request | friend_accepted | chips_received | table_invite | achievement
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  actor_id TEXT,
  data TEXT,
  created_at INTEGER NOT NULL,
  read_at INTEGER
);
CREATE INDEX notifications_user ON notifications(user_id, id);

CREATE TABLE achievements (
  user_id TEXT NOT NULL REFERENCES players(user_id),
  achievement_id TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, achievement_id)
);
CREATE INDEX achievements_id ON achievements(achievement_id);

-- Counters behind achievement progress (hands played, naturals, …).
CREATE TABLE stats (
  user_id TEXT NOT NULL,
  key TEXT NOT NULL,
  value INTEGER NOT NULL,
  PRIMARY KEY (user_id, key)
);

-- Weeks already crowned by the weekly job, so a winner is only awarded once.
CREATE TABLE weekly_awards (
  week_start INTEGER PRIMARY KEY,
  user_id TEXT,
  created_at INTEGER NOT NULL
);
