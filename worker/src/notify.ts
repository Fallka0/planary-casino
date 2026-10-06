import type { Env } from "./env";

export type NotificationKind = "friend_request" | "friend_accepted" | "chips_received" | "table_invite" | "achievement" | "announcement" | "staff";

export async function notify(env: Env, userId: string, kind: NotificationKind, actorId: string | null, data: unknown = null) {
  await env.DB.prepare("INSERT INTO notifications (user_id, kind, actor_id, data, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(userId, kind, actorId, data === null ? null : JSON.stringify(data), Date.now())
    .run();
}

/**
 * A friend request has been answered: retire the prompt in both players'
 * panels. Either side can end a pending request — the sender cancels, the
 * recipient accepts or declines — so the actor can sit on either end of the
 * pair.
 */
export async function resolveFriendRequests(env: Env, a: string, b: string) {
  try {
    await env.DB.prepare(
      `UPDATE notifications SET resolved_at = ?1
       WHERE kind = 'friend_request' AND resolved_at IS NULL
         AND ((user_id = ?2 AND actor_id = ?3) OR (user_id = ?3 AND actor_id = ?2))`,
    )
      .bind(Date.now(), a, b)
      .run();
  } catch (error) {
    // Tidying the panel must never stop a friendship being accepted.
    console.error("friend request not marked answered — run the migrations", error);
  }
}
