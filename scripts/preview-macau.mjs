/**
 * A look at the market with nothing real behind it: `npm run preview:macau`.
 *
 * Starts a stand-in for the casino API and planary-auth on port 8790, then the
 * site on port 3000 pointed at it. Sign in with the button as usual; you come
 * back as a preview player with 100'000 chips and one of every Midnight Macau
 * item, so you can equip them and see them on your profile, in the fitting room
 * and in the header. Opening a case uses the real catalog and the real
 * shared/fair.ts, so the reel and the browser's fairness check are the real
 * thing. Nothing is saved: restart and you start over.
 *
 * Needs Node 22.6 or newer (it reads the TypeScript catalog directly).
 */
import { spawn } from "node:child_process";
import http from "node:http";
import { CASES, CASE_MAP, CATALOG, ITEMS, drawTable, itemAt } from "../worker/src/catalog.ts";
import { commit, newServerSeed, roll } from "../shared/fair.ts";

const API_PORT = 8790;
const SITE_PORT = 3000;
const API = `http://localhost:${API_PORT}`;

// ── The preview player ──────────────────────────────

const view = (item) => ({ id: item.id, kind: item.kind, name: item.name, tier: item.tier, blurb: item.blurb, tradeable: !item.reward, rewardName: null });

const macau = CASE_MAP.get("macau");
let balance = 100_000;
let nextCopy = 1;
const copies = macau.items.map((id) => ({ copyId: nextCopy++, item: view(ITEMS.get(id)), source: "case", at: Date.now(), listing: null }));
const equipped = { border: "border-onsen", banner: "banner-yozakura", title: "title-risk-for-riches", cardback: "cardback-red-dragon", chipset: "chips-lucky-cat" };
const drops = [];
const pending = new Map();

const PLAYER = { id: "preview", name: "Preview", avatar: null };
const badge = () => ({ ...PLAYER, border: equipped.border, title: equipped.title ? ITEMS.get(equipped.title).name : null, titleId: equipped.title });
const me = () => ({
  ...badge(),
  balance,
  banner: equipped.banner,
  cardback: equipped.cardback,
  chipset: equipped.chipset,
  bonusStreak: 0,
  bonus: { amount: 0, available: false, nextAt: Date.now() + 86_400_000 },
});

// A token the site can read: it only looks at the claims, and asks us whether it's good.
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = () => `${b64({ alg: "none" })}.${b64({ sub: PLAYER.id, email: "preview@planary.local", name: PLAYER.name, exp: Math.floor(Date.now() / 1000) + 12 * 3600 })}.preview`;

// ── The stand-in API ────────────────────────────────

const routes = {
  "GET /": (req, url, res) => redirect(res, `${url.searchParams.get("returnTo") ?? `http://localhost:${SITE_PORT}/market`}#access_token=${token()}`),
  "GET /logout": (req, url, res) => redirect(res, url.searchParams.get("returnTo") ?? `http://localhost:${SITE_PORT}/`),
  "GET /api/auth/me": () => ({ user: { id: PLAYER.id, email: "preview@planary.local" } }),

  "GET /v1/me": me,
  "GET /v1/cases": () => ({
    balance,
    cases: CASES.map((box) => {
      const { entries, total } = drawTable(box);
      return { id: box.id, name: box.name, price: box.price, blurb: box.blurb, total, items: entries.map((e) => ({ ...view(e.item), weight: e.weight })) };
    }),
  }),
  "GET /v1/cases/recent": () => ({ drops: drops.slice(0, 8) }),
  "GET /v1/inventory": () => ({ balance, equipped, copies }),
  "POST /v1/inventory/equip": (req, url, res, body) => {
    const { kind, itemId } = body;
    if (itemId !== null && !copies.some((c) => c.item.id === itemId && c.item.kind === kind)) return [403, { error: "You don't have a copy of this." }];
    equipped[kind] = itemId;
    return { ok: true };
  },
  "GET /v1/profile/preview": () => ({
    ...badge(),
    titleId: equipped.title,
    bio: "Trying on the Midnight Macau case.",
    banner: equipped.banner,
    joinedAt: Date.now(),
    presence: { online: true, where: "lobby", table: null },
    relation: "self",
    pinned: [],
    stats: { blackjackRounds: 0, naturals: 0, bestStreak: 0, rouletteSpins: 0, bestRound: 0, weekNet: 0 },
    achievements: { unlocked: 0, total: 0 },
    showcase: [],
    recent: [],
  }),
  "GET /v1/market": () => ({ balance, fee: 0.05, items: CATALOG.filter((i) => !i.reward).map((i) => ({ ...view(i), lowest: null, listings: 0, lastSale: null })) }),
  // One friend wearing Midnight Macau, so the friends list shows a ring and a title too.
  "GET /v1/friends": () => ({
    friends: [
      { id: "mei", name: "Mei", avatar: null, border: "border-lacquer", title: "Risk for Riches", titleId: "title-risk-for-riches", presence: { online: true, where: "lobby", table: null } },
      { id: "kai", name: "Kai", avatar: null, border: "border-sakura", title: "Night Emperor", titleId: "title-night-emperor", presence: { online: false, where: null, table: null } },
    ],
    incoming: [],
    outgoing: [],
  }),
  "GET /v1/notifications": () => ({ notifications: [] }),
  "GET /v1/messages": () => ({ conversations: [] }),
  "GET /v1/achievements": () => ({ achievements: [] }),
  "GET /v1/leaderboard": (req, url) => ({ scope: url.searchParams.get("scope") ?? "all", weekStart: Date.now(), rows: [], me: null }),
  "GET /v1/chips/history": () => ({ entries: [] }),
  "GET /v1/rounds": () => ({ rounds: [], more: false }),
};

async function prepare(id) {
  const serverSeed = newServerSeed();
  const openingId = Math.random().toString(16).slice(2);
  const hash = await commit(serverSeed);
  pending.set(openingId, { serverSeed, hash, caseId: id });
  return { openingId, hash };
}

async function open(id, body) {
  const box = CASE_MAP.get(id);
  const opening = pending.get(body.openingId);
  if (!box || !opening || opening.caseId !== id) return [409, { error: "That opening has already happened. Try again." }];
  if (balance < box.price) return [409, { error: "Not enough chips." }];
  pending.delete(body.openingId);
  const clientSeed = String(body.clientSeed || "planary").slice(0, 64);
  const { total } = drawTable(box);
  const landed = await roll(opening.serverSeed, clientSeed, 0, total);
  const item = itemAt(box, landed);
  balance -= box.price;
  const copy = { copyId: nextCopy++, item: view(item), source: "case", at: Date.now(), listing: null };
  copies.unshift(copy);
  drops.unshift({ id: openingId(), at: copy.at, caseId: id, item: copy.item, player: badge(), mine: true });
  console.log(`  opened ${box.name}: ${item.name} (${item.tier})`);
  return {
    item: copy.item,
    copyId: copy.copyId,
    proof: { hash: opening.hash, serverSeed: opening.serverSeed, clientSeed, nonce: 0, roll: landed, total },
    balance,
    unlocked: [],
  };
}
const openingId = () => Math.random().toString(16).slice(2);

function redirect(res, location) {
  res.writeHead(302, { location });
  res.end();
  return undefined;
}

const server = http.createServer(async (req, res) => {
  const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET, POST, OPTIONS" };
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    return res.end();
  }
  const url = new URL(req.url, API);
  let raw = "";
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};

  let out;
  let m;
  const key = `${req.method} ${url.pathname}`;
  if (routes[key]) out = await routes[key](req, url, res, body);
  else if (req.method === "GET" && url.pathname.startsWith("/v1/profile/")) out = routes["GET /v1/profile/preview"]();
  else if ((m = url.pathname.match(/^\/v1\/cases\/([^/]+)\/prepare$/))) out = await prepare(m[1]);
  else if ((m = url.pathname.match(/^\/v1\/cases\/([^/]+)\/open$/))) out = await open(m[1], body);
  else if (req.method === "GET" && (m = url.pathname.match(/^\/v1\/market\/([^/]+)$/)) && ITEMS.has(m[1])) out = { item: view(ITEMS.get(m[1])), listings: [], sales: [] };
  else if (req.method === "POST") out = [400, { error: "The preview doesn't do that. Open cases and equip things instead." }];
  else out = {};

  if (res.headersSent) return;
  const [status, data] = Array.isArray(out) ? out : [200, out];
  res.writeHead(status, { "content-type": "application/json", ...cors });
  res.end(JSON.stringify(data));
});

server.listen(API_PORT, () => {
  console.log(`\n  Preview API on ${API}`);
  console.log(`  Site on http://localhost:${SITE_PORT}/market — sign in with the button, no password needed.\n`);
  // Plain `next dev`, pointed at the stand-in for both the casino API and planary-auth.
  const site = spawn("npx", ["next", "dev", "-p", String(SITE_PORT)], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, NEXT_PUBLIC_CASINO_API: API, NEXT_PUBLIC_AUTH_BASE_URL: API, AUTH_API_URL: API },
  });
  const stop = () => {
    site.kill();
    server.close();
    process.exit(0);
  };
  site.on("exit", stop);
  process.on("SIGINT", stop);
});
