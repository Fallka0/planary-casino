// Casino names. Everyone starts with their Planary account name, which follows
// the account on every sign-in until they pick one of their own. The first pick
// is free; every one after that costs chips, paid to the bank like a shop buy.

import { bankEntry } from "./bank";
import type { Env, Player } from "./env";

export const NAME_CHANGE_PRICE = 1000;

function stripName(raw: unknown) {
  return String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24)
    .trim();
}

export function cleanName(raw: unknown) {
  return stripName(raw) || "Player";
}

/** What the next name you pick yourself costs. */
export function nameChangePrice(p: Pick<Player, "name_changes">) {
  return p.name_changes > 0 ? NAME_CHANGE_PRICE : 0;
}

/** Checks a name someone typed. Returns the clean name, or why it can't be used. */
export async function checkName(env: Env, userId: string, raw: unknown): Promise<{ name: string } | { error: string; status: 400 | 409 }> {
  const name = stripName(raw);
  if (name.length < 2) return { error: "Names need at least two characters.", status: 400 };
  const taken = await env.DB.prepare("SELECT 1 FROM players WHERE name_lower = ? AND user_id <> ? LIMIT 1").bind(name.toLowerCase(), userId).first();
  if (taken) return { error: "Another player already goes by that name.", status: 409 };
  return { name };
}

/**
 * A player renaming themselves. Charges the price in the same batch as the
 * rename, so either both happen or neither: the update only goes through while
 * the balance covers it and nobody else renamed this player in between.
 * Returns the price paid, or null when the balance didn't cover it.
 */
export async function renameSelf(env: Env, p: Player, name: string): Promise<number | null> {
  const price = nameChangePrice(p);
  const t = Date.now();
  const [update] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE players SET name = ?2, name_lower = ?3, name_custom = 1, name_changes = name_changes + 1, balance = balance - ?4
       WHERE user_id = ?1 AND name_changes = ?5 AND balance >= ?4`,
    ).bind(p.user_id, name, name.toLowerCase(), price, p.name_changes),
    ...(price > 0
      ? [
          env.DB.prepare("INSERT INTO ledger (user_id, amount, kind, ref, created_at) SELECT ?1, ?2, 'shop', 'name-change', ?3 WHERE changes() = 1").bind(
            p.user_id,
            -price,
            t,
          ),
          bankEntry(env, "shop", "in", price, t),
        ]
      : []),
  ]);
  return update.meta.changes ? price : null;
}

/** Staff renaming a player: free, and it doesn't use up the player's free change. */
export async function renameByStaff(env: Env, userId: string, name: string) {
  await env.DB.prepare("UPDATE players SET name = ?2, name_lower = ?3, name_custom = 1 WHERE user_id = ?1").bind(userId, name, name.toLowerCase()).run();
}

/** Hands the name back to the Planary account; the next request syncs it. */
export async function clearCustomName(env: Env, userId: string) {
  await env.DB.prepare("UPDATE players SET name_custom = 0 WHERE user_id = ?").bind(userId).run();
}
