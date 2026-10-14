// Cases, the inventory, and the market between players.
//
// Nothing is sold by the house any more except cases. A case is opened the way
// a table round is played: the server seed is drawn and its hash shown first,
// the player adds a client seed and pays, and only then is the seed used and
// revealed. What comes out is a copy the player owns outright; anything that
// isn't an achievement reward can be listed for other players to buy.
//
// Chips spent on cases and the house's cut of each sale go into the bank.

import { Hono } from "hono";
import { commit, newServerSeed, roll, sanitiseClientSeed, toHex } from "../../shared/fair";
import { ACHIEVEMENT_MAP, checkLive, unlock } from "./achievements";
import { bankEntry } from "./bank";
import { CASE_MAP, CASES, CATALOG, drawTable, ITEMS, type ItemKind, itemAt, KIND_COLUMN, tradeable } from "./catalog";
import type { Env, Player } from "./env";
import { notify } from "./notify";
import { BADGE_COLUMNS, badge } from "./social";

type Vars = { player: Player };
export const market = new Hono<{ Bindings: Env; Variables: Vars }>();

/** The house's cut of a sale, taken from the seller's side. */
export const MARKET_FEE = 0.05;
const MIN_PRICE = 20;
const MAX_PRICE = 10_000_000;

const feeOn = (price: number) => Math.ceil(price * MARKET_FEE);

const balanceOf = async (env: Env, userId: string) =>
  (await env.DB.prepare("SELECT balance FROM players WHERE user_id = ?").bind(userId).first<{ balance: number }>())?.balance ?? 0;

/** A copy can be equipped or listed only while it isn't already up for sale. */
const UNLISTED = "NOT EXISTS (SELECT 1 FROM listings l WHERE l.inventory_id = i.id)";

function itemView(id: string) {
  const item = ITEMS.get(id)!;
  return {
    id: item.id,
    kind: item.kind,
    name: item.name,
    tier: item.tier,
    blurb: item.blurb,
    tradeable: tradeable(item),
    rewardName: item.reward ? (ACHIEVEMENT_MAP.get(item.reward)?.name ?? null) : null,
  };
}

// ── Cases ────────────────────────────────────────────

market.get("/cases", (c) => {
  return c.json({
    balance: c.get("player").balance,
    cases: CASES.map((box) => {
      const { entries, total } = drawTable(box);
      return { id: box.id, name: box.name, price: box.price, blurb: box.blurb, total, items: entries.map((e) => ({ ...itemView(e.item.id), weight: e.weight })) };
    }),
  });
});

/**
 * Draws the server seed for the next opening of a case and shows its hash. An
 * unopened one is handed back rather than drawing another, so the commitment a
 * player saw is the one their opening uses.
 */
market.post("/cases/:id/prepare", async (c) => {
  const me = c.get("player").user_id;
  const box = CASE_MAP.get(c.req.param("id"));
  if (!box) return c.json({ error: "That case doesn't exist." }, 404);
  const pending = await c.env.DB.prepare("SELECT id, hash FROM case_openings WHERE user_id = ? AND case_id = ? AND opened_at IS NULL ORDER BY created_at DESC LIMIT 1")
    .bind(me, box.id)
    .first<{ id: string; hash: string }>();
  if (pending) return c.json({ openingId: pending.id, hash: pending.hash });
  const id = toHex(crypto.getRandomValues(new Uint8Array(12)));
  const serverSeed = newServerSeed();
  const hash = await commit(serverSeed);
  await c.env.DB.prepare("INSERT INTO case_openings (id, user_id, case_id, hash, server_seed, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, me, box.id, hash, serverSeed, Date.now())
    .run();
  return c.json({ openingId: id, hash });
});

market.post("/cases/:id/open", async (c) => {
  const me = c.get("player").user_id;
  const box = CASE_MAP.get(c.req.param("id"));
  if (!box) return c.json({ error: "That case doesn't exist." }, 404);
  const body = await c.req.json<{ openingId: string; clientSeed: string }>();
  const opening = await c.env.DB.prepare("SELECT id, hash, server_seed FROM case_openings WHERE id = ? AND user_id = ? AND case_id = ? AND opened_at IS NULL")
    .bind(String(body.openingId ?? ""), me, box.id)
    .first<{ id: string; hash: string; server_seed: string }>();
  if (!opening) return c.json({ error: "That opening has already happened. Try again." }, 409);

  const clientSeed = sanitiseClientSeed(body.clientSeed) || "planary";
  const { total } = drawTable(box);
  const landed = await roll(opening.server_seed, clientSeed, 0, total);
  const item = itemAt(box, landed);
  const t = Date.now();

  // The claim on the opening is what checks the balance, inside the same
  // transaction as the debit, so a case is never opened unpaid or paid twice.
  const results = await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE case_openings SET client_seed = ?1, price = ?2, roll = ?3, item_id = ?4, opened_at = ?5
       WHERE id = ?6 AND opened_at IS NULL AND (SELECT balance FROM players WHERE user_id = ?7) >= ?2`,
    ).bind(clientSeed, box.price, landed, item.id, t, opening.id, me),
    c.env.DB.prepare("UPDATE players SET balance = balance - ?1 WHERE user_id = ?2 AND changes() = 1").bind(box.price, me),
    c.env.DB.prepare("INSERT INTO ledger (user_id, amount, kind, ref, created_at) SELECT ?1, ?2, 'case', ?3, ?4 WHERE changes() = 1").bind(
      me,
      -box.price,
      box.id,
      t,
    ),
    bankEntry(c.env, "cases", "in", box.price, t),
    c.env.DB.prepare("INSERT INTO inventory (user_id, item_id, source, created_at) SELECT ?1, ?2, 'case', ?3 WHERE changes() = 1").bind(me, item.id, t),
  ]);
  if (!results[0].meta.changes) return c.json({ error: "Not enough chips." }, 409);

  const unlocked = [...(await unlock(c.env, me, ["dressed_up"])), ...(await checkLive(c.env, me))];
  return c.json({
    item: itemView(item.id),
    copyId: results[4].meta.last_row_id,
    proof: { hash: opening.hash, serverSeed: opening.server_seed, clientSeed, nonce: 0, roll: landed, total },
    balance: await balanceOf(c.env, me),
    unlocked: unlocked.map((a) => a.id),
  });
});

// ── Inventory ────────────────────────────────────────

market.get("/inventory", async (c) => {
  const me = c.get("player");
  const { results } = await c.env.DB.prepare(
    `SELECT i.id, i.item_id, i.source, i.created_at, l.id AS listing_id, l.price AS listing_price
     FROM inventory i LEFT JOIN listings l ON l.inventory_id = i.id
     WHERE i.user_id = ? ORDER BY i.created_at DESC`,
  )
    .bind(me.user_id)
    .all<{ id: number; item_id: string; source: string; created_at: number; listing_id: number | null; listing_price: number | null }>();
  return c.json({
    balance: me.balance,
    equipped: { border: me.border, banner: me.banner, title: me.title, cardback: me.cardback, chipset: me.chipset },
    copies: results
      .filter((r) => ITEMS.has(r.item_id))
      .map((r) => ({
        copyId: r.id,
        item: itemView(r.item_id),
        source: r.source,
        at: r.created_at,
        listing: r.listing_id ? { id: r.listing_id, price: r.listing_price! } : null,
      })),
  });
});

market.post("/inventory/equip", async (c) => {
  const me = c.get("player").user_id;
  const { kind, itemId } = await c.req.json<{ kind: ItemKind; itemId: string | null }>();
  const column = KIND_COLUMN[kind];
  if (!column) return c.json({ error: "Unknown slot." }, 400);
  if (itemId !== null) {
    const item = ITEMS.get(itemId);
    if (!item || item.kind !== kind) return c.json({ error: "That doesn't go there." }, 400);
    const owned = await c.env.DB.prepare(`SELECT 1 FROM inventory i WHERE i.user_id = ? AND i.item_id = ? AND ${UNLISTED}`).bind(me, itemId).first();
    if (!owned) return c.json({ error: "You don't have a copy of this that isn't up for sale." }, 403);
  }
  await c.env.DB.prepare(`UPDATE players SET ${column} = ? WHERE user_id = ?`).bind(itemId, me).run();
  return c.json({ ok: true });
});

// ── Market ───────────────────────────────────────────

/** Every tradeable item with what's on offer: the cheapest listing, how many, and the last sale. */
market.get("/market", async (c) => {
  const [offers, sales] = await Promise.all([
    c.env.DB.prepare("SELECT item_id, MIN(price) AS lowest, COUNT(*) AS n FROM listings GROUP BY item_id").all<{ item_id: string; lowest: number; n: number }>(),
    c.env.DB.prepare(
      `SELECT s.item_id, s.price FROM market_sales s
       WHERE s.id = (SELECT MAX(id) FROM market_sales WHERE item_id = s.item_id)`,
    ).all<{ item_id: string; price: number }>(),
  ]);
  const offer = new Map(offers.results.map((r) => [r.item_id, r]));
  const last = new Map(sales.results.map((r) => [r.item_id, r.price]));
  return c.json({
    balance: c.get("player").balance,
    fee: MARKET_FEE,
    items: CATALOG.filter(tradeable).map((item) => ({
      ...itemView(item.id),
      lowest: offer.get(item.id)?.lowest ?? null,
      listings: offer.get(item.id)?.n ?? 0,
      lastSale: last.get(item.id) ?? null,
    })),
  });
});

/** One item's listings, cheapest first, and its recent sales. */
market.get("/market/:itemId", async (c) => {
  const itemId = c.req.param("itemId");
  if (!ITEMS.has(itemId)) return c.json({ error: "That item doesn't exist." }, 404);
  const [listings, sales] = await Promise.all([
    c.env.DB.prepare(
      `SELECT l.id, l.price, l.created_at, ${BADGE_COLUMNS} FROM listings l JOIN players p ON p.user_id = l.seller_id
       WHERE l.item_id = ? ORDER BY l.price, l.id LIMIT 50`,
    )
      .bind(itemId)
      .all<Player & { id: number; price: number; created_at: number }>(),
    c.env.DB.prepare("SELECT price, created_at FROM market_sales WHERE item_id = ? ORDER BY id DESC LIMIT 20").bind(itemId).all<{ price: number; created_at: number }>(),
  ]);
  const me = c.get("player").user_id;
  return c.json({
    item: itemView(itemId),
    listings: listings.results.map((l) => ({ id: l.id, price: l.price, at: l.created_at, seller: badge(l), mine: l.user_id === me })),
    sales: sales.results.map((s) => ({ price: s.price, at: s.created_at })),
  });
});

market.post("/market/list", async (c) => {
  const me = c.get("player");
  const { copyId, price } = await c.req.json<{ copyId: number; price: number }>();
  if (!Number.isInteger(price) || price < MIN_PRICE || price > MAX_PRICE) {
    return c.json({ error: "Set a price between 20 and 10'000'000 chips." }, 400);
  }
  const copy = await c.env.DB.prepare("SELECT id, item_id FROM inventory WHERE id = ? AND user_id = ?").bind(copyId, me.user_id).first<{ id: number; item_id: string }>();
  const item = copy ? ITEMS.get(copy.item_id) : null;
  if (!copy || !item) return c.json({ error: "That isn't in your inventory." }, 404);
  if (!tradeable(item)) return c.json({ error: "Achievement rewards stay with the player who earned them." }, 400);

  // The copy you're wearing has to stay unless you hold another one.
  const column = KIND_COLUMN[item.kind];
  const res = await c.env.DB.prepare(
    `INSERT INTO listings (inventory_id, seller_id, item_id, price, created_at)
     SELECT ?1, ?2, ?3, ?4, ?5 WHERE NOT EXISTS (SELECT 1 FROM listings WHERE inventory_id = ?1)
       AND (COALESCE((SELECT ${column} FROM players WHERE user_id = ?2), '') <> ?3
         OR EXISTS (SELECT 1 FROM inventory i WHERE i.user_id = ?2 AND i.item_id = ?3 AND i.id <> ?1 AND ${UNLISTED}))`,
  )
    .bind(copy.id, me.user_id, item.id, price, Date.now())
    .run();
  if (!res.meta.changes) {
    const listed = await c.env.DB.prepare("SELECT 1 FROM listings WHERE inventory_id = ?").bind(copy.id).first();
    return c.json({ error: listed ? "That copy is already for sale." : "You're wearing it. Take it off first, or keep a second copy." }, 409);
  }
  return c.json({ ok: true, fee: feeOn(price), proceeds: price - feeOn(price) });
});

market.post("/market/cancel", async (c) => {
  const me = c.get("player").user_id;
  const { listingId } = await c.req.json<{ listingId: number }>();
  const res = await c.env.DB.prepare("DELETE FROM listings WHERE id = ? AND seller_id = ?").bind(listingId, me).run();
  if (!res.meta.changes) return c.json({ error: "That listing is gone. It may just have sold." }, 404);
  return c.json({ ok: true });
});

market.post("/market/buy", async (c) => {
  const me = c.get("player").user_id;
  const { listingId } = await c.req.json<{ listingId: number }>();
  const listing = await c.env.DB.prepare("SELECT id, inventory_id, seller_id, item_id, price FROM listings WHERE id = ?")
    .bind(listingId)
    .first<{ id: number; inventory_id: number; seller_id: string; item_id: string; price: number }>();
  if (!listing) return c.json({ error: "That listing is gone. Someone may have bought it first." }, 404);
  if (listing.seller_id === me) return c.json({ error: "That's your own listing." }, 400);
  const fee = feeOn(listing.price);
  const proceeds = listing.price - fee;
  const t = Date.now();

  // Taking the listing down is the claim: it checks the buyer can pay, inside
  // the same transaction that moves the chips and the copy, so two buyers can
  // never both get it and nobody pays for nothing.
  const [claim] = await c.env.DB.batch([
    c.env.DB.prepare(
      `DELETE FROM listings WHERE id = ?1 AND seller_id = ?2 AND price = ?3
         AND (SELECT balance FROM players WHERE user_id = ?4) >= ?3`,
    ).bind(listing.id, listing.seller_id, listing.price, me),
    c.env.DB.prepare("UPDATE players SET balance = balance - ?1 WHERE user_id = ?2 AND changes() = 1").bind(listing.price, me),
    c.env.DB.prepare(
      "INSERT INTO ledger (user_id, amount, kind, ref, counterparty, created_at) SELECT ?1, ?2, 'market_buy', ?3, ?4, ?5 WHERE changes() = 1",
    ).bind(me, -listing.price, listing.item_id, listing.seller_id, t),
    c.env.DB.prepare("UPDATE players SET balance = balance + ?1 WHERE user_id = ?2 AND changes() = 1").bind(proceeds, listing.seller_id),
    c.env.DB.prepare(
      "INSERT INTO ledger (user_id, amount, kind, ref, counterparty, created_at) SELECT ?1, ?2, 'market_sale', ?3, ?4, ?5 WHERE changes() = 1",
    ).bind(listing.seller_id, proceeds, listing.item_id, me, t),
    bankEntry(c.env, "market", "in", fee, t),
    c.env.DB.prepare("UPDATE inventory SET user_id = ?1, source = 'market', created_at = ?2 WHERE id = ?3 AND changes() = 1").bind(me, t, listing.inventory_id),
    c.env.DB.prepare(
      "INSERT INTO market_sales (item_id, price, fee, seller_id, buyer_id, created_at) SELECT ?1, ?2, ?3, ?4, ?5, ?6 WHERE changes() = 1",
    ).bind(listing.item_id, listing.price, fee, listing.seller_id, me, t),
  ]);
  if (!claim.meta.changes) {
    const still = await c.env.DB.prepare("SELECT 1 FROM listings WHERE id = ?").bind(listing.id).first();
    return c.json({ error: still ? "Not enough chips." : "That listing is gone. Someone may have bought it first." }, 409);
  }

  await notify(c.env, listing.seller_id, "sale", me, { item: listing.item_id, name: ITEMS.get(listing.item_id)?.name ?? null, price: listing.price, amount: proceeds });
  const unlocked = [...(await unlock(c.env, me, ["dressed_up"])), ...(await checkLive(c.env, me))];
  return c.json({ balance: await balanceOf(c.env, me), unlocked: unlocked.map((a) => a.id) });
});
