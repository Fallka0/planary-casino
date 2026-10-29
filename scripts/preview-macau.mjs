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
// 127.0.0.1, not localhost: on Windows localhost can resolve to IPv6 first and miss the server.
const API = `http://127.0.0.1:${API_PORT}`;

// ── The preview player ──────────────────────────────

const view = (item) => ({ id: item.id, kind: item.kind, name: item.name, tier: item.tier, blurb: item.blurb, tradeable: !item.reward, rewardName: null });

const macau = CASE_MAP.get("macau");
let balance = 100_000;
let nextCopy = 1;
const copies = macau.items.map((id) => ({ copyId: nextCopy++, item: view(ITEMS.get(id)), source: "case", at: Date.now(), listing: null }));
const equipped = { border: "border-onsen", banner: "banner-yozakura", title: "title-risk-for-riches", cardback: "cardback-red-dragon", chipset: "chips-lucky-cat" };
const drops = [];
/** Set from the test page at /test: the tier the next opening lands on, and whether it sticks. */
let force = null;
let stickyForce = false;

const FRIENDS = [
  { id: "mei", name: "Mei", avatar: null, border: "border-lacquer", title: "Risk for Riches", titleId: "title-risk-for-riches" },
  { id: "kai", name: "Kai", avatar: null, border: "border-sakura", title: "Night Emperor", titleId: "title-night-emperor" },
];
/** A friend pulls something out of the Midnight Macau case: of the given tier, or as the odds fall. */
function friendDrop(tier) {
  const box = CASE_MAP.get("macau");
  const pool = box.items.map((iid) => ITEMS.get(iid)).filter((i) => !tier || i.tier === tier);
  const item = tier ? pool[Math.floor(Math.random() * pool.length)] : itemAt(box, Math.floor(Math.random() * drawTable(box).total));
  const player = FRIENDS[Math.floor(Math.random() * FRIENDS.length)];
  drops.unshift({ id: openingId(), at: Date.now(), caseId: "macau", item: view(item), player, mine: false });
  console.log(`  ${player.name} pulled ${item.name} (${item.tier})`);
}
// Now and then a friend opens one too, so the feed and its toasts have something to show.
setInterval(() => friendDrop(Math.random() < 0.25 ? (Math.random() < 0.4 ? "legendary" : "epic") : null), 40_000);

const TEST_PAGE = () => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Preview test controls</title>
<style>body{margin:0;padding:24px;background:#2a0915;color:#f8ecee;font:15px system-ui,sans-serif}h1{font-size:22px;margin:0 0 6px}p{color:#d9b8c2;margin:0 0 18px;max-width:60ch}
section{margin:0 0 22px}h2{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#d9b8c2;margin:0 0 10px}
a{display:inline-block;margin:0 8px 8px 0;padding:10px 16px;border-radius:12px;background:#4c1329;color:#f8ecee;text-decoration:none;font-weight:600}a:hover{background:#5e1a33}
.common{box-shadow:inset 0 -3px #d9cfc4}.rare{box-shadow:inset 0 -3px #7cc4ff}.epic{box-shadow:inset 0 -3px #d59bff}.legendary{box-shadow:inset 0 -3px #f7c65c}.on{outline:2px solid #f7c65c}</style>
<h1>Preview test controls</h1><p>Keep this tab next to the market. Turn the sound on with the Sound button by Open. Your next opening lands on the tier you pick here; the browser's fairness check still passes.</p>
<section><h2>Your next opening</h2>${["common", "rare", "epic", "legendary"].map((t) => `<a class="${t}${force === t && !stickyForce ? " on" : ""}" href="/test/next/${t}">${t}</a>`).join("")}</section>
<section><h2>Every opening, until you stop it</h2>${["common", "rare", "epic", "legendary"].map((t) => `<a class="${t}${force === t && stickyForce ? " on" : ""}" href="/test/always/${t}">always ${t}</a>`).join("")}<a href="/test/off">back to the real odds</a></section>
<section><h2>A friend's drop (shows as a toast within 15 s)</h2><a class="epic" href="/test/friend/epic">friend pulls an epic (feed only, no toast)</a><a class="legendary" href="/test/friend/legendary">friend pulls a legendary</a></section>
<p>${force ? `Set: ${stickyForce ? "every opening" : "the next opening"} lands on <b>${force}</b>.` : "Set: real odds."}</p>`;
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
  "GET /test": (req, url, res) => html(res, TEST_PAGE()),
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
  // A tier forced from the test page: draw fresh server seeds until one lands there. The proof
  // is a real one for that seed, so the browser's check still passes. (Preview only, of course.)
  if (force && box.items.some((iid) => ITEMS.get(iid).tier === force)) {
    for (let tries = 0; tries < 5000; tries++) {
      const seed = tries ? newServerSeed() : opening.serverSeed;
      if (itemAt(box, await roll(seed, clientSeed, 0, total)).tier === force) {
        opening.serverSeed = seed;
        opening.hash = await commit(seed);
        break;
      }
    }
    if (!stickyForce) force = null;
  }
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

function html(res, body) {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(body);
  return undefined;
}

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
  else if ((m = url.pathname.match(/^\/test\/(next|always)\/(common|rare|epic|legendary)$/))) {
    force = m[2];
    stickyForce = m[1] === "always";
    out = redirect(res, "/test");
  } else if (url.pathname === "/test/off") {
    force = null;
    stickyForce = false;
    out = redirect(res, "/test");
  } else if ((m = url.pathname.match(/^\/test\/friend\/(epic|legendary)$/))) {
    friendDrop(m[1]);
    out = redirect(res, "/test");
  } else if ((m = url.pathname.match(/^\/v1\/cases\/([^/]+)\/prepare$/))) out = await prepare(m[1]);
  else if ((m = url.pathname.match(/^\/v1\/cases\/([^/]+)\/open$/))) out = await open(m[1], body);
  else if (req.method === "GET" && (m = url.pathname.match(/^\/v1\/market\/([^/]+)$/)) && ITEMS.has(m[1])) out = { item: view(ITEMS.get(m[1])), listings: [], sales: [] };
  else if (req.method === "POST") out = [400, { error: "The preview doesn't do that. Open cases and equip things instead." }];
  else out = {};

  if (res.headersSent) return;
  const [status, data] = Array.isArray(out) ? out : [200, out];
  res.writeHead(status, { "content-type": "application/json", ...cors });
  res.end(JSON.stringify(data));
});

server.listen(API_PORT, "127.0.0.1", () => {
  console.log(`\n  Preview API on ${API}`);
  console.log(`  Site on http://localhost:${SITE_PORT}/market — sign in with the button, no password needed.`);
  console.log(`  Test controls on ${API}/test — pick what your next opening lands on, or make a friend pull something big.\n`);
  // Plain `next dev`, pointed at the stand-in for both the casino API and planary-auth.
  const site = spawn("npx", ["next", "dev", "-p", String(SITE_PORT)], {
    stdio: "inherit",
    shell: process.platform === "win32",
    // Its own process group elsewhere, so stopping can end Next and everything it started.
    detached: process.platform !== "win32",
    env: { ...process.env, NEXT_PUBLIC_CASINO_API: API, NEXT_PUBLIC_AUTH_BASE_URL: API, AUTH_API_URL: API },
  });
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    console.log("\n  Stopping the preview…");
    // On Windows the site runs under a shell, and killing the shell leaves Next running: end the whole tree.
    if (process.platform === "win32" && site.pid) spawn("taskkill", ["/pid", String(site.pid), "/T", "/F"], { stdio: "ignore" }).on("exit", () => process.exit(0));
    else {
      try {
        process.kill(-site.pid, "SIGTERM");
      } catch {
        // Already gone.
      }
      process.exit(0);
    }
    server.close();
  };
  site.on("exit", stop);
  for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"]) process.on(signal, stop);
});
