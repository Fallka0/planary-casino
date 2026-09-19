import { ITEMS } from "./catalog";
import type { Env } from "./env";
import { notify } from "./notify";

export type Category = "blackjack" | "roulette" | "chips" | "social" | "collector";
/** Visual weight of the badge; rarity (how many players own it) is computed live. */
export type Grade = 1 | 2 | 3 | 4;

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: Category;
  grade: Grade;
  /** What's printed on the badge: a short mark in the poster font, or an icon name prefixed with "@". */
  glyph: string;
  /** Hidden until unlocked. */
  secret?: boolean;
  /** Progress bar: which counter, and the goal. */
  progress?: { stat: string; target: number };
}

export const ACHIEVEMENTS: Achievement[] = [
  // Blackjack
  { id: "first_hand", name: "Pull Up a Chair", description: "Play your first hand of blackjack.", category: "blackjack", grade: 1, glyph: "@spade" },
  { id: "natural", name: "Natural", description: "Get a blackjack: an ace and a ten-value card as your first two cards.", category: "blackjack", grade: 1, glyph: "21" },
  { id: "double_win", name: "Double Down", description: "Win a hand you doubled.", category: "blackjack", grade: 1, glyph: "×2" },
  { id: "split_aces", name: "Aces Up", description: "Split a pair of aces.", category: "blackjack", grade: 2, glyph: "AA" },
  { id: "insured", name: "Belt and Braces", description: "Collect on insurance when the dealer has blackjack.", category: "blackjack", grade: 2, glyph: "2:1" },
  { id: "five_card", name: "Five-Card Charlie", description: "Hold five or more cards without going bust.", category: "blackjack", grade: 2, glyph: "5♣" },
  { id: "bj_hands_100", name: "Regular", description: "Play 100 rounds of blackjack.", category: "blackjack", grade: 2, glyph: "100", progress: { stat: "bj_hands", target: 100 } },
  { id: "bj_streak_5", name: "On a Roll", description: "Win five blackjack rounds in a row.", category: "blackjack", grade: 3, glyph: "5W", progress: { stat: "bj_best_streak", target: 5 } },
  { id: "four_hands", name: "Four-Way Split", description: "Split into four hands in one round.", category: "blackjack", grade: 3, glyph: "4" },
  { id: "natural_10", name: "Ten Naturals", description: "Get ten blackjacks. Unlocks the Twenty-one banner.", category: "blackjack", grade: 3, glyph: "21×10", progress: { stat: "bj_naturals", target: 10 } },
  { id: "bj_hands_1000", name: "Card Shark", description: "Play 1'000 rounds of blackjack. Unlocks the Card Shark title.", category: "blackjack", grade: 4, glyph: "1K", progress: { stat: "bj_hands", target: 1000 } },

  // Roulette
  { id: "first_spin", name: "First Spin", description: "Bet on your first roulette spin.", category: "roulette", grade: 1, glyph: "@wheel" },
  { id: "corner_win", name: "Cornered", description: "Win a corner bet.", category: "roulette", grade: 1, glyph: "8:1" },
  { id: "blanket", name: "Blanket Coverage", description: "Cover 20 or more spots in one spin.", category: "roulette", grade: 2, glyph: "20+" },
  { id: "straight_up", name: "Straight Up", description: "Hit a single number and get paid 35 to 1.", category: "roulette", grade: 2, glyph: "35:1" },
  { id: "spins_100", name: "Wheel Watcher", description: "Bet on 100 spins.", category: "roulette", grade: 2, glyph: "100", progress: { stat: "roulette_spins", target: 100 } },
  { id: "zero_hero", name: "Zero Hero", description: "Hit zero straight up. Unlocks the Zero Hero title.", category: "roulette", grade: 3, glyph: "0" },
  { id: "deja_vu", name: "Déjà Vu", description: "Hit the same single number on two spins in a row.", category: "roulette", grade: 4, glyph: "↺", secret: true },

  // Chips
  { id: "big_win_1k", name: "Four Figures", description: "Win 1'000 chips or more in a single round.", category: "chips", grade: 2, glyph: "1'000" },
  { id: "balance_25k", name: "Stacked", description: "Hold 25'000 chips.", category: "chips", grade: 2, glyph: "25K", progress: { stat: "balance", target: 25000 } },
  { id: "bonus_streak_7", name: "Every Day", description: "Claim the daily bonus seven days in a row.", category: "chips", grade: 2, glyph: "7", progress: { stat: "bonus_streak", target: 7 } },
  { id: "rock_bottom", name: "Rock Bottom", description: "Drop below 10 chips. It happens to everyone.", category: "chips", grade: 1, glyph: "@down", secret: true },
  { id: "big_win_10k", name: "High Roller", description: "Win 10'000 chips or more in a single round. Unlocks the High Roller title.", category: "chips", grade: 4, glyph: "10K" },
  { id: "balance_100k", name: "Whale", description: "Hold 100'000 chips. Unlocks the Whale title.", category: "chips", grade: 4, glyph: "100K", progress: { stat: "balance", target: 100000 } },
  { id: "weekly_top", name: "Top of the Week", description: "Finish a week first on the leaderboard. Unlocks the Champion title and border.", category: "chips", grade: 4, glyph: "#1" },

  // Social
  { id: "first_friend", name: "Plus One", description: "Add your first friend.", category: "social", grade: 1, glyph: "+1" },
  { id: "first_message", name: "Say Hi", description: "Send a message to a friend.", category: "social", grade: 1, glyph: "@chat" },
  { id: "generous", name: "Generous", description: "Send chips to a friend.", category: "social", grade: 1, glyph: "@gift" },
  { id: "host", name: "Host", description: "Invite a friend to your table.", category: "social", grade: 1, glyph: "@door" },
  { id: "company", name: "Good Company", description: "Play a round at the same table as a friend.", category: "social", grade: 2, glyph: "@users" },
  { id: "friends_10", name: "Full House", description: "Have ten friends.", category: "social", grade: 3, glyph: "10", progress: { stat: "friends", target: 10 } },
  { id: "patron", name: "Patron", description: "Send 10'000 chips to friends in total.", category: "social", grade: 3, glyph: "@crown", progress: { stat: "chips_sent", target: 10000 } },

  // Collector
  { id: "new_face", name: "New Face", description: "Upload a profile picture.", category: "collector", grade: 1, glyph: "@camera" },
  { id: "dressed_up", name: "Dressed Up", description: "Buy something in the shop.", category: "collector", grade: 1, glyph: "@bag" },
  { id: "collector", name: "Collector", description: "Own ten cosmetics.", category: "collector", grade: 3, glyph: "×10", progress: { stat: "items", target: 10 } },
];

export const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

// ── Counters ─────────────────────────────────────────

export async function getStats(env: Env, userId: string): Promise<Record<string, number>> {
  const { results } = await env.DB.prepare("SELECT key, value FROM stats WHERE user_id = ?").bind(userId).all<{ key: string; value: number }>();
  return Object.fromEntries(results.map((r) => [r.key, r.value]));
}

function addStat(env: Env, userId: string, key: string, delta: number) {
  return env.DB.prepare(
    "INSERT INTO stats (user_id, key, value) VALUES (?1, ?2, ?3) ON CONFLICT (user_id, key) DO UPDATE SET value = value + ?3",
  ).bind(userId, key, delta);
}

function setStat(env: Env, userId: string, key: string, value: number) {
  return env.DB.prepare("INSERT INTO stats (user_id, key, value) VALUES (?1, ?2, ?3) ON CONFLICT (user_id, key) DO UPDATE SET value = ?3").bind(
    userId,
    key,
    value,
  );
}

export async function bumpStat(env: Env, userId: string, key: string, delta: number) {
  await addStat(env, userId, key, delta).run();
}

/** Counters that aren't stored as stats but read live. */
export async function liveStats(env: Env, userId: string) {
  const [friends, items, player] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n FROM friendships WHERE status = 'accepted' AND (user_low = ?1 OR user_high = ?1)").bind(userId).first<{ n: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM inventory WHERE user_id = ?").bind(userId).first<{ n: number }>(),
    env.DB.prepare("SELECT balance, bonus_streak FROM players WHERE user_id = ?").bind(userId).first<{ balance: number; bonus_streak: number }>(),
  ]);
  return { friends: friends?.n ?? 0, items: items?.n ?? 0, balance: player?.balance ?? 0, bonus_streak: player?.bonus_streak ?? 0 };
}

// ── Unlocking ────────────────────────────────────────

/** Unlocks what isn't unlocked yet, hands out reward cosmetics, and notifies. Returns the newly unlocked. */
export async function unlock(env: Env, userId: string, ids: string[]): Promise<Achievement[]> {
  const fresh: Achievement[] = [];
  const t = Date.now();
  for (const id of new Set(ids)) {
    const achievement = ACHIEVEMENT_MAP.get(id);
    if (!achievement) continue;
    const res = await env.DB.prepare("INSERT OR IGNORE INTO achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, ?)")
      .bind(userId, id, t)
      .run();
    if (!res.meta.changes) continue;
    fresh.push(achievement);
    const rewards = [...ITEMS.values()].filter((item) => item.reward === id);
    if (rewards.length) {
      await env.DB.batch(
        rewards.map((item) =>
          env.DB.prepare("INSERT OR IGNORE INTO inventory (user_id, item_id, source, created_at) VALUES (?, ?, 'achievement', ?)").bind(userId, item.id, t),
        ),
      );
    }
    await notify(env, userId, "achievement", null, { id, rewards: rewards.map((r) => r.id) });
  }
  return fresh;
}

/** Checks the achievements that depend on live counts (friends, items, balance, bonus streak). */
export async function checkLive(env: Env, userId: string) {
  const live = await liveStats(env, userId);
  const ids: string[] = [];
  if (live.friends >= 1) ids.push("first_friend");
  if (live.friends >= 10) ids.push("friends_10");
  if (live.items >= 10) ids.push("collector");
  if (live.balance >= 25_000) ids.push("balance_25k");
  if (live.balance >= 100_000) ids.push("balance_100k");
  if (live.bonus_streak >= 7) ids.push("bonus_streak_7");
  return ids.length ? unlock(env, userId, ids) : [];
}

// ── Rounds reported by the game servers ──────────────

export interface BlackjackRound {
  game: "blackjack";
  net: number;
  hands: { result: string; doubled: boolean; cards: number; total: number }[];
  splitAces: boolean;
  insuranceWon: boolean;
}

export interface RouletteRound {
  game: "roulette";
  net: number;
  result: number;
  spots: number;
  bets: { type: string; target: number[]; won: boolean }[];
}

async function areFriends(env: Env, userId: string, others: string[]) {
  if (!others.length) return false;
  const placeholders = others.map((_, i) => `?${i + 2}`).join(",");
  const row = await env.DB.prepare(
    `SELECT 1 FROM friendships WHERE status = 'accepted' AND (
       (user_low = ?1 AND user_high IN (${placeholders})) OR (user_high = ?1 AND user_low IN (${placeholders})))
     LIMIT 1`,
  )
    .bind(userId, ...others)
    .first();
  return row !== null;
}

export async function recordRound(env: Env, userId: string, round: BlackjackRound | RouletteRound, tablemates: string[]) {
  const ids: string[] = [];
  const stats = await getStats(env, userId);
  const writes = [];

  if (round.net > (stats.best_round ?? 0)) writes.push(setStat(env, userId, "best_round", round.net));
  if (round.net >= 1_000) ids.push("big_win_1k");
  if (round.net >= 10_000) ids.push("big_win_10k");
  if (await areFriends(env, userId, tablemates.filter((id) => id !== userId))) ids.push("company");

  if (round.game === "blackjack") {
    const hands = (stats.bj_hands ?? 0) + 1;
    const naturals = (stats.bj_naturals ?? 0) + round.hands.filter((h) => h.result === "blackjack").length;
    const streak = round.net > 0 ? (stats.bj_win_streak ?? 0) + 1 : round.net < 0 ? 0 : (stats.bj_win_streak ?? 0);
    const best = Math.max(stats.bj_best_streak ?? 0, streak);
    writes.push(
      setStat(env, userId, "bj_hands", hands),
      setStat(env, userId, "bj_naturals", naturals),
      setStat(env, userId, "bj_win_streak", streak),
      setStat(env, userId, "bj_best_streak", best),
    );
    ids.push("first_hand");
    if (naturals >= 1) ids.push("natural");
    if (naturals >= 10) ids.push("natural_10");
    if (hands >= 100) ids.push("bj_hands_100");
    if (hands >= 1000) ids.push("bj_hands_1000");
    if (best >= 5) ids.push("bj_streak_5");
    if (round.hands.some((h) => h.doubled && (h.result === "win" || h.result === "blackjack"))) ids.push("double_win");
    if (round.splitAces) ids.push("split_aces");
    if (round.hands.length >= 4) ids.push("four_hands");
    if (round.hands.some((h) => h.cards >= 5 && h.total <= 21 && h.result !== "bust")) ids.push("five_card");
    if (round.insuranceWon) ids.push("insured");
  } else {
    const spins = (stats.roulette_spins ?? 0) + 1;
    const straightHit = round.bets.find((b) => b.type === "straight" && b.won);
    // Remembers last spin's straight-up hit (number + 1, 0 for none) for Déjà Vu.
    const lastHit = stats.roulette_last_hit ?? 0;
    writes.push(setStat(env, userId, "roulette_spins", spins), setStat(env, userId, "roulette_last_hit", straightHit ? straightHit.target[0] + 1 : 0));
    ids.push("first_spin");
    if (spins >= 100) ids.push("spins_100");
    if (round.spots >= 20) ids.push("blanket");
    if (straightHit) ids.push("straight_up");
    if (straightHit && straightHit.target[0] === 0) ids.push("zero_hero");
    if (straightHit && lastHit === straightHit.target[0] + 1) ids.push("deja_vu");
    if (round.bets.some((b) => b.type === "corner" && b.won)) ids.push("corner_win");
  }

  await env.DB.batch(writes);
  const balance = await env.DB.prepare("SELECT balance FROM players WHERE user_id = ?").bind(userId).first<{ balance: number }>();
  if (balance && balance.balance < 10) ids.push("rock_bottom");
  const fresh = await unlock(env, userId, ids);
  return [...fresh, ...(await checkLive(env, userId))];
}

// ── Reading ──────────────────────────────────────────

/** Share of players holding each achievement, 0–1. */
export async function rarities(env: Env) {
  const [{ results }, total] = await Promise.all([
    env.DB.prepare("SELECT achievement_id AS id, COUNT(*) AS n FROM achievements GROUP BY achievement_id").all<{ id: string; n: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM players").first<{ n: number }>(),
  ]);
  const players = Math.max(1, total?.n ?? 1);
  const map = new Map(results.map((r) => [r.id, r.n / players]));
  return (id: string) => map.get(id) ?? 0;
}

export async function achievementsOf(env: Env, userId: string) {
  const { results } = await env.DB.prepare("SELECT achievement_id AS id, unlocked_at FROM achievements WHERE user_id = ?")
    .bind(userId)
    .all<{ id: string; unlocked_at: number }>();
  return new Map(results.map((r) => [r.id, r.unlocked_at]));
}

/** Every achievement with its rarity, and for `userId` whether it's unlocked and how far along they are. */
export async function achievementList(env: Env, userId: string, withProgress: boolean) {
  const [rarity, owned, stats, live] = await Promise.all([
    rarities(env),
    achievementsOf(env, userId),
    withProgress ? getStats(env, userId) : Promise.resolve({} as Record<string, number>),
    withProgress ? liveStats(env, userId) : Promise.resolve(null),
  ]);
  const values: Record<string, number> = { ...stats, ...(live ?? {}) };
  return ACHIEVEMENTS.map((a) => {
    const unlockedAt = owned.get(a.id) ?? null;
    const hidden = a.secret && !unlockedAt;
    return {
      id: a.id,
      name: hidden ? "Secret" : a.name,
      description: hidden ? "Keep playing to find out." : a.description,
      category: a.category,
      grade: a.grade,
      glyph: hidden ? "?" : a.glyph,
      secret: Boolean(a.secret),
      rarity: rarity(a.id),
      unlockedAt,
      progress:
        withProgress && a.progress && !unlockedAt ? { value: Math.min(values[a.progress.stat] ?? 0, a.progress.target), target: a.progress.target } : null,
    };
  });
}
