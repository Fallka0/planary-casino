import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, Player } from "./env";
import { type BlackjackRound, bumpStat, checkLive, getStats, type RouletteRound, recordRound, unlock } from "./achievements";
import { notify } from "./notify";
import { BADGE_COLUMNS, badge, pairKey, presenceOf, social, unreadCounts } from "./social";
import { nextZurichMidnight, zurichDay, zurichWeekStart } from "./time";
import { admin } from "./admin";
import { pruneRounds, openCommitment, revealCommitment, roundById, roundsForPlayer, saveRound, sealClientSeed, type RoundRecord } from "./archive";
import { betRefusal, blockedReason, getSettings, isMuted } from "./policy";
import { claimBonus, credit, debit, ensurePlayer, getPlayer, transfer } from "./wallet";

type Vars = { player: Player };
const app = new Hono<{ Bindings: Env; Variables: Vars }>();

const PRESENCE_WHERE = new Set(["lobby", "blackjack", "roulette", "nerve"]);

/**
 * How long a game round is kept. A regulated operator would set this to five
 * years; Planary keeps a year, which covers support, disputes and statistics
 * without storing play money forever. Whoever runs this decides — it is one
 * number, and the archive is built so raising it costs nothing but disk.
 */
const ROUND_RETENTION_DAYS = 365;

/**
 * The weekly sweep, deleting in bounded batches so a long-neglected database
 * still finishes.
 *
 * It writes itself into the audit log. Deleting game records is the one thing
 * an operator does that a regulator would most want accounted for, and "the
 * system did it automatically" is only an answer if the system says so, with
 * a date and a count, in the same place every other consequential action is
 * recorded.
 */
async function sweepRounds(env: Env) {
  const startedAt = Date.now();
  let removed = 0;
  for (let batch = 0; batch < 40; batch++) {
    const gone = await pruneRounds(env, ROUND_RETENTION_DAYS);
    removed += gone;
    if (gone === 0) break;
  }
  if (removed === 0) return;
  await env.DB.prepare("INSERT INTO audit_log (staff_id, staff_name, action, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(
      "system",
      "Retention sweep",
      "rounds.pruned",
      null,
      JSON.stringify({ removed, keepDays: ROUND_RETENTION_DAYS, olderThan: new Date(startedAt - ROUND_RETENTION_DAYS * 86_400_000).toISOString() }),
      Date.now(),
    )
    .run();
}

function cleanName(raw: unknown) {
  return String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .trim()
    .slice(0, 24) || "Player";
}

function isInt(value: unknown, min: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= 100_000_000;
}

// ── Internal API for game servers (shared key) ───────

app.use("/internal/*", async (c, next) => {
  if (!c.env.INTERNAL_KEY || c.req.header("x-internal-key") !== c.env.INTERNAL_KEY) return c.json({ error: "forbidden" }, 403);
  await next();
});

app.post("/internal/wallet", async (c) => {
  const { userId, name } = await c.req.json<{ userId: string; name: string }>();
  const player = await ensurePlayer(c.env, userId, cleanName(name));
  // The tables show your picture, border and title, and draw your card back and chips.
  // `blocked` keeps suspended players off the tables; `muted` keeps them out of table chat.
  return c.json({
    balance: player.balance,
    ...badge(player),
    cardback: player.cardback,
    chipset: player.chipset,
    blocked: blockedReason(player),
    muted: isMuted(player),
  });
});

/** Restrictions only, without touching the player's name (chat checks). */
app.post("/internal/status", async (c) => {
  const { userId } = await c.req.json<{ userId: string }>();
  const player = await getPlayer(c.env, userId);
  return c.json({ balance: player?.balance ?? 0, blocked: player ? blockedReason(player) : null, muted: player ? isMuted(player) : false });
});

/** A finished round, reported by a game server: updates counters and unlocks achievements. */
app.post("/internal/round", async (c) => {
  const { userId, round, tablemates } = await c.req.json<{ userId: string; round: BlackjackRound | RouletteRound; tablemates?: string[] }>();
  if (!round || (round.game !== "blackjack" && round.game !== "roulette")) return c.json({ error: "bad round" }, 400);
  const unlocked = await recordRound(c.env, userId, round, Array.isArray(tablemates) ? tablemates.slice(0, 20) : []);
  return c.json({ unlocked: unlocked.map((a) => ({ id: a.id, name: a.name })) });
});

/**
 * A table promising an outcome it does not yet know. It sends only the hash;
 * the seed stays at the table until the round or the shoe is finished.
 */
app.post("/internal/commitments", async (c) => {
  const body = await c.req.json<Parameters<typeof openCommitment>[1]>();
  if (!body?.hash || !body.game || !body.tableId) return c.json({ error: "bad commitment" }, 400);
  return c.json({ id: await openCommitment(c.env, body) });
});

/** The contributed seeds, written down when betting closes. */
app.post("/internal/commitments/:id/seal", async (c) => {
  const { clientSeed } = await c.req.json<{ clientSeed: string }>();
  return c.json({ sealed: await sealClientSeed(c.env, c.req.param("id"), String(clientSeed ?? "")) });
});

/** The reveal. The database permits this exactly once per commitment. */
app.post("/internal/commitments/:id/reveal", async (c) => {
  const { serverSeed } = await c.req.json<{ serverSeed: string }>();
  if (!serverSeed) return c.json({ error: "no seed" }, 400);
  const opened = await revealCommitment(c.env, c.req.param("id"), serverSeed);
  return c.json({ opened });
});

/** One finished round, written down for good. */
app.post("/internal/archive", async (c) => {
  const record = await c.req.json<RoundRecord>();
  if (!record?.game || !record.tableId || !Array.isArray(record.players)) return c.json({ error: "bad round" }, 400);
  try {
    return c.json({ id: await saveRound(c.env, record) });
  } catch (error) {
    // A table must never stall because the archive is unhappy; it is logged and the round stands.
    console.error("archive failed", error);
    return c.json({ error: "not archived" }, 500);
  }
});

app.post("/internal/debit", async (c) => {
  const { userId, amount, game, ref } = await c.req.json<{ userId: string; amount: number; game: string; ref?: string }>();
  if (!isInt(amount, 1)) return c.json({ error: "bad amount" }, 400);
  const player = await getPlayer(c.env, userId);
  if (!player) return c.json({ ok: false, balance: 0, reason: "No wallet for this player." });
  const reason = await betRefusal(c.env, player, game, amount);
  if (reason) return c.json({ ok: false, balance: player.balance, reason });
  const balance = await debit(c.env, userId, amount, { kind: "game", game, ref });
  return balance === null ? c.json({ ok: false, balance: (await getPlayer(c.env, userId))?.balance ?? 0 }) : c.json({ ok: true, balance });
});

app.post("/internal/credit", async (c) => {
  const { userId, amount, game, ref } = await c.req.json<{ userId: string; amount: number; game: string; ref?: string }>();
  if (!isInt(amount, 0)) return c.json({ error: "bad amount" }, 400);
  return c.json({ balance: await credit(c.env, userId, amount, { kind: "game", game, ref }) });
});

app.post("/internal/presence", async (c) => {
  const { userId, where, table } = await c.req.json<{ userId: string; where: string; table?: string | null }>();
  if (!PRESENCE_WHERE.has(where)) return c.json({ error: "bad presence" }, 400);
  await c.env.DB.prepare("UPDATE players SET last_seen = ?1, presence_where = ?2, presence_table = ?3 WHERE user_id = ?4")
    .bind(Date.now(), where, table ?? null, userId)
    .run();
  return c.json({ ok: true });
});

// ── Public API (Planary sign-in required) ────────────

app.use(
  "/v1/*",
  cors({
    origin: (origin, c) =>
      c.env.ALLOWED_ORIGINS.split(",")
        .map((o: string) => o.trim())
        .includes(origin)
        ? origin
        : null,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
    maxAge: 86400,
  }),
);

app.use("/v1/*", async (c, next) => {
  if (c.req.method === "OPTIONS") return next();
  const authorization = c.req.header("authorization");
  if (!authorization) return c.json({ error: "not authenticated" }, 401);
  const res = await c.env.AUTH.fetch(new Request("https://auth.internal/api/auth/me", { headers: { Authorization: authorization } }));
  if (!res.ok) return c.json({ error: "not authenticated" }, 401);
  const { user } = (await res.json()) as { user: { id: string; name?: string; email?: string } };
  const player = await ensurePlayer(c.env, user.id, cleanName(user.name || user.email?.split("@")[0]));
  const blocked = blockedReason(player);
  if (blocked) return c.json({ error: blocked, code: "blocked" }, 403);
  c.set("player", player);
  await next();
});

/** Your own rounds, newest first. */
app.get("/v1/rounds", async (c) => {
  const page = Math.max(0, Number.parseInt(c.req.query("page") ?? "0", 10) || 0);
  return c.json(await roundsForPlayer(c.env, c.get("player").user_id, page));
});

/**
 * One round in full. Readable by any signed-in player, because a proof nobody
 * else can look at is not much of a proof.
 */
app.get("/v1/rounds/:id", async (c) => {
  const round = await roundById(c.env, c.req.param("id"));
  if (!round) return c.json({ error: "no such round" }, 404);
  return c.json(round);
});

app.get("/v1/me", async (c) => {
  const p = c.get("player");
  const { dailyBonus } = await getSettings(c.env);
  const available = p.bonus_day !== zurichDay();
  return c.json({
    ...badge(p),
    banner: p.banner,
    cardback: p.cardback,
    chipset: p.chipset,
    balance: p.balance,
    bonusStreak: p.bonus_streak,
    bonus: { amount: dailyBonus, available, nextAt: available ? null : nextZurichMidnight() },
    limits: { lossLimit: p.loss_limit, excludedUntil: p.excluded_until },
  });
});

app.post("/v1/chips/bonus", async (c) => {
  const me = c.get("player").user_id;
  const balance = await claimBonus(c.env, me);
  if (balance === null) return c.json({ error: "Today's bonus is already claimed.", nextAt: nextZurichMidnight() }, 409);
  const unlocked = await checkLive(c.env, me);
  return c.json({ balance, amount: (await getSettings(c.env)).dailyBonus, nextAt: nextZurichMidnight(), unlocked: unlocked.map((a) => a.id) });
});

app.get("/v1/chips/history", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT l.id, l.amount, l.kind, l.game, l.ref, l.created_at, p.name AS counterparty_name
     FROM ledger l LEFT JOIN players p ON p.user_id = l.counterparty
     WHERE l.user_id = ? ORDER BY l.id DESC LIMIT 60`,
  )
    .bind(c.get("player").user_id)
    .all();
  return c.json({ entries: results });
});

app.post("/v1/chips/send", async (c) => {
  const me = c.get("player");
  const { userId, amount } = await c.req.json<{ userId: string; amount: number }>();
  const { minTransfer } = await getSettings(c.env);
  if (!isInt(amount, minTransfer)) return c.json({ error: `Send at least ${minTransfer} chips.` }, 400);
  const [low, high] = pairKey(me.user_id, userId);
  const friendship = await c.env.DB.prepare("SELECT status FROM friendships WHERE user_low = ? AND user_high = ?")
    .bind(low, high)
    .first<{ status: string }>();
  if (friendship?.status !== "accepted") return c.json({ error: "You can only send chips to friends." }, 403);
  const balance = await transfer(c.env, me.user_id, userId, amount);
  if (balance === null) return c.json({ error: "Not enough chips." }, 409);
  await Promise.all([bumpStat(c.env, me.user_id, "chips_sent", amount), notify(c.env, userId, "chips_received", me.user_id, { amount })]);
  const sent = (await getStats(c.env, me.user_id)).chips_sent ?? 0;
  const unlocked = await unlock(c.env, me.user_id, sent >= 10_000 ? ["generous", "patron"] : ["generous"]);
  await checkLive(c.env, userId);
  return c.json({ balance, unlocked: unlocked.map((a) => a.id) });
});

app.post("/v1/presence", async (c) => {
  const { where, table } = await c.req.json<{ where: string; table?: string | null }>();
  if (!PRESENCE_WHERE.has(where)) return c.json({ error: "bad presence" }, 400);
  const safeTable = typeof table === "string" && /^[tp]-[a-z0-9]{6}$/.test(table) ? table : null;
  await c.env.DB.prepare("UPDATE players SET last_seen = ?1, presence_where = ?2, presence_table = ?3 WHERE user_id = ?4")
    .bind(Date.now(), where, safeTable, c.get("player").user_id)
    .run();
  // The ping doubles as the unread check for the message and notification badges.
  return c.json({ ok: true, unread: await unreadCounts(c.env, c.get("player").user_id) });
});

// ── Friends ───────────────────────────────────────────

app.get("/v1/players/search", async (c) => {
  const me = c.get("player").user_id;
  const q = (c.req.query("q") ?? "").trim().toLowerCase();
  if (q.length < 2) return c.json({ players: [] });
  const pattern = `${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
  const { results } = await c.env.DB.prepare(
    `SELECT ${BADGE_COLUMNS}, f.status, f.requested_by
     FROM players p
     LEFT JOIN friendships f ON (f.user_low = min(p.user_id, ?1) AND f.user_high = max(p.user_id, ?1))
     WHERE p.name_lower LIKE ?2 ESCAPE '\\' AND p.user_id <> ?1
     ORDER BY p.name_lower LIMIT 12`,
  )
    .bind(me, pattern)
    .all<Omit<Player, "status"> & { status: string | null; requested_by: string | null }>();
  return c.json({
    players: results.map((r) => ({
      ...badge(r),
      relation: r.status === "accepted" ? "friend" : r.status === "pending" ? (r.requested_by === me ? "requested" : "incoming") : "none",
    })),
  });
});

app.get("/v1/friends", async (c) => {
  const me = c.get("player").user_id;
  const { results } = await c.env.DB.prepare(
    `SELECT f.status, f.requested_by, ${BADGE_COLUMNS}, p.last_seen, p.presence_where, p.presence_table
     FROM friendships f
     JOIN players p ON p.user_id = CASE WHEN f.user_low = ?1 THEN f.user_high ELSE f.user_low END
     WHERE f.user_low = ?1 OR f.user_high = ?1
     ORDER BY p.name_lower`,
  )
    .bind(me)
    .all<Omit<Player, "status"> & { status: string; requested_by: string }>();
  const friends = [];
  const incoming = [];
  const outgoing = [];
  for (const r of results) {
    const person = badge(r);
    if (r.status === "accepted") friends.push({ ...person, presence: presenceOf(r) });
    else if (r.requested_by === me) outgoing.push(person);
    else incoming.push(person);
  }
  // Online friends first, then by name.
  friends.sort((a, b) => Number(b.presence.online) - Number(a.presence.online) || a.name.localeCompare(b.name));
  return c.json({ friends, incoming, outgoing });
});

app.post("/v1/friends/request", async (c) => {
  const me = c.get("player").user_id;
  const { userId } = await c.req.json<{ userId: string }>();
  if (!userId || userId === me) return c.json({ error: "Pick someone else." }, 400);
  if (!(await getPlayer(c.env, userId))) return c.json({ error: "Player not found." }, 404);
  const [low, high] = pairKey(me, userId);
  const existing = await c.env.DB.prepare("SELECT status, requested_by FROM friendships WHERE user_low = ? AND user_high = ?")
    .bind(low, high)
    .first<{ status: string; requested_by: string }>();
  if (existing?.status === "accepted") return c.json({ relation: "friend" });
  if (existing?.status === "pending" && existing.requested_by !== me) {
    // They already asked you: asking back means yes.
    await c.env.DB.prepare("UPDATE friendships SET status = 'accepted' WHERE user_low = ? AND user_high = ?").bind(low, high).run();
    await befriended(c.env, me, userId);
    return c.json({ relation: "friend" });
  }
  const inserted = await c.env.DB.prepare(
    "INSERT OR IGNORE INTO friendships (user_low, user_high, status, requested_by, created_at) VALUES (?, ?, 'pending', ?, ?)",
  )
    .bind(low, high, me, Date.now())
    .run();
  if (inserted.meta.changes) await notify(c.env, userId, "friend_request", me);
  return c.json({ relation: "requested" });
});

/** `me` accepted `other`: tell them, and check friend-count achievements on both sides. */
async function befriended(env: Env, me: string, other: string) {
  await notify(env, other, "friend_accepted", me);
  await Promise.all([checkLive(env, me), checkLive(env, other)]);
}

app.post("/v1/friends/accept", async (c) => {
  const me = c.get("player").user_id;
  const { userId } = await c.req.json<{ userId: string }>();
  const [low, high] = pairKey(me, userId);
  const result = await c.env.DB.prepare(
    "UPDATE friendships SET status = 'accepted' WHERE user_low = ? AND user_high = ? AND status = 'pending' AND requested_by = ?",
  )
    .bind(low, high, userId)
    .run();
  if (!result.meta.changes) return c.json({ error: "No request from this player." }, 404);
  await befriended(c.env, me, userId);
  return c.json({ relation: "friend" });
});

/** Declines a request, cancels your own, or removes a friend. */
app.post("/v1/friends/remove", async (c) => {
  const me = c.get("player").user_id;
  const { userId } = await c.req.json<{ userId: string }>();
  const [low, high] = pairKey(me, userId);
  await c.env.DB.prepare("DELETE FROM friendships WHERE user_low = ? AND user_high = ?").bind(low, high).run();
  return c.json({ relation: "none" });
});

// ── Leaderboard: net chips won at the tables this week ─

app.get("/v1/leaderboard", async (c) => {
  const me = c.get("player").user_id;
  const scope = c.req.query("scope") === "friends" ? "friends" : "all";
  const weekStart = zurichWeekStart();
  const friendsFilter =
    scope === "friends"
      ? `AND (l.user_id = ?2 OR l.user_id IN (
           SELECT CASE WHEN user_low = ?2 THEN user_high ELSE user_low END FROM friendships
           WHERE status = 'accepted' AND (user_low = ?2 OR user_high = ?2)))`
      : "";
  const { results } = await c.env.DB.prepare(
    `SELECT ${BADGE_COLUMNS}, SUM(l.amount) AS net, COUNT(*) AS entries
     FROM ledger l JOIN players p ON p.user_id = l.user_id
     WHERE l.kind = 'game' AND l.created_at >= ?1 ${friendsFilter}
     GROUP BY l.user_id ORDER BY net DESC, p.name_lower ASC LIMIT 50`,
  )
    .bind(...(scope === "friends" ? [weekStart, me] : [weekStart]))
    .all<Player & { net: number }>();
  const rows = results.map((r, i) => ({ rank: i + 1, ...badge(r), net: r.net, isMe: r.user_id === me }));
  return c.json({ scope, weekStart, rows, me: rows.find((r) => r.isMe) ?? null });
});

app.route("/v1", social);
app.route("/admin", admin);

// Profile pictures are public images; the version in the URL makes them cache forever.
app.get("/avatars/:id", async (c) => {
  const row = await c.env.DB.prepare("SELECT data, mime FROM avatars WHERE user_id = ?").bind(c.req.param("id")).first<{ data: ArrayBuffer | number[]; mime: string }>();
  if (!row) return c.json({ error: "not found" }, 404);
  const bytes = row.data instanceof ArrayBuffer ? new Uint8Array(row.data) : new Uint8Array(row.data);
  return new Response(bytes, {
    headers: {
      "Content-Type": row.mime,
      "Cache-Control": c.req.query("v") ? "public, max-age=31536000, immutable" : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

app.get("/health", (c) => c.json({ status: "ok" }));
app.notFound((c) => c.json({ error: "not found" }, 404));
app.onError((error, c) => {
  console.error(error);
  return c.json({ error: "Something went wrong." }, 500);
});

/** Crowns last week's leaderboard winner. Runs hourly on Mondays; each week is only awarded once. */
async function crownLastWeek(env: Env) {
  const thisWeek = zurichWeekStart();
  const lastWeek = zurichWeekStart(thisWeek - 1);
  const done = await env.DB.prepare("SELECT 1 FROM weekly_awards WHERE week_start = ?").bind(lastWeek).first();
  if (done) return;
  const top = await env.DB.prepare(
    `SELECT user_id, SUM(amount) AS net FROM ledger WHERE kind = 'game' AND created_at >= ? AND created_at < ?
     GROUP BY user_id ORDER BY net DESC LIMIT 1`,
  )
    .bind(lastWeek, thisWeek)
    .first<{ user_id: string; net: number }>();
  const winner = top && top.net > 0 ? top.user_id : null;
  const claimed = await env.DB.prepare("INSERT OR IGNORE INTO weekly_awards (week_start, user_id, created_at) VALUES (?, ?, ?)")
    .bind(lastWeek, winner, Date.now())
    .run();
  if (claimed.meta.changes && winner) await unlock(env, winner, ["weekly_top"]);
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(crownLastWeek(env));
    ctx.waitUntil(sweepRounds(env));
  },
} satisfies ExportedHandler<Env>;
