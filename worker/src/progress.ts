// Taking a record back: clearing an account down to a clean slate, and setting a
// player's progress by hand.
//
// Everything else in the operator tools adds to the record — an adjustment, a
// note, a restriction. These four things subtract from it, which is why they
// exist at all. A week of testing chip adjustments leaves a leaderboard that is
// a sum over the ledger and so cannot be argued with, lifetime figures that are
// the same sum sliced differently, and achievements that have no "lock" beside
// them. There is no amount of normal operator work that undoes any of it.
//
// The one thing a reset never touches is the game round archive. Those rows are
// written once on purpose (migration 0004), and a blackjack round belongs to the
// whole table: dropping one player's seat out of it would quietly rewrite the
// history of everyone who sat next to them. A reset clears what the casino says
// about a player; what happened at the table stays said.

import { ACHIEVEMENT_MAP, ACHIEVEMENTS, getStats, liveStats, rewardsFor } from "./achievements";
import { KIND_COLUMN } from "./catalog";
import type { Env, Player } from "./env";
import { getSettings } from "./policy";
import { parseShowcase } from "./social";

// ── What a reset can clear ───────────────────────────

export type Area = "chips" | "play" | "achievements" | "cosmetics" | "social" | "profile";

export interface AreaSpec {
  id: Area;
  label: string;
  detail: string;
  /** Ticked when the dialog opens: the three that make up "the history is cooked". */
  recommended: boolean;
}

export const RESET_AREAS: AreaSpec[] = [
  {
    id: "chips",
    label: "Chips and chip history",
    detail:
      "Every ledger row, the balance, and the daily-bonus day and streak. This is what the weekly leaderboard, the lifetime figures and the daily loss limit are all summed from.",
    recommended: true,
  },
  {
    id: "play",
    label: "Play counters",
    detail: "Rounds played, blackjacks, spins, best round, Grimoire bindings — every counter behind an achievement's progress bar.",
    recommended: true,
  },
  {
    id: "achievements",
    label: "Achievements",
    detail: "Unlocked achievements, the three pinned to the profile, and the cosmetics those achievements handed out.",
    recommended: true,
  },
  { id: "cosmetics", label: "Cosmetics", detail: "Everything in the inventory, bought or earned, and whatever is equipped.", recommended: false },
  {
    id: "social",
    label: "Friends, messages and notifications",
    detail:
      "Friendships, the whole message history, and every notification. A conversation has two ends, so this reaches the other player's account too: the friendship goes for both of them, and messages and prompts from this player disappear from their side as well.",
    recommended: false,
  },
  {
    id: "profile",
    label: "Picture and bio",
    detail: "The profile picture and the bio. The display name comes from the Planary account, so it returns on the next sign-in.",
    recommended: false,
  },
];

const AREA_IDS = new Set<string>(RESET_AREAS.map((a) => a.id));
export const isArea = (value: unknown): value is Area => typeof value === "string" && AREA_IDS.has(value);

/** What the balance should be afterwards. */
export type Opening = "starter" | "zero" | "keep";

export interface ResetPlan {
  areas: Area[];
  opening: Opening;
  reason: string;
}

export interface ResetResult {
  balance: number;
  /** Rows removed, by what they were. Goes into the audit entry and the toast. */
  cleared: Record<string, number>;
}

/**
 * Puts down anything the player no longer owns.
 *
 * Ownership is checked when a player equips something, so taking the item away
 * has to put the slot back by itself — otherwise a profile keeps wearing a
 * border that is no longer in the inventory, and the shop has no way to explain
 * it. Written against the catalog's own slot list so a new kind of cosmetic is
 * covered the day it is added.
 */
function unequipUnowned(env: Env, userId: string) {
  const slots = [...new Set(Object.values(KIND_COLUMN))];
  const sets = slots.map((slot) => `${slot} = CASE WHEN ${slot} IN (SELECT item_id FROM inventory WHERE user_id = ?1) THEN ${slot} ELSE NULL END`);
  return env.DB.prepare(`UPDATE players SET ${sets.join(", ")} WHERE user_id = ?1`).bind(userId);
}

/**
 * Clears the chosen areas in one transaction.
 *
 * The order matters in two places: the cosmetics go before the slots are put
 * down, so the slots are judged against what is left, and the notification is
 * sent by the caller afterwards, so clearing the notifications does not take it
 * with them.
 */
export async function resetAccount(env: Env, player: Player, plan: ResetPlan, staffName: string): Promise<ResetResult> {
  const id = player.user_id;
  const want = new Set(plan.areas);
  /** A label counts the rows the statement removed; null means nothing to count. */
  const steps: [string | null, D1PreparedStatement][] = [];
  const t = Date.now();
  let balance = player.balance;

  if (want.has("chips")) {
    const { starterChips } = await getSettings(env, true);
    balance = plan.opening === "starter" ? starterChips : plan.opening === "zero" ? 0 : player.balance;
    steps.push(["ledger", env.DB.prepare("DELETE FROM ledger WHERE user_id = ?1").bind(id)]);
    steps.push([null, env.DB.prepare("UPDATE players SET balance = ?2, bonus_day = NULL, bonus_streak = 0 WHERE user_id = ?1").bind(id, balance)]);
    // A balance with nothing behind it is still a balance. One opening row says
    // where it came from, so a fresh account's history reads like a fresh
    // account's and the circulation figures still add up.
    if (balance > 0) {
      steps.push([
        null,
        env.DB.prepare("INSERT INTO ledger (user_id, amount, kind, ref, created_at) VALUES (?1, ?2, 'starter', ?3, ?4)").bind(
          id,
          balance,
          `Account reset by ${staffName}: ${plan.reason}`,
          t,
        ),
      ]);
    }
  }

  if (want.has("play")) steps.push(["stats", env.DB.prepare("DELETE FROM stats WHERE user_id = ?1").bind(id)]);

  if (want.has("achievements")) {
    steps.push(["achievements", env.DB.prepare("DELETE FROM achievements WHERE user_id = ?1").bind(id)]);
    steps.push(["rewardItems", env.DB.prepare("DELETE FROM inventory WHERE user_id = ?1 AND source = 'achievement'").bind(id)]);
    steps.push([null, env.DB.prepare("UPDATE players SET showcase = NULL WHERE user_id = ?1").bind(id)]);
  }

  if (want.has("cosmetics")) steps.push(["items", env.DB.prepare("DELETE FROM inventory WHERE user_id = ?1").bind(id)]);
  if (want.has("achievements") || want.has("cosmetics")) steps.push([null, unequipUnowned(env, id)]);

  if (want.has("social")) {
    steps.push(["messages", env.DB.prepare("DELETE FROM messages WHERE sender_id = ?1 OR recipient_id = ?1").bind(id)]);
    steps.push(["notifications", env.DB.prepare("DELETE FROM notifications WHERE user_id = ?1 OR actor_id = ?1").bind(id)]);
    steps.push(["friendships", env.DB.prepare("DELETE FROM friendships WHERE user_low = ?1 OR user_high = ?1").bind(id)]);
  }

  if (want.has("profile")) {
    steps.push(["avatar", env.DB.prepare("DELETE FROM avatars WHERE user_id = ?1").bind(id)]);
    steps.push([null, env.DB.prepare("UPDATE players SET avatar_version = 0, bio = NULL WHERE user_id = ?1").bind(id)]);
  }

  const results = await env.DB.batch(steps.map(([, stmt]) => stmt));
  const cleared: Record<string, number> = {};
  steps.forEach(([label], i) => {
    if (label) cleared[label] = results[i]?.meta.changes ?? 0;
  });
  return { balance, cleared };
}

// ── Counters a staff member can set ──────────────────

export interface StatField {
  key: string;
  label: string;
  hint?: string;
  min: number;
  max: number;
  /** A row in `stats`, or a column on `players`. */
  store: "stats" | "player";
}

/** Chip amounts are bounded by the same exactness the wallet is. */
const CHIPS = Number.MAX_SAFE_INTEGER;
/** Counts of things that happened. Far past any real total, and nowhere near where arithmetic gets vague. */
const COUNT = 1_000_000_000;

export const STAT_FIELDS: StatField[] = [
  { key: "bj_hands", label: "Blackjack rounds played", min: 0, max: COUNT, store: "stats" },
  { key: "bj_naturals", label: "Blackjacks dealt", min: 0, max: COUNT, store: "stats" },
  { key: "bj_win_streak", label: "Blackjack win streak, running", hint: "Resets itself the next time they lose a round.", min: 0, max: COUNT, store: "stats" },
  { key: "bj_best_streak", label: "Blackjack win streak, best", min: 0, max: COUNT, store: "stats" },
  { key: "roulette_spins", label: "Roulette spins bet on", min: 0, max: COUNT, store: "stats" },
  {
    key: "roulette_last_hit",
    label: "Last straight-up number hit",
    hint: "The number plus one, or 0 for none. Only Déjà Vu reads it.",
    min: 0,
    max: 37,
    store: "stats",
  },
  { key: "best_round", label: "Best single round, chips won", min: 0, max: CHIPS, store: "stats" },
  { key: "chips_sent", label: "Chips sent to friends, all time", min: 0, max: CHIPS, store: "stats" },
  { key: "chips_received", label: "Chips received from friends, all time", min: 0, max: CHIPS, store: "stats" },
  { key: "bonus_streak", label: "Daily bonus streak, days", hint: "Kept on the account itself, next to the balance.", min: 0, max: COUNT, store: "player" },
  { key: "grimoire_best", label: "Grimoire: furthest chapter", min: 0, max: 1000, store: "stats" },
  { key: "grimoire_plain", label: "Grimoire: The Plain Binding finished", hint: "1 for finished, 0 for not.", min: 0, max: 1, store: "stats" },
  { key: "grimoire_ashen", label: "Grimoire: The Ashen Binding finished", min: 0, max: 1, store: "stats" },
  { key: "grimoire_gilded", label: "Grimoire: The Gilded Binding finished", min: 0, max: 1, store: "stats" },
  { key: "grimoire_hollow", label: "Grimoire: The Hollow Binding finished", min: 0, max: 1, store: "stats" },
  { key: "grimoire_crimson", label: "Grimoire: The Crimson Binding finished", min: 0, max: 1, store: "stats" },
  { key: "grimoire_leaden", label: "Grimoire: The Leaden Binding finished", min: 0, max: 1, store: "stats" },
];

const FIELDS = new Map(STAT_FIELDS.map((f) => [f.key, f]));

/**
 * Counters that are never stored, only counted when something asks.
 *
 * Writing one would look like it worked and then be gone, so they are refused
 * by name rather than quietly dropped. The balance has its own tool, which also
 * writes the ledger row that makes the number explainable.
 */
export const COMPUTED: Record<string, string> = {
  balance: "The balance isn't a counter. Use Adjust chips, which writes the chip history with it.",
  friends: "Counted from the friend list.",
  items: "Counted from the inventory.",
};

/** A key the panel didn't know about: whatever a game server starts writing next. */
const RAW_KEY = /^[a-z][a-z0-9_]{1,38}$/;

export interface StatChange {
  key: string;
  /** null removes the counter, which reads as zero everywhere. */
  value: number | null;
}

/** Checks a set of changes and says what is wrong with the first one that is. */
export function checkStats(changes: StatChange[]): string | null {
  if (!changes.length) return "Nothing to change.";
  if (changes.length > 50) return "That's too many counters at once.";
  const seen = new Set<string>();
  for (const { key, value } of changes) {
    if (COMPUTED[key]) return COMPUTED[key];
    const field = FIELDS.get(key);
    if (!field && !RAW_KEY.test(key)) return `"${key}" isn't a counter name: lower-case letters, digits and underscores, two or more.`;
    if (seen.has(key)) return `${field?.label ?? key} is in the list twice.`;
    seen.add(key);
    if (value === null) continue;
    const min = field?.min ?? -CHIPS;
    const max = field?.max ?? CHIPS;
    if (!Number.isInteger(value) || value < min || value > max) {
      return `${field?.label ?? key} must be a whole number from ${min.toLocaleString("de-CH")} to ${max.toLocaleString("de-CH")}.`;
    }
  }
  return null;
}

/** Writes the changes. Assumes `checkStats` has already passed. */
export async function setStats(env: Env, userId: string, changes: StatChange[]) {
  const steps = changes.map(({ key, value }) => {
    const field = FIELDS.get(key);
    if (field?.store === "player") {
      // A column has no "absent", so the lowest it goes is zero.
      return env.DB.prepare(`UPDATE players SET ${field.key} = ?2 WHERE user_id = ?1`).bind(userId, value ?? 0);
    }
    if (value === null) return env.DB.prepare("DELETE FROM stats WHERE user_id = ?1 AND key = ?2").bind(userId, key);
    return env.DB.prepare("INSERT INTO stats (user_id, key, value) VALUES (?1, ?2, ?3) ON CONFLICT (user_id, key) DO UPDATE SET value = ?3").bind(
      userId,
      key,
      value,
    );
  });
  await env.DB.batch(steps);
}

/**
 * Achievements whose bar these counters have now filled.
 *
 * Only the ones that declare a progress bar can be worked out from a number.
 * "Four-Way Split" happened at a table and no counter remembers it, so those
 * stay a deliberate grant — which is the honest division anyway: a counter
 * implies its milestones, an event doesn't imply itself.
 */
export async function earnedByCounters(env: Env, userId: string) {
  const [stats, live] = await Promise.all([getStats(env, userId), liveStats(env, userId)]);
  const values: Record<string, number> = { ...stats, ...live };
  return ACHIEVEMENTS.filter((a) => a.progress && (values[a.progress.stat] ?? 0) >= a.progress.target).map((a) => a.id);
}

// ── Taking an achievement back ───────────────────────

/**
 * Revokes achievements, optionally taking back the cosmetics they handed out.
 *
 * Only the copies that came from an achievement are taken: an item that was
 * also bought in the shop was paid for, and the reward is not a reason to
 * confiscate it. Nothing refunds — a revoke is a correction to a record, not a
 * transaction.
 */
export async function revokeAchievements(env: Env, userId: string, ids: string[], takeRewards: boolean) {
  const valid = [...new Set(ids)].filter((id) => ACHIEVEMENT_MAP.has(id));
  if (!valid.length) return { revoked: 0, itemsRemoved: 0 };
  const gone = new Set(valid);

  const rewardIds = takeRewards ? valid.flatMap((id) => rewardsFor(id).map((item) => item.id)) : [];
  const marks = (list: unknown[]) => list.map((_, i) => `?${i + 2}`).join(",");
  const steps = [env.DB.prepare(`DELETE FROM achievements WHERE user_id = ?1 AND achievement_id IN (${marks(valid)})`).bind(userId, ...valid)];
  if (rewardIds.length) {
    steps.push(env.DB.prepare(`DELETE FROM inventory WHERE user_id = ?1 AND source = 'achievement' AND item_id IN (${marks(rewardIds)})`).bind(userId, ...rewardIds));
    steps.push(unequipUnowned(env, userId));
  }

  // The showcase pins achievement ids, and a revoked one has nothing left to
  // point at. The profile already hides pins it can't match, so unpinning is
  // tidying rather than a fix — but a stored list that still names a badge the
  // player doesn't hold is the kind of thing somebody later reads as truth.
  const row = await env.DB.prepare("SELECT showcase FROM players WHERE user_id = ?1").bind(userId).first<{ showcase: string | null }>();
  const pinned = parseShowcase(row?.showcase ?? null);
  if (pinned.some((id) => gone.has(id))) {
    const kept = pinned.filter((id) => !gone.has(id));
    steps.push(env.DB.prepare("UPDATE players SET showcase = ?2 WHERE user_id = ?1").bind(userId, kept.length ? JSON.stringify(kept) : null));
  }

  const results = await env.DB.batch(steps);
  return { revoked: results[0]?.meta.changes ?? 0, itemsRemoved: rewardIds.length ? (results[1]?.meta.changes ?? 0) : 0 };
}
