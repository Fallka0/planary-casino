import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, Player } from "./env";
import { nextZurichMidnight, zurichDay, zurichWeekStart } from "./time";
import { claimBonus, credit, DAILY_BONUS, debit, ensurePlayer, getPlayer, MIN_TRANSFER, transfer } from "./wallet";

type Vars = { player: Player };
const app = new Hono<{ Bindings: Env; Variables: Vars }>();

/** Seen within this window counts as online (clients ping every 30 s). */
const ONLINE_MS = 75_000;
const PRESENCE_WHERE = new Set(["lobby", "blackjack", "roulette"]);

const pairKey = (a: string, b: string) => (a < b ? [a, b] : [b, a]);

function cleanName(raw: unknown) {
  return String(raw ?? "")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .trim()
    .slice(0, 24) || "Player";
}

function presenceOf(p: Pick<Player, "last_seen" | "presence_where" | "presence_table">) {
  const online = Date.now() - p.last_seen < ONLINE_MS;
  return { online, where: online ? p.presence_where : null, table: online ? p.presence_table : null };
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
  return c.json({ balance: player.balance });
});

app.post("/internal/debit", async (c) => {
  const { userId, amount, game, ref } = await c.req.json<{ userId: string; amount: number; game: string; ref?: string }>();
  if (!isInt(amount, 1)) return c.json({ error: "bad amount" }, 400);
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
  c.set("player", await ensurePlayer(c.env, user.id, cleanName(user.name || user.email?.split("@")[0])));
  await next();
});

app.get("/v1/me", (c) => {
  const p = c.get("player");
  const available = p.bonus_day !== zurichDay();
  return c.json({
    id: p.user_id,
    name: p.name,
    balance: p.balance,
    bonus: { amount: DAILY_BONUS, available, nextAt: available ? null : nextZurichMidnight() },
  });
});

app.post("/v1/chips/bonus", async (c) => {
  const balance = await claimBonus(c.env, c.get("player").user_id);
  if (balance === null) return c.json({ error: "Today's bonus is already claimed.", nextAt: nextZurichMidnight() }, 409);
  return c.json({ balance, amount: DAILY_BONUS, nextAt: nextZurichMidnight() });
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
  if (!isInt(amount, MIN_TRANSFER)) return c.json({ error: `Send at least ${MIN_TRANSFER} chips.` }, 400);
  const [low, high] = pairKey(me.user_id, userId);
  const friendship = await c.env.DB.prepare("SELECT status FROM friendships WHERE user_low = ? AND user_high = ?")
    .bind(low, high)
    .first<{ status: string }>();
  if (friendship?.status !== "accepted") return c.json({ error: "You can only send chips to friends." }, 403);
  const balance = await transfer(c.env, me.user_id, userId, amount);
  if (balance === null) return c.json({ error: "Not enough chips." }, 409);
  return c.json({ balance });
});

app.post("/v1/presence", async (c) => {
  const { where, table } = await c.req.json<{ where: string; table?: string | null }>();
  if (!PRESENCE_WHERE.has(where)) return c.json({ error: "bad presence" }, 400);
  const safeTable = typeof table === "string" && /^[tp]-[a-z0-9]{6}$/.test(table) ? table : null;
  await c.env.DB.prepare("UPDATE players SET last_seen = ?1, presence_where = ?2, presence_table = ?3 WHERE user_id = ?4")
    .bind(Date.now(), where, safeTable, c.get("player").user_id)
    .run();
  return c.json({ ok: true });
});

// ── Friends ───────────────────────────────────────────

app.get("/v1/players/search", async (c) => {
  const me = c.get("player").user_id;
  const q = (c.req.query("q") ?? "").trim().toLowerCase();
  if (q.length < 2) return c.json({ players: [] });
  const pattern = `${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
  const { results } = await c.env.DB.prepare(
    `SELECT p.user_id, p.name, f.status, f.requested_by
     FROM players p
     LEFT JOIN friendships f ON (f.user_low = min(p.user_id, ?1) AND f.user_high = max(p.user_id, ?1))
     WHERE p.name_lower LIKE ?2 ESCAPE '\\' AND p.user_id <> ?1
     ORDER BY p.name_lower LIMIT 12`,
  )
    .bind(me, pattern)
    .all<{ user_id: string; name: string; status: string | null; requested_by: string | null }>();
  return c.json({
    players: results.map((r) => ({
      id: r.user_id,
      name: r.name,
      relation: r.status === "accepted" ? "friend" : r.status === "pending" ? (r.requested_by === me ? "requested" : "incoming") : "none",
    })),
  });
});

app.get("/v1/friends", async (c) => {
  const me = c.get("player").user_id;
  const { results } = await c.env.DB.prepare(
    `SELECT f.status, f.requested_by, p.user_id, p.name, p.last_seen, p.presence_where, p.presence_table
     FROM friendships f
     JOIN players p ON p.user_id = CASE WHEN f.user_low = ?1 THEN f.user_high ELSE f.user_low END
     WHERE f.user_low = ?1 OR f.user_high = ?1
     ORDER BY p.name_lower`,
  )
    .bind(me)
    .all<Player & { status: string; requested_by: string }>();
  const friends = [];
  const incoming = [];
  const outgoing = [];
  for (const r of results) {
    const person = { id: r.user_id, name: r.name };
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
    return c.json({ relation: "friend" });
  }
  await c.env.DB.prepare(
    "INSERT OR IGNORE INTO friendships (user_low, user_high, status, requested_by, created_at) VALUES (?, ?, 'pending', ?, ?)",
  )
    .bind(low, high, me, Date.now())
    .run();
  return c.json({ relation: "requested" });
});

app.post("/v1/friends/accept", async (c) => {
  const me = c.get("player").user_id;
  const { userId } = await c.req.json<{ userId: string }>();
  const [low, high] = pairKey(me, userId);
  const result = await c.env.DB.prepare(
    "UPDATE friendships SET status = 'accepted' WHERE user_low = ? AND user_high = ? AND status = 'pending' AND requested_by = ?",
  )
    .bind(low, high, userId)
    .run();
  return result.meta.changes ? c.json({ relation: "friend" }) : c.json({ error: "No request from this player." }, 404);
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
    `SELECT l.user_id, p.name, SUM(l.amount) AS net, COUNT(*) AS entries
     FROM ledger l JOIN players p ON p.user_id = l.user_id
     WHERE l.kind = 'game' AND l.created_at >= ?1 ${friendsFilter}
     GROUP BY l.user_id ORDER BY net DESC, p.name_lower ASC LIMIT 50`,
  )
    .bind(...(scope === "friends" ? [weekStart, me] : [weekStart]))
    .all<{ user_id: string; name: string; net: number }>();
  const rows = results.map((r, i) => ({ rank: i + 1, id: r.user_id, name: r.name, net: r.net, isMe: r.user_id === me }));
  return c.json({ scope, weekStart, rows, me: rows.find((r) => r.isMe) ?? null });
});

app.get("/health", (c) => c.json({ status: "ok" }));
app.notFound((c) => c.json({ error: "not found" }, 404));
app.onError((error, c) => {
  console.error(error);
  return c.json({ error: "Something went wrong." }, 500);
});

export default app;
