import { Hono } from "hono";
import { ACHIEVEMENT_MAP, achievementList, checkLive, claim, getStats, unclaimed, unlock } from "./achievements";
import { ITEMS } from "./catalog";
import type { Env, Player } from "./env";
import { checkName, clearCustomName, nameChangePrice, renameSelf } from "./names";
import { notify } from "./notify";
import { isMuted } from "./policy";
import { zurichWeekStart } from "./time";

type Vars = { player: Player };
export const social = new Hono<{ Bindings: Env; Variables: Vars }>();

const ONLINE_MS = 75_000;
const MAX_AVATAR_BYTES = 300_000;
const MAX_MESSAGE = 1000;
const GAMES = new Set(["blackjack", "poker", "roulette"]);
const TABLE_ID = /^[tp]-[a-z0-9]{6}$/;

export const pairKey = (a: string, b: string) => (a < b ? [a, b] : [b, a]);

/** Columns every "player badge" needs: name, picture, border and title. */
export const BADGE_COLUMNS = "p.user_id, p.name, p.avatar_version, p.border, p.title";

type BadgeRow = Pick<Player, "user_id" | "name" | "avatar_version" | "border" | "title">;

/** How a player shows up anywhere in the casino. `avatar` is a path on this API. */
export function badge(row: BadgeRow) {
  return {
    id: row.user_id,
    name: row.name,
    avatar: row.avatar_version ? `/avatars/${row.user_id}?v=${row.avatar_version}` : null,
    border: row.border,
    title: row.title ? (ITEMS.get(row.title)?.name ?? null) : null,
  };
}

export function presenceOf(p: Pick<Player, "last_seen" | "presence_where" | "presence_table">) {
  const online = Date.now() - p.last_seen < ONLINE_MS;
  return { online, where: online ? p.presence_where : null, table: online ? p.presence_table : null };
}

async function relation(env: Env, me: string, other: string) {
  if (me === other) return "self";
  const [low, high] = pairKey(me, other);
  const row = await env.DB.prepare("SELECT status, requested_by FROM friendships WHERE user_low = ? AND user_high = ?")
    .bind(low, high)
    .first<{ status: string; requested_by: string }>();
  if (!row) return "none";
  if (row.status === "accepted") return "friend";
  return row.requested_by === me ? "requested" : "incoming";
}

/** The up-to-three achievement ids pinned to a profile, as stored. */
export function parseShowcase(raw: string | null): string[] {
  try {
    const value = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? value.filter((v) => typeof v === "string").slice(0, 3) : [];
  } catch {
    return [];
  }
}

export async function unreadCounts(env: Env, userId: string) {
  const [messages, notifications, claims] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n FROM messages WHERE recipient_id = ? AND read_at IS NULL").bind(userId).first<{ n: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL").bind(userId).first<{ n: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM achievements WHERE user_id = ? AND claimed_at IS NULL").bind(userId).first<{ n: number }>(),
  ]);
  return { messages: messages?.n ?? 0, notifications: notifications?.n ?? 0, claims: claims?.n ?? 0 };
}

// ── Profiles ─────────────────────────────────────────

social.get("/profile/:id", async (c) => {
  const me = c.get("player").user_id;
  const id = c.req.param("id") === "me" ? me : c.req.param("id");
  const p = await c.env.DB.prepare("SELECT * FROM players WHERE user_id = ?").bind(id).first<Player>();
  if (!p) return c.json({ error: "Player not found." }, 404);

  const [list, stats, rel, week] = await Promise.all([
    achievementList(c.env, id, false),
    getStats(c.env, id),
    relation(c.env, me, id),
    c.env.DB.prepare("SELECT COALESCE(SUM(amount), 0) AS net FROM ledger WHERE user_id = ? AND kind = 'game' AND created_at >= ?")
      .bind(id, zurichWeekStart())
      .first<{ net: number }>(),
  ]);
  const unlocked = list.filter((a) => a.unlockedAt);
  const pinned = parseShowcase(p.showcase).filter((pid) => unlocked.some((a) => a.id === pid));
  // Pinned first; if none are pinned, the rarest three they own.
  const showcase = pinned.length
    ? pinned.map((pid) => unlocked.find((a) => a.id === pid)!)
    : [...unlocked].sort((a, b) => a.rarity - b.rarity || (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0)).slice(0, 3);

  return c.json({
    ...badge(p),
    // Only you need to know whether your name is your own pick, and what the next one costs.
    nameChange: rel === "self" ? { custom: Boolean(p.name_custom), price: nameChangePrice(p) } : undefined,
    bio: p.bio,
    banner: p.banner,
    joinedAt: p.created_at,
    presence: presenceOf(p),
    relation: rel,
    pinned,
    stats: {
      blackjackRounds: stats.bj_hands ?? 0,
      naturals: stats.bj_naturals ?? 0,
      bestStreak: stats.bj_best_streak ?? 0,
      rouletteSpins: stats.roulette_spins ?? 0,
      bestRound: stats.best_round ?? 0,
      weekNet: week?.net ?? 0,
    },
    achievements: { unlocked: unlocked.length, total: list.length },
    showcase,
    recent: [...unlocked].sort((a, b) => (b.unlockedAt ?? 0) - (a.unlockedAt ?? 0)).slice(0, 6),
  });
});

/**
 * Picks your own casino name. The first one is free, every one after that
 * costs chips. An empty name hands it back to your Planary account, for free.
 */
social.post("/profile/name", async (c) => {
  const me = c.get("player");
  const body = await c.req.json<{ name?: string | null }>().catch(() => ({ name: undefined }));
  if (body.name === null || String(body.name ?? "").trim() === "") {
    await clearCustomName(c.env, me.user_id);
    return c.json({ ok: true, charged: 0, balance: me.balance });
  }
  const checked = await checkName(c.env, me.user_id, body.name);
  if ("error" in checked) return c.json({ error: checked.error }, checked.status);
  if (checked.name === me.name && me.name_custom) return c.json({ ok: true, charged: 0, balance: me.balance });
  const charged = await renameSelf(c.env, me, checked.name);
  if (charged === null) {
    const price = nameChangePrice(me);
    const swiss = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
    return c.json({ error: `A new name costs ${swiss(price)} chips, and you have ${swiss(me.balance)}.` }, 409);
  }
  return c.json({ ok: true, name: checked.name, charged, balance: me.balance - charged });
});

social.post("/profile", async (c) => {
  const me = c.get("player");
  const body = await c.req.json<{ bio?: string | null; showcase?: string[] }>();
  if (body.bio !== undefined) {
    const bio = body.bio === null ? null : String(body.bio).replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").trim().slice(0, 160) || null;
    await c.env.DB.prepare("UPDATE players SET bio = ? WHERE user_id = ?").bind(bio, me.user_id).run();
  }
  if (body.showcase !== undefined) {
    if (!Array.isArray(body.showcase)) return c.json({ error: "Bad showcase." }, 400);
    const owned = await c.env.DB.prepare("SELECT achievement_id AS id FROM achievements WHERE user_id = ?").bind(me.user_id).all<{ id: string }>();
    const have = new Set(owned.results.map((r) => r.id));
    const showcase = [...new Set(body.showcase)].filter((id) => have.has(id)).slice(0, 3);
    await c.env.DB.prepare("UPDATE players SET showcase = ? WHERE user_id = ?").bind(JSON.stringify(showcase), me.user_id).run();
  }
  return c.json({ ok: true });
});

function imageType(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  const tag = String.fromCharCode(...bytes.slice(0, 4)) + String.fromCharCode(...bytes.slice(8, 12));
  if (tag === "RIFFWEBP") return "image/webp";
  return null;
}

social.post("/profile/avatar", async (c) => {
  const me = c.get("player").user_id;
  const bytes = new Uint8Array(await c.req.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES) return c.json({ error: "Pick an image under 300 KB." }, 400);
  const mime = imageType(bytes);
  if (!mime) return c.json({ error: "Use a JPEG, PNG or WebP image." }, 400);
  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO avatars (user_id, data, mime, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT (user_id) DO UPDATE SET data = ?2, mime = ?3, updated_at = ?4",
    ).bind(me, bytes, mime, Date.now()),
    c.env.DB.prepare("UPDATE players SET avatar_version = avatar_version + 1 WHERE user_id = ?").bind(me),
  ]);
  const unlocked = await unlock(c.env, me, ["new_face"]);
  const p = await c.env.DB.prepare(`SELECT ${BADGE_COLUMNS} FROM players p WHERE p.user_id = ?`).bind(me).first<BadgeRow>();
  return c.json({ avatar: badge(p!).avatar, unlocked: unlocked.map((a) => a.id) });
});

social.post("/profile/avatar/remove", async (c) => {
  const me = c.get("player").user_id;
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM avatars WHERE user_id = ?").bind(me),
    c.env.DB.prepare("UPDATE players SET avatar_version = 0 WHERE user_id = ?").bind(me),
  ]);
  return c.json({ avatar: null });
});

// ── Achievements ─────────────────────────────────────

/** Pays out one unlocked achievement: its chips and any reward cosmetic. */
social.post("/achievements/:id/claim", async (c) => {
  const me = c.get("player").user_id;
  const paid = await claim(c.env, me, c.req.param("id"));
  if (!paid) return c.json({ error: "Nothing to claim there. It may already be yours." }, 409);
  // The chips can tip a balance milestone, which is an achievement of its own.
  const unlocked = await checkLive(c.env, me);
  const balance = await c.env.DB.prepare("SELECT balance FROM players WHERE user_id = ?").bind(me).first<{ balance: number }>();
  return c.json({ claimed: [paid], balance: balance?.balance ?? 0, unlocked: unlocked.map((a) => a.id) });
});

/** Everything waiting, in one go. */
social.post("/achievements/claim-all", async (c) => {
  const me = c.get("player").user_id;
  const claimed = [];
  for (const id of (await unclaimed(c.env, me)).keys()) {
    const paid = await claim(c.env, me, id);
    if (paid) claimed.push(paid);
  }
  const unlocked = await checkLive(c.env, me);
  const balance = await c.env.DB.prepare("SELECT balance FROM players WHERE user_id = ?").bind(me).first<{ balance: number }>();
  return c.json({ claimed, balance: balance?.balance ?? 0, unlocked: unlocked.map((a) => a.id) });
});

social.get("/achievements", async (c) => {
  const me = c.get("player").user_id;
  const userId = c.req.query("user") || me;
  const list = await achievementList(c.env, userId, userId === me);
  return c.json({ achievements: list });
});

// ── Direct messages ──────────────────────────────────

social.get("/messages", async (c) => {
  const me = c.get("player").user_id;
  const { results } = await c.env.DB.prepare(
    `WITH mine AS (
       SELECT id, CASE WHEN sender_id = ?1 THEN recipient_id ELSE sender_id END AS partner,
              CASE WHEN recipient_id = ?1 AND read_at IS NULL THEN 1 ELSE 0 END AS unread
       FROM messages WHERE sender_id = ?1 OR recipient_id = ?1
     ), convo AS (
       SELECT partner, MAX(id) AS last_id, SUM(unread) AS unread FROM mine GROUP BY partner
     )
     SELECT ${BADGE_COLUMNS}, p.last_seen, p.presence_where, p.presence_table,
            m.body, m.sender_id, m.created_at, convo.unread
     FROM convo JOIN messages m ON m.id = convo.last_id JOIN players p ON p.user_id = convo.partner
     ORDER BY convo.last_id DESC LIMIT 60`,
  )
    .bind(me)
    .all<Player & { body: string; sender_id: string; created_at: number; unread: number }>();
  return c.json({
    conversations: results.map((r) => ({
      with: badge(r),
      presence: presenceOf(r),
      last: { body: r.body, mine: r.sender_id === me, at: r.created_at },
      unread: r.unread,
    })),
  });
});

social.get("/messages/:id", async (c) => {
  const me = c.get("player").user_id;
  const other = c.req.param("id");
  const after = Number(c.req.query("after") ?? 0) || 0;
  const before = Number(c.req.query("before") ?? 0) || 0;
  const partner = await c.env.DB.prepare(`SELECT ${BADGE_COLUMNS}, p.last_seen, p.presence_where, p.presence_table FROM players p WHERE p.user_id = ?`)
    .bind(other)
    .first<Player>();
  if (!partner) return c.json({ error: "Player not found." }, 404);
  const { results } = await c.env.DB.prepare(
    `SELECT id, sender_id, body, created_at, read_at FROM messages
     WHERE ((sender_id = ?1 AND recipient_id = ?2) OR (sender_id = ?2 AND recipient_id = ?1))
       AND id > ?3 AND (?4 = 0 OR id < ?4)
     ORDER BY id DESC LIMIT 60`,
  )
    .bind(me, other, after, before)
    .all<{ id: number; sender_id: string; body: string; created_at: number; read_at: number | null }>();
  await c.env.DB.prepare("UPDATE messages SET read_at = ? WHERE recipient_id = ? AND sender_id = ? AND read_at IS NULL")
    .bind(Date.now(), me, other)
    .run();
  return c.json({
    with: badge(partner),
    presence: presenceOf(partner),
    relation: await relation(c.env, me, other),
    messages: results.reverse().map((m) => ({ id: m.id, mine: m.sender_id === me, body: m.body, at: m.created_at, read: m.read_at !== null })),
    more: results.length === 60,
  });
});

social.post("/messages/:id", async (c) => {
  const me = c.get("player").user_id;
  const other = c.req.param("id");
  const { body } = await c.req.json<{ body: string }>();
  const text = String(body ?? "")
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "")
    .trim()
    .slice(0, MAX_MESSAGE);
  if (!text) return c.json({ error: "Write something first." }, 400);
  if (isMuted(c.get("player"))) return c.json({ error: "Messaging is paused on your account for now." }, 403);
  if ((await relation(c.env, me, other)) !== "friend") return c.json({ error: "You can only message friends." }, 403);
  const recent = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM messages WHERE sender_id = ? AND created_at > ?")
    .bind(me, Date.now() - 60_000)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= 30) return c.json({ error: "Slow down a little." }, 429);
  const res = await c.env.DB.prepare("INSERT INTO messages (sender_id, recipient_id, body, created_at) VALUES (?, ?, ?, ?)")
    .bind(me, other, text, Date.now())
    .run();
  const unlocked = await unlock(c.env, me, ["first_message"]);
  return c.json({ id: res.meta.last_row_id, unlocked: unlocked.map((a) => a.id) });
});

// ── Notifications ────────────────────────────────────

social.get("/notifications", async (c) => {
  const me = c.get("player").user_id;
  const { results } = await c.env.DB.prepare(
    `SELECT n.id, n.kind, n.data, n.created_at, n.read_at, n.resolved_at, ${BADGE_COLUMNS}
     FROM notifications n LEFT JOIN players p ON p.user_id = n.actor_id
     WHERE n.user_id = ? ORDER BY n.id DESC LIMIT 40`,
  )
    .bind(me)
    .all<Player & { id: number; kind: string; data: string | null; created_at: number; read_at: number | null; resolved_at: number | null }>();
  return c.json({
    notifications: results.map((n) => {
      const data = n.data ? JSON.parse(n.data) : null;
      const achievement = n.kind === "achievement" && data?.id ? ACHIEVEMENT_MAP.get(data.id) : null;
      return {
        id: n.id,
        kind: n.kind,
        at: n.created_at,
        read: n.read_at !== null,
        // Answered already: the panel keeps the line, drops the buttons.
        resolved: n.resolved_at !== null,
        actor: n.user_id ? badge(n) : null,
        data,
        achievement: achievement ? { id: achievement.id, name: achievement.name, glyph: achievement.glyph, grade: achievement.grade } : null,
      };
    }),
  });
});

social.post("/notifications/read", async (c) => {
  const me = c.get("player").user_id;
  const { ids } = await c.req.json<{ ids?: number[] }>().catch(() => ({ ids: undefined }));
  if (Array.isArray(ids) && ids.length) {
    const safe = ids.filter((id) => Number.isInteger(id)).slice(0, 100);
    await c.env.DB.prepare(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND id IN (${safe.map(() => "?").join(",")})`)
      .bind(Date.now(), me, ...safe)
      .run();
  } else {
    await c.env.DB.prepare("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL").bind(Date.now(), me).run();
  }
  return c.json(await unreadCounts(c.env, me));
});

social.get("/unread", async (c) => c.json(await unreadCounts(c.env, c.get("player").user_id)));

// ── Table invites ────────────────────────────────────

social.post("/invites", async (c) => {
  const me = c.get("player").user_id;
  const { userId, game, table } = await c.req.json<{ userId: string; game: string; table: string }>();
  if (!GAMES.has(game) || !TABLE_ID.test(table)) return c.json({ error: "Bad invite." }, 400);
  if ((await relation(c.env, me, userId)) !== "friend") return c.json({ error: "You can only invite friends." }, 403);
  // One live invite per friend and table is plenty.
  const dupe = await c.env.DB.prepare(
    "SELECT 1 FROM notifications WHERE user_id = ? AND actor_id = ? AND kind = 'table_invite' AND data = ? AND created_at > ?",
  )
    .bind(userId, me, JSON.stringify({ game, table }), Date.now() - 10 * 60_000)
    .first();
  if (!dupe) await notify(c.env, userId, "table_invite", me, { game, table });
  const unlocked = await unlock(c.env, me, ["host"]);
  return c.json({ ok: true, unlocked: unlocked.map((a) => a.id) });
});
