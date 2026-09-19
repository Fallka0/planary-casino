// Operator API for admin.planary.ch. Staff only; every change lands in the audit log.

import { Hono } from "hono";
import { cors } from "hono/cors";
import { achievementsOf, getStats } from "./achievements";
import { CATALOG, ITEMS } from "./catalog";
import type { Env, Player } from "./env";
import { notify } from "./notify";
import { blockedReason, dailyLoss, DEFAULT_SETTINGS, gameStatus, getSettings, isMuted, shopOverrides } from "./policy";
import { badge, presenceOf } from "./social";
import { zurichDay, zurichDayStart } from "./time";

export type Role = "owner" | "manager" | "support" | "viewer";
type Permission = "view" | "note" | "moderate" | "restrict" | "chips" | "games" | "economy" | "announce" | "audit" | "staff";

const ROLES: Record<Role, Permission[]> = {
  viewer: ["view"],
  support: ["view", "note", "moderate"],
  manager: ["view", "note", "moderate", "restrict", "chips", "games", "economy", "announce", "audit"],
  owner: ["view", "note", "moderate", "restrict", "chips", "games", "economy", "announce", "audit", "staff"],
};

const GAMES = ["blackjack", "roulette"] as const;
/** Long-run return to player of each game under its house rules (blackjack with basic strategy). */
const THEORETICAL_RTP: Record<string, number> = { blackjack: 0.995, roulette: 36 / 37 };
const ONLINE_MS = 75_000;
const DAY = 86_400_000;

interface Staff {
  user_id: string;
  email: string;
  name: string;
  role: Role;
}
type Vars = { staff: Staff };
export const admin = new Hono<{ Bindings: Env; Variables: Vars }>();

admin.use(
  "*",
  cors({
    origin: (origin, c) =>
      (c.env.ADMIN_ORIGINS ?? "")
        .split(",")
        .map((o: string) => o.trim())
        .includes(origin)
        ? origin
        : null,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Authorization", "Content-Type"],
    maxAge: 86400,
  }),
);

admin.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") return next();
  const authorization = c.req.header("authorization");
  if (!authorization) return c.json({ error: "Sign in first." }, 401);
  const res = await c.env.AUTH.fetch(new Request("https://auth.internal/api/auth/me", { headers: { Authorization: authorization } }));
  if (!res.ok) return c.json({ error: "Sign in first." }, 401);
  const { user } = (await res.json()) as { user: { id: string; name?: string; email?: string } };
  const email = (user.email ?? "").toLowerCase();
  const name = user.name || email.split("@")[0] || "Staff";

  let staff = await c.env.DB.prepare("SELECT user_id, email, name, role FROM staff WHERE user_id = ?").bind(user.id).first<Staff>();
  // The owner named in the config claims the panel the first time, while nobody owns it.
  if (!staff && email && email === (c.env.OWNER_EMAIL ?? "").toLowerCase()) {
    const owner = await c.env.DB.prepare("SELECT 1 FROM staff WHERE role = 'owner'").first();
    if (!owner) {
      await c.env.DB.prepare("INSERT INTO staff (user_id, email, name, role, created_at) VALUES (?, ?, ?, 'owner', ?)").bind(user.id, email, name, Date.now()).run();
      staff = { user_id: user.id, email, name, role: "owner" };
      await audit(c.env, staff, "staff.bootstrap", user.id, { role: "owner" });
    }
  }
  if (!staff) return c.json({ error: "This account doesn't have access to the admin panel.", code: "not_staff" }, 403);
  if (staff.email !== email || staff.name !== name) {
    await c.env.DB.prepare("UPDATE staff SET email = ?, name = ? WHERE user_id = ?").bind(email, name, user.id).run();
    staff = { ...staff, email, name };
  }
  c.set("staff", staff);
  await next();
});

function can(staff: Staff, permission: Permission) {
  return ROLES[staff.role]?.includes(permission) ?? false;
}

function denied() {
  return { error: "Your role can't do that." };
}

async function audit(env: Env, staff: Staff, action: string, targetId: string | null, details: unknown) {
  await env.DB.prepare("INSERT INTO audit_log (staff_id, staff_name, action, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(staff.user_id, staff.name, action, targetId, JSON.stringify(details ?? null), Date.now())
    .run();
}

function int(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function text(value: unknown, max: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
}

function statusOf(p: Player) {
  const now = Date.now();
  if (p.status === "banned") return "banned";
  if (p.status === "suspended" && (!p.status_until || p.status_until > now)) return "suspended";
  if (p.excluded_until && p.excluded_until > now) return "excluded";
  return "active";
}

/** Offset of Zurich from UTC right now, in seconds, for grouping ledger rows by Zurich day. */
function zurichOffsetSeconds() {
  const [y, m, d] = zurichDay().split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - zurichDayStart()) / 1000);
}

// ── Who am I ─────────────────────────────────────────

admin.get("/me", (c) => {
  const staff = c.get("staff");
  return c.json({ id: staff.user_id, name: staff.name, email: staff.email, role: staff.role, permissions: ROLES[staff.role] });
});

// ── Overview ─────────────────────────────────────────

async function gameFigures(env: Env, from: number, game?: string) {
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(CASE WHEN amount < 0 THEN -amount END), 0) AS handle,
            COALESCE(SUM(CASE WHEN amount > 0 THEN amount END), 0) AS payouts,
            COUNT(CASE WHEN amount < 0 THEN 1 END) AS bets,
            COUNT(DISTINCT user_id) AS players
     FROM ledger WHERE kind = 'game' AND created_at >= ?1 ${game ? "AND game = ?2" : ""}`,
  )
    .bind(...(game ? [from, game] : [from]))
    .first<{ handle: number; payouts: number; bets: number; players: number }>();
  const handle = row?.handle ?? 0;
  const payouts = row?.payouts ?? 0;
  return { handle, payouts, ggr: handle - payouts, rtp: handle ? payouts / handle : null, bets: row?.bets ?? 0, players: row?.players ?? 0 };
}

admin.get("/overview", async (c) => {
  const days = Math.min(90, Math.max(7, Number(c.req.query("days")) || 30));
  const today = zurichDayStart();
  const since = today - (days - 1) * DAY;
  const off = zurichOffsetSeconds();
  const now = Date.now();

  const [totals, todayFig, weekFig, periodFig, issued, sink, series, signups, perGame] = await Promise.all([
    c.env.DB.prepare(
      `SELECT COUNT(*) AS players, COALESCE(SUM(balance), 0) AS circulation,
              COUNT(CASE WHEN last_seen > ?1 THEN 1 END) AS online,
              COUNT(CASE WHEN created_at >= ?2 THEN 1 END) AS new_today,
              COUNT(CASE WHEN created_at >= ?3 THEN 1 END) AS new_week,
              COUNT(CASE WHEN status <> 'active' THEN 1 END) AS restricted
       FROM players`,
    )
      .bind(now - ONLINE_MS, today, today - 6 * DAY)
      .first<{ players: number; circulation: number; online: number; new_today: number; new_week: number; restricted: number }>(),
    gameFigures(c.env, today),
    gameFigures(c.env, today - 6 * DAY),
    gameFigures(c.env, since),
    c.env.DB.prepare(
      `SELECT COALESCE(SUM(CASE WHEN kind = 'starter' THEN amount END), 0) AS starter,
              COALESCE(SUM(CASE WHEN kind = 'bonus' THEN amount END), 0) AS bonus,
              COALESCE(SUM(CASE WHEN kind = 'adjustment' THEN amount END), 0) AS adjustments
       FROM ledger WHERE created_at >= ?`,
    )
      .bind(since)
      .first<{ starter: number; bonus: number; adjustments: number }>(),
    c.env.DB.prepare("SELECT COALESCE(-SUM(amount), 0) AS spent FROM ledger WHERE kind = 'shop' AND created_at >= ?").bind(since).first<{ spent: number }>(),
    c.env.DB.prepare(
      `SELECT date((created_at / 1000) + ?2, 'unixepoch') AS day,
              COALESCE(SUM(CASE WHEN amount < 0 THEN -amount END), 0) AS handle,
              COALESCE(SUM(CASE WHEN amount > 0 THEN amount END), 0) AS payouts,
              COUNT(DISTINCT user_id) AS players
       FROM ledger WHERE kind = 'game' AND created_at >= ?1 GROUP BY day ORDER BY day`,
    )
      .bind(since, off)
      .all<{ day: string; handle: number; payouts: number; players: number }>(),
    c.env.DB.prepare(`SELECT date((created_at / 1000) + ?2, 'unixepoch') AS day, COUNT(*) AS n FROM players WHERE created_at >= ?1 GROUP BY day`)
      .bind(since, off)
      .all<{ day: string; n: number }>(),
    Promise.all(GAMES.map(async (g) => ({ game: g, ...(await gameFigures(c.env, since, g)), theoretical: THEORETICAL_RTP[g] }))),
  ]);

  const byDay = new Map(series.results.map((r) => [r.day, r]));
  const newByDay = new Map(signups.results.map((r) => [r.day, r.n]));
  const daily = Array.from({ length: days }, (_, i) => {
    const day = new Date(since + i * DAY + off * 1000).toISOString().slice(0, 10);
    const r = byDay.get(day);
    return { day, handle: r?.handle ?? 0, ggr: (r?.handle ?? 0) - (r?.payouts ?? 0), players: r?.players ?? 0, signups: newByDay.get(day) ?? 0 };
  });

  return c.json({
    days,
    players: totals,
    today: todayFig,
    week: weekFig,
    period: periodFig,
    issued: { ...issued, spentInShop: sink?.spent ?? 0 },
    perGame,
    daily,
  });
});

// ── Players ──────────────────────────────────────────

admin.get("/players", async (c) => {
  const q = text(c.req.query("q"), 60).toLowerCase();
  const sort = c.req.query("sort") ?? "recent";
  const status = c.req.query("status") ?? "all";
  const page = Math.max(0, Number(c.req.query("page")) || 0);
  const order =
    sort === "balance" ? "balance DESC" : sort === "joined" ? "created_at DESC" : sort === "name" ? "name_lower ASC" : "last_seen DESC, created_at DESC";
  const where: string[] = [];
  const binds: unknown[] = [];
  if (q) {
    where.push("(name_lower LIKE ? ESCAPE '\\' OR user_id = ?)");
    binds.push(`%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`, q);
  }
  if (status === "restricted") where.push("(status <> 'active' OR (excluded_until IS NOT NULL AND excluded_until > ?))"), binds.push(Date.now());
  if (status === "muted") where.push("muted_until > ?"), binds.push(Date.now());
  if (status === "online") where.push("last_seen > ?"), binds.push(Date.now() - ONLINE_MS);
  const sql = `SELECT * FROM players ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY ${order} LIMIT 51 OFFSET ?`;
  const { results } = await c.env.DB.prepare(sql)
    .bind(...binds, page * 50)
    .all<Player>();
  return c.json({
    page,
    more: results.length > 50,
    players: results.slice(0, 50).map((p) => ({
      ...badge(p),
      balance: p.balance,
      status: statusOf(p),
      muted: isMuted(p),
      online: presenceOf(p).online,
      lastSeen: p.last_seen || null,
      joinedAt: p.created_at,
    })),
  });
});

admin.get("/players/:id", async (c) => {
  const id = c.req.param("id");
  const p = await c.env.DB.prepare("SELECT * FROM players WHERE user_id = ?").bind(id).first<Player>();
  if (!p) return c.json({ error: "Player not found." }, 404);
  const [life, stats, owned, notes, ledger, trail, friends, items, lossToday] = await Promise.all([
    c.env.DB.prepare(
      `SELECT COALESCE(SUM(CASE WHEN kind = 'game' AND amount < 0 THEN -amount END), 0) AS wagered,
              COALESCE(SUM(CASE WHEN kind = 'game' AND amount > 0 THEN amount END), 0) AS won,
              COALESCE(SUM(CASE WHEN kind IN ('starter', 'bonus') THEN amount END), 0) AS free,
              COALESCE(SUM(CASE WHEN kind = 'transfer_in' THEN amount END), 0) AS received,
              COALESCE(-SUM(CASE WHEN kind = 'transfer_out' THEN amount END), 0) AS sent,
              COALESCE(-SUM(CASE WHEN kind = 'shop' THEN amount END), 0) AS shop,
              COALESCE(SUM(CASE WHEN kind = 'adjustment' THEN amount END), 0) AS adjustments
       FROM ledger WHERE user_id = ?`,
    )
      .bind(id)
      .first<Record<string, number>>(),
    getStats(c.env, id),
    achievementsOf(c.env, id),
    c.env.DB.prepare("SELECT id, staff_name, body, created_at FROM staff_notes WHERE user_id = ? ORDER BY id DESC LIMIT 50").bind(id).all(),
    c.env.DB.prepare(
      `SELECT l.id, l.amount, l.kind, l.game, l.ref, l.created_at, cp.name AS counterparty_name
       FROM ledger l LEFT JOIN players cp ON cp.user_id = l.counterparty WHERE l.user_id = ? ORDER BY l.id DESC LIMIT 50`,
    )
      .bind(id)
      .all(),
    c.env.DB.prepare("SELECT id, staff_name, action, details, created_at FROM audit_log WHERE target_id = ? ORDER BY id DESC LIMIT 30").bind(id).all(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM friendships WHERE status = 'accepted' AND (user_low = ?1 OR user_high = ?1)").bind(id).first<{ n: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS n FROM inventory WHERE user_id = ?").bind(id).first<{ n: number }>(),
    dailyLoss(c.env, id),
  ]);
  return c.json({
    ...badge(p),
    balance: p.balance,
    bio: p.bio,
    joinedAt: p.created_at,
    presence: presenceOf(p),
    lastSeen: p.last_seen || null,
    status: statusOf(p),
    blockedReason: blockedReason(p),
    account: { status: p.status, until: p.status_until, reason: p.status_reason },
    mutedUntil: isMuted(p) ? p.muted_until : null,
    limits: { lossLimit: p.loss_limit, excludedUntil: p.excluded_until, lossToday },
    lifetime: { ...life, net: (life?.won ?? 0) - (life?.wagered ?? 0) },
    stats,
    achievements: owned.size,
    friends: friends?.n ?? 0,
    items: items?.n ?? 0,
    notes: notes.results,
    ledger: ledger.results,
    audit: trail.results,
  });
});

admin.get("/players/:id/ledger", async (c) => {
  const id = c.req.param("id");
  const before = Number(c.req.query("before")) || Number.MAX_SAFE_INTEGER;
  const { results } = await c.env.DB.prepare(
    `SELECT l.id, l.amount, l.kind, l.game, l.ref, l.created_at, cp.name AS counterparty_name
     FROM ledger l LEFT JOIN players cp ON cp.user_id = l.counterparty WHERE l.user_id = ? AND l.id < ? ORDER BY l.id DESC LIMIT 100`,
  )
    .bind(id, before)
    .all();
  return c.json({ entries: results });
});

admin.post("/players/:id/adjust", async (c) => {
  const staff = c.get("staff");
  if (!can(staff, "chips")) return c.json(denied(), 403);
  const id = c.req.param("id");
  const body = await c.req.json<{ amount: number; reason: string }>();
  const amount = int(body.amount, -10_000_000, 10_000_000);
  const reason = text(body.reason, 200);
  if (!amount) return c.json({ error: "Enter a whole number of chips, not zero." }, 400);
  if (reason.length < 3) return c.json({ error: "Give a reason; it's kept with the change." }, 400);
  const t = Date.now();
  const [update] = await c.env.DB.batch([
    amount > 0
      ? c.env.DB.prepare("UPDATE players SET balance = balance + ?1 WHERE user_id = ?2").bind(amount, id)
      : c.env.DB.prepare("UPDATE players SET balance = balance + ?1 WHERE user_id = ?2 AND balance >= ?3").bind(amount, id, -amount),
    c.env.DB.prepare("INSERT INTO ledger (user_id, amount, kind, ref, created_at) SELECT ?1, ?2, 'adjustment', ?3, ?4 WHERE changes() = 1").bind(
      id,
      amount,
      `${staff.name}: ${reason}`,
      t,
    ),
  ]);
  if (!update.meta.changes) return c.json({ error: amount < 0 ? "The player doesn't have that many chips." : "Player not found." }, 409);
  await audit(c.env, staff, "chips.adjust", id, { amount, reason });
  await notify(c.env, id, "staff", null, { text: `Your balance was ${amount > 0 ? "credited" : "debited"} ${Math.abs(amount).toLocaleString("de-CH")} chips: ${reason}` });
  const p = await c.env.DB.prepare("SELECT balance FROM players WHERE user_id = ?").bind(id).first<{ balance: number }>();
  return c.json({ balance: p?.balance ?? 0 });
});

admin.post("/players/:id/status", async (c) => {
  const staff = c.get("staff");
  if (!can(staff, "restrict")) return c.json(denied(), 403);
  const id = c.req.param("id");
  const body = await c.req.json<{ status: "active" | "suspended" | "banned"; until?: number | null; reason?: string }>();
  if (!["active", "suspended", "banned"].includes(body.status)) return c.json({ error: "Unknown status." }, 400);
  const until = body.status === "suspended" ? int(body.until, Date.now(), Date.now() + 3650 * DAY) : null;
  if (body.status === "suspended" && !until) return c.json({ error: "Pick an end date in the future." }, 400);
  const reason = body.status === "active" ? null : text(body.reason, 200) || null;
  if (body.status !== "active" && !reason) return c.json({ error: "Give a reason; the player sees it." }, 400);
  if (await c.env.DB.prepare("SELECT 1 FROM staff WHERE user_id = ?").bind(id).first()) return c.json({ error: "Remove their staff access first." }, 400);
  const res = await c.env.DB.prepare("UPDATE players SET status = ?, status_until = ?, status_reason = ? WHERE user_id = ?").bind(body.status, until, reason, id).run();
  if (!res.meta.changes) return c.json({ error: "Player not found." }, 404);
  await audit(c.env, staff, `account.${body.status}`, id, { until, reason });
  return c.json({ ok: true });
});

admin.post("/players/:id/mute", async (c) => {
  const staff = c.get("staff");
  if (!can(staff, "moderate")) return c.json(denied(), 403);
  const id = c.req.param("id");
  const body = await c.req.json<{ until: number | null; reason?: string }>();
  const until = body.until === null ? null : int(body.until, Date.now(), Date.now() + 3650 * DAY);
  if (body.until !== null && !until) return c.json({ error: "Pick an end date in the future." }, 400);
  await c.env.DB.prepare("UPDATE players SET muted_until = ? WHERE user_id = ?").bind(until, id).run();
  await audit(c.env, staff, until ? "chat.mute" : "chat.unmute", id, { until, reason: text(body.reason, 200) || null });
  return c.json({ ok: true });
});

admin.post("/players/:id/limits", async (c) => {
  const staff = c.get("staff");
  if (!can(staff, "restrict")) return c.json(denied(), 403);
  const id = c.req.param("id");
  const body = await c.req.json<{ lossLimit: number | null; excludedUntil: number | null; reason?: string }>();
  const lossLimit = body.lossLimit === null ? null : int(body.lossLimit, 0, 100_000_000);
  if (body.lossLimit !== null && lossLimit === null) return c.json({ error: "The loss limit must be a whole number of chips." }, 400);
  const excludedUntil = body.excludedUntil === null ? null : int(body.excludedUntil, Date.now(), Date.now() + 3650 * DAY);
  if (body.excludedUntil !== null && !excludedUntil) return c.json({ error: "Pick an end date in the future." }, 400);
  await c.env.DB.prepare("UPDATE players SET loss_limit = ?, excluded_until = ? WHERE user_id = ?").bind(lossLimit, excludedUntil, id).run();
  await audit(c.env, staff, "limits.set", id, { lossLimit, excludedUntil, reason: text(body.reason, 200) || null });
  return c.json({ ok: true });
});

admin.post("/players/:id/avatar/remove", async (c) => {
  const staff = c.get("staff");
  if (!can(staff, "moderate")) return c.json(denied(), 403);
  const id = c.req.param("id");
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM avatars WHERE user_id = ?").bind(id),
    c.env.DB.prepare("UPDATE players SET avatar_version = 0 WHERE user_id = ?").bind(id),
  ]);
  await audit(c.env, staff, "avatar.remove", id, null);
  await notify(c.env, id, "staff", null, { text: "Your profile picture was removed because it broke the house rules." });
  return c.json({ ok: true });
});

admin.post("/players/:id/bio/remove", async (c) => {
  const staff = c.get("staff");
  if (!can(staff, "moderate")) return c.json(denied(), 403);
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE players SET bio = NULL WHERE user_id = ?").bind(id).run();
  await audit(c.env, staff, "bio.remove", id, null);
  return c.json({ ok: true });
});

admin.post("/players/:id/notes", async (c) => {
  const staff = c.get("staff");
  if (!can(staff, "note")) return c.json(denied(), 403);
  const id = c.req.param("id");
  const body = text((await c.req.json<{ body: string }>()).body, 2000);
  if (!body) return c.json({ error: "Write the note first." }, 400);
  await c.env.DB.prepare("INSERT INTO staff_notes (user_id, staff_id, staff_name, body, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(id, staff.user_id, staff.name, body, Date.now())
    .run();
  await audit(c.env, staff, "note.add", id, null);
  return c.json({ ok: true });
});

/** A player's conversations. Reading them is logged. */
admin.get("/players/:id/messages", async (c) => {
  const staff = c.get("staff");
  if (!can(staff, "moderate")) return c.json(denied(), 403);
  const id = c.req.param("id");
  const other = c.req.query("with");
  if (!other) {
    const { results } = await c.env.DB.prepare(
      `SELECT p.user_id, p.name, p.avatar_version, p.border, p.title, COUNT(*) AS n, MAX(m.created_at) AS last
       FROM messages m JOIN players p ON p.user_id = CASE WHEN m.sender_id = ?1 THEN m.recipient_id ELSE m.sender_id END
       WHERE m.sender_id = ?1 OR m.recipient_id = ?1 GROUP BY p.user_id ORDER BY last DESC LIMIT 50`,
    )
      .bind(id)
      .all<Player & { n: number; last: number }>();
    return c.json({ conversations: results.map((r) => ({ with: badge(r), count: r.n, last: r.last })) });
  }
  const { results } = await c.env.DB.prepare(
    `SELECT id, sender_id, body, created_at FROM messages
     WHERE (sender_id = ?1 AND recipient_id = ?2) OR (sender_id = ?2 AND recipient_id = ?1) ORDER BY id DESC LIMIT 200`,
  )
    .bind(id, other)
    .all<{ id: number; sender_id: string; body: string; created_at: number }>();
  await audit(c.env, staff, "messages.read", id, { with: other });
  return c.json({ messages: results.reverse().map((m) => ({ id: m.id, fromPlayer: m.sender_id === id, body: m.body, at: m.created_at })) });
});

// ── Transactions ─────────────────────────────────────

admin.get("/ledger", async (c) => {
  const where: string[] = [];
  const binds: unknown[] = [];
  const kind = c.req.query("kind");
  const game = c.req.query("game");
  const user = c.req.query("user");
  const from = Number(c.req.query("from")) || 0;
  const to = Number(c.req.query("to")) || 0;
  const min = Number(c.req.query("min")) || 0;
  const before = Number(c.req.query("before")) || 0;
  if (kind) where.push("l.kind = ?"), binds.push(kind);
  if (game) where.push("l.game = ?"), binds.push(game);
  if (user) where.push("l.user_id = ?"), binds.push(user);
  if (from) where.push("l.created_at >= ?"), binds.push(from);
  if (to) where.push("l.created_at < ?"), binds.push(to);
  if (min) where.push("ABS(l.amount) >= ?"), binds.push(min);
  if (before) where.push("l.id < ?"), binds.push(before);
  const { results } = await c.env.DB.prepare(
    `SELECT l.id, l.user_id, p.name, l.amount, l.kind, l.game, l.ref, l.created_at, cp.name AS counterparty_name
     FROM ledger l JOIN players p ON p.user_id = l.user_id LEFT JOIN players cp ON cp.user_id = l.counterparty
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY l.id DESC LIMIT 201`,
  )
    .bind(...binds)
    .all();
  return c.json({ entries: results.slice(0, 200), more: results.length > 200 });
});

// ── Games ────────────────────────────────────────────

admin.get("/games", async (c) => {
  const today = zurichDayStart();
  const status = await gameStatus(c.env);
  const { results: seated } = await c.env.DB.prepare(
    `SELECT user_id, name, avatar_version, border, title, presence_where, presence_table FROM players
     WHERE last_seen > ? AND presence_where IN ('blackjack', 'roulette') ORDER BY presence_table`,
  )
    .bind(Date.now() - ONLINE_MS)
    .all<Player>();
  const games = await Promise.all(
    GAMES.map(async (g) => {
      const [day, week, month] = await Promise.all([gameFigures(c.env, today, g), gameFigures(c.env, today - 6 * DAY, g), gameFigures(c.env, today - 29 * DAY, g)]);
      const tables = new Map<string, ReturnType<typeof badge>[]>();
      for (const p of seated.filter((s) => s.presence_where === g)) {
        const key = p.presence_table ?? "lobby";
        tables.set(key, [...(tables.get(key) ?? []), badge(p)]);
      }
      const s = status.get(g);
      return {
        game: g,
        status: s?.status ?? "open",
        note: s?.note ?? null,
        theoretical: THEORETICAL_RTP[g],
        today: day,
        week,
        month,
        tables: [...tables].map(([id, players]) => ({ id, players })),
      };
    }),
  );
  return c.json({ games });
});

admin.post("/games/:game", async (c) => {
  const staff = c.get("staff");
  if (!can(staff, "games")) return c.json(denied(), 403);
  const game = c.req.param("game");
  if (!GAMES.includes(game as (typeof GAMES)[number])) return c.json({ error: "Unknown game." }, 404);
  const body = await c.req.json<{ status: "open" | "maintenance"; note?: string }>();
  if (body.status !== "open" && body.status !== "maintenance") return c.json({ error: "Unknown status." }, 400);
  const note = text(body.note, 200) || null;
  await c.env.DB.prepare(
    "INSERT INTO game_settings (game, status, note, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (game) DO UPDATE SET status = ?2, note = ?3, updated_at = ?4",
  )
    .bind(game, body.status, note, Date.now())
    .run();
  await audit(c.env, staff, `game.${body.status}`, game, { note });
  return c.json({ ok: true });
});

// ── Economy: settings and shop ───────────────────────

admin.get("/economy", async (c) => {
  const [settings, overrides, owners, revenue] = await Promise.all([
    getSettings(c.env, true),
    shopOverrides(c.env),
    c.env.DB.prepare("SELECT item_id, COUNT(*) AS n FROM inventory GROUP BY item_id").all<{ item_id: string; n: number }>(),
    c.env.DB.prepare("SELECT ref AS item_id, COALESCE(-SUM(amount), 0) AS chips FROM ledger WHERE kind = 'shop' GROUP BY ref").all<{ item_id: string; chips: number }>(),
  ]);
  const ownedBy = new Map(owners.results.map((r) => [r.item_id, r.n]));
  const earned = new Map(revenue.results.map((r) => [r.item_id, r.chips]));
  return c.json({
    settings,
    defaults: DEFAULT_SETTINGS,
    items: CATALOG.map((item) => ({
      ...item,
      basePrice: item.price,
      price: item.price === null ? null : (overrides.get(item.id)?.price ?? item.price),
      enabled: overrides.get(item.id)?.enabled !== 0,
      owners: ownedBy.get(item.id) ?? 0,
      revenue: earned.get(item.id) ?? 0,
    })),
  });
});

const SETTING_RANGES: Record<keyof typeof DEFAULT_SETTINGS, [number, number]> = {
  starterChips: [0, 1_000_000],
  dailyBonus: [0, 1_000_000],
  minTransfer: [1, 100_000],
};

admin.post("/settings", async (c) => {
  const staff = c.get("staff");
  if (!can(staff, "economy")) return c.json(denied(), 403);
  const body = await c.req.json<Partial<Record<keyof typeof DEFAULT_SETTINGS, number>>>();
  const changes: Record<string, number> = {};
  for (const [key, [min, max]] of Object.entries(SETTING_RANGES)) {
    const value = body[key as keyof typeof DEFAULT_SETTINGS];
    if (value === undefined) continue;
    const ok = int(value, min, max);
    if (ok === null) return c.json({ error: `${key} must be a whole number from ${min} to ${max}.` }, 400);
    changes[key] = ok;
  }
  const before = await getSettings(c.env, true);
  await c.env.DB.batch(
    Object.entries(changes).map(([key, value]) =>
      c.env.DB.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT (key) DO UPDATE SET value = ?2, updated_at = ?3").bind(
        key,
        JSON.stringify(value),
        Date.now(),
      ),
    ),
  );
  await audit(c.env, staff, "settings.update", null, { before, after: { ...before, ...changes } });
  return c.json({ settings: await getSettings(c.env, true) });
});

admin.post("/shop/:itemId", async (c) => {
  const staff = c.get("staff");
  if (!can(staff, "economy")) return c.json(denied(), 403);
  const item = ITEMS.get(c.req.param("itemId"));
  if (!item) return c.json({ error: "Unknown item." }, 404);
  const body = await c.req.json<{ price?: number | null; enabled?: boolean }>();
  const current = (await shopOverrides(c.env)).get(item.id);
  let price = current?.price ?? null;
  if (body.price !== undefined) {
    if (item.price === null) return c.json({ error: "Reward items have no price." }, 400);
    price = body.price === null ? null : int(body.price, 1, 10_000_000);
    if (body.price !== null && price === null) return c.json({ error: "Price must be a whole number of chips." }, 400);
  }
  const enabled = body.enabled === undefined ? (current?.enabled ?? 1) : body.enabled ? 1 : 0;
  await c.env.DB.prepare(
    "INSERT INTO shop_overrides (item_id, price, enabled, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (item_id) DO UPDATE SET price = ?2, enabled = ?3, updated_at = ?4",
  )
    .bind(item.id, price, enabled, Date.now())
    .run();
  await audit(c.env, staff, "shop.update", item.id, { price, enabled: Boolean(enabled) });
  return c.json({ ok: true });
});

// ── Moderation ───────────────────────────────────────

admin.get("/moderation", async (c) => {
  const now = Date.now();
  const [avatars, bios, restricted] = await Promise.all([
    c.env.DB.prepare(
      `SELECT p.user_id, p.name, p.avatar_version, p.border, p.title, a.updated_at FROM avatars a JOIN players p ON p.user_id = a.user_id
       ORDER BY a.updated_at DESC LIMIT 60`,
    ).all<Player & { updated_at: number }>(),
    c.env.DB.prepare("SELECT user_id, name, avatar_version, border, title, bio FROM players WHERE bio IS NOT NULL ORDER BY last_seen DESC LIMIT 40").all<Player>(),
    c.env.DB.prepare(
      `SELECT * FROM players WHERE status <> 'active' OR muted_until > ?1 OR excluded_until > ?1 OR loss_limit IS NOT NULL ORDER BY last_seen DESC LIMIT 100`,
    )
      .bind(now)
      .all<Player>(),
  ]);
  return c.json({
    avatars: avatars.results.map((r) => ({ ...badge(r), updatedAt: r.updated_at })),
    bios: bios.results.map((r) => ({ ...badge(r), bio: r.bio })),
    restricted: restricted.results.map((p) => ({
      ...badge(p),
      status: statusOf(p),
      mutedUntil: isMuted(p) ? p.muted_until : null,
      statusUntil: p.status_until,
      reason: p.status_reason,
      lossLimit: p.loss_limit,
      excludedUntil: p.excluded_until,
    })),
  });
});

// ── Announcements ────────────────────────────────────

admin.get("/announcements", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, staff_name, details, created_at FROM audit_log WHERE action = 'announcement.send' ORDER BY id DESC LIMIT 30").all<{
    id: number;
    staff_name: string;
    details: string;
    created_at: number;
  }>();
  return c.json({ announcements: results.map((r) => ({ id: r.id, by: r.staff_name, at: r.created_at, ...JSON.parse(r.details) })) });
});

admin.post("/announcements", async (c) => {
  const staff = c.get("staff");
  if (!can(staff, "announce")) return c.json(denied(), 403);
  const body = await c.req.json<{ title: string; body: string }>();
  const title = text(body.title, 80);
  const message = text(body.body, 500);
  if (!title || !message) return c.json({ error: "Write a title and a message." }, 400);
  const res = await c.env.DB.prepare(
    "INSERT INTO notifications (user_id, kind, actor_id, data, created_at) SELECT user_id, 'announcement', NULL, ?, ? FROM players WHERE status = 'active'",
  )
    .bind(JSON.stringify({ title, body: message }), Date.now())
    .run();
  await audit(c.env, staff, "announcement.send", null, { title, body: message, recipients: res.meta.changes });
  return c.json({ recipients: res.meta.changes });
});

// ── Staff ────────────────────────────────────────────

admin.get("/staff", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT s.user_id, s.email, s.name, s.role, s.created_at, p.avatar_version, p.border, p.title
     FROM staff s LEFT JOIN players p ON p.user_id = s.user_id ORDER BY CASE s.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 WHEN 'support' THEN 2 ELSE 3 END, s.name`,
  ).all<Player & { email: string; role: Role }>();
  return c.json({ staff: results.map((r) => ({ ...badge(r), email: r.email, role: r.role, since: r.created_at })) });
});

admin.post("/staff", async (c) => {
  const staff = c.get("staff");
  if (!can(staff, "staff")) return c.json(denied(), 403);
  const body = await c.req.json<{ userId: string; role: Role }>();
  if (!ROLES[body.role]) return c.json({ error: "Unknown role." }, 400);
  const p = await c.env.DB.prepare("SELECT user_id, name FROM players WHERE user_id = ?").bind(body.userId).first<{ user_id: string; name: string }>();
  if (!p) return c.json({ error: "Player not found. They need to have opened the casino once." }, 404);
  await c.env.DB.prepare(
    "INSERT INTO staff (user_id, email, name, role, added_by, created_at) VALUES (?1, '', ?2, ?3, ?4, ?5) ON CONFLICT (user_id) DO UPDATE SET role = ?3",
  )
    .bind(p.user_id, p.name, body.role, staff.user_id, Date.now())
    .run();
  await audit(c.env, staff, "staff.set", p.user_id, { role: body.role });
  return c.json({ ok: true });
});

admin.post("/staff/:id/remove", async (c) => {
  const staff = c.get("staff");
  if (!can(staff, "staff")) return c.json(denied(), 403);
  const id = c.req.param("id");
  const target = await c.env.DB.prepare("SELECT role FROM staff WHERE user_id = ?").bind(id).first<{ role: Role }>();
  if (!target) return c.json({ error: "Not staff." }, 404);
  if (target.role === "owner") {
    const owners = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM staff WHERE role = 'owner'").first<{ n: number }>();
    if ((owners?.n ?? 0) <= 1) return c.json({ error: "The casino needs at least one owner." }, 400);
  }
  await c.env.DB.prepare("DELETE FROM staff WHERE user_id = ?").bind(id).run();
  await audit(c.env, staff, "staff.remove", id, { role: target.role });
  return c.json({ ok: true });
});

// ── Audit log ────────────────────────────────────────

admin.get("/audit", async (c) => {
  const staff = c.get("staff");
  if (!can(staff, "audit")) return c.json(denied(), 403);
  const before = Number(c.req.query("before")) || Number.MAX_SAFE_INTEGER;
  const action = c.req.query("action");
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.staff_name, a.action, a.target_id, a.details, a.created_at, p.name AS target_name
     FROM audit_log a LEFT JOIN players p ON p.user_id = a.target_id
     WHERE a.id < ? ${action ? "AND a.action LIKE ?" : ""} ORDER BY a.id DESC LIMIT 101`,
  )
    .bind(...(action ? [before, `${action}%`] : [before]))
    .all<{ id: number; staff_name: string; action: string; target_id: string | null; details: string; created_at: number; target_name: string | null }>();
  return c.json({
    entries: results.slice(0, 100).map((r) => ({ ...r, details: r.details ? JSON.parse(r.details) : null })),
    more: results.length > 100,
  });
});
