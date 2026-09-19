import type { Env } from "./env";

export type NotificationKind = "friend_request" | "friend_accepted" | "chips_received" | "table_invite" | "achievement" | "announcement" | "staff";

export async function notify(env: Env, userId: string, kind: NotificationKind, actorId: string | null, data: unknown = null) {
  await env.DB.prepare("INSERT INTO notifications (user_id, kind, actor_id, data, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(userId, kind, actorId, data === null ? null : JSON.stringify(data), Date.now())
    .run();
}
