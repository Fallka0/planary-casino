import type { Env, Player } from "./env";
import { zurichDay } from "./time";

export const STARTER_CHIPS = 5000;
export const DAILY_BONUS = 500;
export const MIN_TRANSFER = 10;

const now = () => Date.now();

export async function getPlayer(env: Env, userId: string) {
  return env.DB.prepare("SELECT * FROM players WHERE user_id = ?").bind(userId).first<Player>();
}

/** Creates the player on first contact (with starter chips) and keeps the display name in sync. */
export async function ensurePlayer(env: Env, userId: string, name: string): Promise<Player> {
  const t = now();
  const [inserted] = await env.DB.batch([
    env.DB.prepare(
      "INSERT OR IGNORE INTO players (user_id, name, name_lower, balance, last_seen, created_at) VALUES (?1, ?2, ?3, ?4, 0, ?5)",
    ).bind(userId, name, name.toLowerCase(), STARTER_CHIPS, t),
    env.DB.prepare("INSERT INTO ledger (user_id, amount, kind, created_at) SELECT ?1, ?2, 'starter', ?3 WHERE changes() = 1").bind(
      userId,
      STARTER_CHIPS,
      t,
    ),
  ]);
  if (!inserted.meta.changes) {
    await env.DB.prepare("UPDATE players SET name = ?2, name_lower = ?3 WHERE user_id = ?1 AND name <> ?2")
      .bind(userId, name, name.toLowerCase())
      .run();
  }
  return (await getPlayer(env, userId))!;
}

/** Takes chips if the balance covers it. Returns the new balance, or null when it doesn't. */
export async function debit(env: Env, userId: string, amount: number, entry: { kind: string; game?: string; ref?: string }) {
  const [update] = await env.DB.batch([
    env.DB.prepare("UPDATE players SET balance = balance - ?1 WHERE user_id = ?2 AND balance >= ?1").bind(amount, userId),
    env.DB.prepare(
      "INSERT INTO ledger (user_id, amount, kind, game, ref, created_at) SELECT ?1, ?2, ?3, ?4, ?5, ?6 WHERE changes() = 1",
    ).bind(userId, -amount, entry.kind, entry.game ?? null, entry.ref ?? null, now()),
  ]);
  if (!update.meta.changes) return null;
  return (await getPlayer(env, userId))!.balance;
}

export async function credit(env: Env, userId: string, amount: number, entry: { kind: string; game?: string; ref?: string }) {
  if (amount > 0) {
    await env.DB.batch([
      env.DB.prepare("UPDATE players SET balance = balance + ?1 WHERE user_id = ?2").bind(amount, userId),
      env.DB.prepare("INSERT INTO ledger (user_id, amount, kind, game, ref, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)").bind(
        userId,
        amount,
        entry.kind,
        entry.game ?? null,
        entry.ref ?? null,
        now(),
      ),
    ]);
  }
  return (await getPlayer(env, userId))?.balance ?? 0;
}

/** One claim per Zurich calendar day. Returns the new balance, or null if already claimed today. */
export async function claimBonus(env: Env, userId: string) {
  const today = zurichDay();
  const [update] = await env.DB.batch([
    env.DB.prepare(
      "UPDATE players SET balance = balance + ?1, bonus_day = ?2 WHERE user_id = ?3 AND (bonus_day IS NULL OR bonus_day <> ?2)",
    ).bind(DAILY_BONUS, today, userId),
    env.DB.prepare("INSERT INTO ledger (user_id, amount, kind, created_at) SELECT ?1, ?2, 'bonus', ?3 WHERE changes() = 1").bind(
      userId,
      DAILY_BONUS,
      now(),
    ),
  ]);
  if (!update.meta.changes) return null;
  return (await getPlayer(env, userId))!.balance;
}

/** Moves chips between two players in one transaction; nothing moves if the sender can't cover it. */
export async function transfer(env: Env, from: string, to: string, amount: number) {
  const t = now();
  const [update] = await env.DB.batch([
    env.DB.prepare("UPDATE players SET balance = balance - ?1 WHERE user_id = ?2 AND balance >= ?1").bind(amount, from),
    env.DB.prepare(
      "INSERT INTO ledger (user_id, amount, kind, counterparty, created_at) SELECT ?1, ?2, 'transfer_out', ?3, ?4 WHERE changes() = 1",
    ).bind(from, -amount, to, t),
    env.DB.prepare(
      "INSERT INTO ledger (user_id, amount, kind, counterparty, created_at) SELECT ?1, ?2, 'transfer_in', ?3, ?4 WHERE changes() = 1",
    ).bind(to, amount, from, t),
    env.DB.prepare("UPDATE players SET balance = balance + ?1 WHERE user_id = ?2 AND changes() = 1").bind(amount, to),
  ]);
  if (!update.meta.changes) return null;
  return (await getPlayer(env, from))!.balance;
}
