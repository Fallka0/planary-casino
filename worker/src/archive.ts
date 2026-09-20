/**
 * The game round archive.
 *
 * Tables write here once a round is finished and paid. Nothing in this file
 * ever rewrites a round: the database refuses it, and the code is arranged so
 * that it never tries. A commitment is opened when a table promises an
 * outcome it does not yet know, and opened again — in the other sense — when
 * the table publishes the seed that proves it.
 */

import type { Env } from "./env";

export type CommitmentKind = "spin" | "shoe";

export interface OpenCommitment {
  game: string;
  tableId: string;
  kind: CommitmentKind;
  /** SHA-256 of the server seed. The seed itself stays at the table until the reveal. */
  hash: string;
  clientSeed: string;
  nonce: number;
}

export interface RoundPlayer {
  userId: string;
  seat?: number;
  staked: number;
  returned: number;
  /** This player's side of the round, as it will be replayed. */
  detail: unknown;
}

export interface RoundRecord {
  game: string;
  tableId: string;
  /** An existing commitment (a shoe already in play), or one to open now (a single spin). */
  commitmentId?: string;
  commitment?: OpenCommitment;
  startedAt: number;
  endedAt: number;
  outcome: string;
  log: unknown;
  players: RoundPlayer[];
}

/**
 * Sortable and unique: the timestamp in base 36 keeps rows in play order,
 * the random tail keeps two tables settling in the same millisecond apart.
 */
function newId(prefix: string): string {
  const stamp = Date.now().toString(36).padStart(9, "0");
  const tail = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(36).padStart(2, "0")).join("");
  return `${prefix}_${stamp}${tail}`;
}

export async function openCommitment(env: Env, c: OpenCommitment): Promise<string> {
  const id = newId("c");
  await env.DB.prepare(
    `INSERT INTO commitments (id, game, table_id, kind, hash, client_seed, nonce, opened_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  )
    .bind(id, c.game, c.tableId, c.kind, c.hash, c.clientSeed, c.nonce, Date.now())
    .run();
  return id;
}

/**
 * Writes down the seeds the players contributed, once betting has closed and
 * before the outcome is published. Permitted exactly once, while still sealed.
 */
export async function sealClientSeed(env: Env, id: string, clientSeed: string): Promise<boolean> {
  const result = await env.DB.prepare(`UPDATE commitments SET client_seed = ?2 WHERE id = ?1 AND server_seed IS NULL AND client_seed = ''`)
    .bind(id, clientSeed)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

/**
 * Publishes the seed behind a commitment. The database allows this exactly
 * once; a second attempt is a bug or an attack, and either way it fails loudly.
 */
export async function revealCommitment(env: Env, id: string, serverSeed: string): Promise<boolean> {
  const result = await env.DB.prepare(`UPDATE commitments SET server_seed = ?2, revealed_at = ?3 WHERE id = ?1 AND server_seed IS NULL`)
    .bind(id, serverSeed, Date.now())
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function saveRound(env: Env, record: RoundRecord): Promise<string> {
  const commitmentId = record.commitmentId ?? (record.commitment ? await openCommitment(env, record.commitment) : null);
  if (!commitmentId) throw new Error("a round needs a commitment");

  const id = newId("r");
  const staked = record.players.reduce((sum, p) => sum + Math.max(0, p.staked), 0);
  const returned = record.players.reduce((sum, p) => sum + Math.max(0, p.returned), 0);

  const statements = [
    env.DB.prepare(
      `INSERT INTO rounds (id, commitment_id, game, table_id, started_at, ended_at, outcome, log, staked, returned, seats)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
    ).bind(
      id,
      commitmentId,
      record.game,
      record.tableId,
      record.startedAt,
      record.endedAt,
      record.outcome.slice(0, 120),
      JSON.stringify(record.log),
      staked,
      returned,
      record.players.length,
    ),
    ...record.players.map((p) =>
      env.DB.prepare(
        `INSERT INTO round_players (round_id, user_id, seat, staked, returned, detail)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      ).bind(id, p.userId, p.seat ?? 0, p.staked, p.returned, JSON.stringify(p.detail)),
    ),
  ];
  await env.DB.batch(statements);
  return id;
}

export interface StoredRound {
  id: string;
  game: string;
  tableId: string;
  startedAt: number;
  endedAt: number;
  outcome: string;
  staked: number;
  returned: number;
  seats: number;
  proof: { hash: string; clientSeed: string; nonce: number; serverSeed: string | null; kind: string };
}

interface RoundRow {
  id: string;
  game: string;
  table_id: string;
  started_at: number;
  ended_at: number;
  outcome: string;
  staked: number;
  returned: number;
  seats: number;
  hash: string;
  client_seed: string;
  nonce: number;
  server_seed: string | null;
  kind: string;
}

function shape(row: RoundRow): StoredRound {
  return {
    id: row.id,
    game: row.game,
    tableId: row.table_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    outcome: row.outcome,
    staked: row.staked,
    returned: row.returned,
    seats: row.seats,
    proof: { hash: row.hash, clientSeed: row.client_seed, nonce: row.nonce, serverSeed: row.server_seed, kind: row.kind },
  };
}

const SELECT = `SELECT r.id, r.game, r.table_id, r.started_at, r.ended_at, r.outcome, r.staked, r.returned, r.seats,
                       c.hash, c.client_seed, c.nonce, c.server_seed, c.kind
                FROM rounds r JOIN commitments c ON c.id = r.commitment_id`;

/**
 * A player's own history, newest first. The stake and return shown are the
 * player's own, not the table's — on a busy roulette table those differ a lot.
 */
export async function roundsForPlayer(env: Env, userId: string, page = 0, size = 20) {
  const rows = await env.DB.prepare(
    `SELECT r.id, r.game, r.table_id, r.started_at, r.ended_at, r.outcome, r.seats,
            rp.staked, rp.returned,
            c.hash, c.client_seed, c.nonce, c.server_seed, c.kind
     FROM round_players rp
     JOIN rounds r ON r.id = rp.round_id
     JOIN commitments c ON c.id = r.commitment_id
     WHERE rp.user_id = ?1
     ORDER BY r.started_at DESC
     LIMIT ?2 OFFSET ?3`,
  )
    .bind(userId, size + 1, page * size)
    .all<RoundRow>();
  const list = rows.results ?? [];
  return { rounds: list.slice(0, size).map(shape), more: list.length > size, page };
}

/** One round in full, for the verifier and for support. */
export async function roundById(env: Env, id: string) {
  const row = await env.DB.prepare(
    `SELECT r.id, r.game, r.table_id, r.started_at, r.ended_at, r.outcome, r.staked, r.returned, r.seats, r.log,
            c.hash, c.client_seed, c.nonce, c.server_seed, c.kind
     FROM rounds r JOIN commitments c ON c.id = r.commitment_id
     WHERE r.id = ?1`,
  )
    .bind(id)
    .first<RoundRow & { log: string }>();
  if (!row) return null;
  const players = await env.DB.prepare(
    `SELECT rp.user_id, rp.seat, rp.staked, rp.returned, rp.detail, p.name
     FROM round_players rp LEFT JOIN players p ON p.user_id = rp.user_id
     WHERE rp.round_id = ?1 ORDER BY rp.seat`,
  )
    .bind(id)
    .all<{ user_id: string; seat: number; staked: number; returned: number; detail: string; name: string | null }>();

  return {
    ...shape(row),
    log: JSON.parse(row.log ?? "null"),
    players: (players.results ?? []).map((p) => ({
      userId: p.user_id,
      name: p.name,
      seat: p.seat,
      staked: p.staked,
      returned: p.returned,
      detail: JSON.parse(p.detail),
    })),
  };
}

/** Every round dealt out of one shoe, so a single reveal proves them all. */
export async function roundsForCommitment(env: Env, commitmentId: string) {
  const rows = await env.DB.prepare(`${SELECT} WHERE r.commitment_id = ?1 ORDER BY r.started_at`).bind(commitmentId).all<RoundRow>();
  return (rows.results ?? []).map(shape);
}

/**
 * Retention. Regulated operators keep round records for years, so the default
 * is deliberately long and the caller has to ask for anything shorter.
 */
export async function pruneRounds(env: Env, keepDays: number) {
  const cutoff = Date.now() - keepDays * 86_400_000;
  const old = await env.DB.prepare(`SELECT id FROM rounds WHERE started_at < ?1 LIMIT 500`).bind(cutoff).all<{ id: string }>();
  const ids = (old.results ?? []).map((r) => r.id);
  if (ids.length === 0) return 0;
  const marks = ids.map((_, i) => `?${i + 1}`).join(",");
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM round_players WHERE round_id IN (${marks})`).bind(...ids),
    env.DB.prepare(`DELETE FROM rounds WHERE id IN (${marks})`).bind(...ids),
  ]);
  return ids.length;
}
