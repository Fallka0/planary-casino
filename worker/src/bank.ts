// The bank: the house's own account. Bets at house games and shop spend go in,
// winnings come out. Schema and reasoning in migrations/0006_bank.sql.

import type { Env } from "./env";
import { zurichDay } from "./time";

/** Games played player against player. Their chips change hands between seats and never touch the bank. */
const POOLED = new Set(["poker"]);

export function touchesBank(entry: { kind: string; game?: string }) {
  return entry.kind === "shop" || (entry.kind === "game" && !POOLED.has(entry.game ?? ""));
}

/**
 * The bank's side of one movement, for the same batch as the ledger row it
 * mirrors. Place it straight after that insert: it only books when the insert
 * went through, so a refused bet never reaches the bank.
 */
export function bankEntry(env: Env, source: string, side: "in" | "out", amount: number, at = Date.now()) {
  const column = side === "in" ? "chips_in" : "chips_out";
  return env.DB.prepare(
    `INSERT INTO bank_days (day, source, ${column}) SELECT ?1, ?2, ?3 WHERE changes() = 1
     ON CONFLICT (day, source) DO UPDATE SET ${column} = ${column} + excluded.${column}`,
  ).bind(zurichDay(at), source, amount);
}

export async function bankBalance(env: Env) {
  const row = await env.DB.prepare("SELECT COALESCE(SUM(chips_in - chips_out), 0) AS balance FROM bank_days").first<{ balance: number }>();
  return row?.balance ?? 0;
}
