/**
 * Nerve — the whole game, in one function.
 *
 * ── Canonical copy ──────────────────────────────────────────────────
 * Lives at planary-casino/shared/nerve.ts and is copied into the game by
 * `scripts/sync-fair.sh`. Never edit a copy: the table and the verifier have
 * to agree on where a climb stops, to the last hundredth.
 *
 * A number climbs from 1.00×. At some point it stops. You decide when to get
 * out, and you only know afterwards whether you were right.
 *
 * ── The one rule that makes it honest ───────────────────────────────
 *
 * The chance of the climb reaching x is exactly (1 − edge) / x.
 *
 * That single line decides everything. Aim for 2× and you get there about half
 * the time, for double. Aim for 10× and you get there a tenth as often, for
 * ten times as much. So the expected return of cashing out at x is
 *
 *     x · (1 − edge) / x  =  1 − edge
 *
 * — the same number whatever you aim for. There is no clever target and no
 * bad one, exactly as on a European wheel where a straight-up bet and red
 * carry the identical edge. What is left is nerve, which is the game.
 */

import { open as openStream } from "./fair";

/** The house edge, stated plainly and the same for every cash-out. */
export const EDGE = 0.01;

/** Below this the climb never starts: the cable goes immediately. */
export const MIN_CRASH = 1;

/**
 * Where this round stops, from the seed the table committed to beforehand.
 *
 * The draw is a uniform float, so the curve above follows directly: a climb
 * reaches x whenever the draw lands under (1 − edge) / x.
 */
export async function crashPoint(serverSeed: string, clientSeed: string, nonce: number, edge = EDGE): Promise<number> {
  const stream = openStream(serverSeed, clientSeed, nonce);
  // 45 bits of the stream as a float in (0, 1]. A draw of zero would mean a
  // climb that never stops, so the range starts at one step above it.
  const high = await stream.below(0x20_0000);
  const low = await stream.below(0x100_0000);
  const draw = (high * 0x100_0000 + low + 1) / (0x20_0000 * 0x100_0000);
  return Math.max(MIN_CRASH, Math.floor(((1 - edge) / draw) * 100) / 100);
}

/** The chance a climb reaches this multiplier. What the player is really betting on. */
export function chanceOf(target: number, edge = EDGE): number {
  return target <= 1 ? 1 : Math.min(1, (1 - edge) / target);
}

/**
 * How high the climb has got, `ms` after it started.
 *
 * Slow at first so there is time to think, then faster and faster, so the
 * decision gets harder the longer it is put off. The curve is exponential:
 * every GROWTH_MS the number is multiplied again.
 */
export const GROWTH_MS = 5_200;

export function multiplierAt(ms: number): number {
  if (ms <= 0) return 1;
  return Math.floor(Math.E ** (ms / GROWTH_MS) * 100) / 100;
}

/** How long a climb to `target` takes — the server's timer for the whole round. */
export function msToReach(target: number): number {
  return target <= 1 ? 0 : Math.log(target) * GROWTH_MS;
}

/** 1.00 → "1.00×". Two decimals always, because 2.5 and 2.50 read differently under pressure. */
export function formatMultiplier(value: number): string {
  return `${value.toFixed(2)}×`;
}
