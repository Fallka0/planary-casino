// Operator rules the whole casino obeys: settings, account restrictions, game status, loss limits.

import type { Env, Player } from "./env";
import { zurichDayStart } from "./time";

export const DEFAULT_SETTINGS = {
  starterChips: 5000,
  dailyBonus: 500,
  minTransfer: 10,
};
export type Settings = typeof DEFAULT_SETTINGS;

let cached: { at: number; value: Settings } | null = null;

/** Settings change rarely; each worker instance re-reads them at most every 30 s. */
export async function getSettings(env: Env, fresh = false): Promise<Settings> {
  if (!fresh && cached && Date.now() - cached.at < 30_000) return cached.value;
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all<{ key: string; value: string }>();
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const row of results) {
    if (row.key in out) {
      const value = JSON.parse(row.value);
      if (typeof value === "number" && Number.isFinite(value)) out[row.key as keyof Settings] = value;
    }
  }
  cached = { at: Date.now(), value: out };
  return out;
}

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Zurich" });

/** Why this account can't use the casino right now, or null. */
export function blockedReason(p: Pick<Player, "status" | "status_until" | "status_reason">, now = Date.now()) {
  if (p.status === "banned") return `This account is closed${p.status_reason ? `: ${p.status_reason}` : "."}`;
  if (p.status === "suspended" && (!p.status_until || p.status_until > now)) {
    return `This account is suspended${p.status_until ? ` until ${fmtDate(p.status_until)}` : ""}${p.status_reason ? `: ${p.status_reason}` : "."}`;
  }
  return null;
}

export function isMuted(p: Pick<Player, "muted_until">, now = Date.now()) {
  return Boolean(p.muted_until && p.muted_until > now);
}

/** Why this player can't bet right now (on top of having the chips), or null. */
export async function betRefusal(env: Env, p: Player, game: string | undefined, amount: number) {
  const blocked = blockedReason(p);
  if (blocked) return blocked;
  if (p.excluded_until && p.excluded_until > Date.now()) return `You're taking a break from play until ${fmtDate(p.excluded_until)}.`;
  if (game) {
    const g = await env.DB.prepare("SELECT status, note FROM game_settings WHERE game = ?").bind(game).first<{ status: string; note: string | null }>();
    if (g?.status === "maintenance") return g.note || "This game is closed for maintenance. Try again soon.";
  }
  if (p.loss_limit !== null && p.loss_limit !== undefined) {
    const lost = await dailyLoss(env, p.user_id);
    if (lost + amount > p.loss_limit) return `That would pass your daily loss limit of ${p.loss_limit.toLocaleString("de-CH")} chips.`;
  }
  return null;
}

/** Chips lost at the tables today (Zurich), net of winnings. Bets count once they're placed. */
export async function dailyLoss(env: Env, userId: string) {
  const row = await env.DB.prepare("SELECT COALESCE(SUM(amount), 0) AS net FROM ledger WHERE user_id = ? AND kind = 'game' AND created_at >= ?")
    .bind(userId, zurichDayStart())
    .first<{ net: number }>();
  return Math.max(0, -(row?.net ?? 0));
}

export async function gameStatus(env: Env) {
  const { results } = await env.DB.prepare("SELECT game, status, note, updated_at FROM game_settings").all<{
    game: string;
    status: string;
    note: string | null;
    updated_at: number;
  }>();
  return new Map(results.map((r) => [r.game, r]));
}

export async function shopOverrides(env: Env) {
  const { results } = await env.DB.prepare("SELECT item_id, price, enabled FROM shop_overrides").all<{ item_id: string; price: number | null; enabled: number }>();
  return new Map(results.map((r) => [r.item_id, r]));
}
