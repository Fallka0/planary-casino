-- A friend request is a prompt, not just news: once it is accepted or declined
-- the notification stays as a record, but its buttons have nothing left to do.
-- resolved_at marks that moment, so the panel stops offering an action that
-- would only come back 404.

ALTER TABLE notifications ADD COLUMN resolved_at INTEGER;

-- Requests already handled before this column existed: the friendship is no
-- longer pending, so their buttons are dead. Retire them.
UPDATE notifications SET resolved_at = created_at
WHERE kind = 'friend_request' AND resolved_at IS NULL AND NOT EXISTS (
  SELECT 1 FROM friendships f
  WHERE f.status = 'pending'
    AND f.requested_by = notifications.actor_id
    AND f.user_low = min(notifications.user_id, notifications.actor_id)
    AND f.user_high = max(notifications.user_id, notifications.actor_id)
);
