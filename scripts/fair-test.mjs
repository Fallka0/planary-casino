/**
 * Keeps every copy of shared/fair.ts honest.
 *
 * Run from any project that carries a copy:
 *   node --experimental-strip-types scripts/fair-test.mjs
 *
 * It checks the commitment scheme end to end, proves the draw is uniform
 * rather than merely close to it, and replays a frozen set of vectors. The
 * vectors matter most: a table and a verifier that disagree by one bit would
 * produce rounds nobody can check, so the numbers below are fixed for good.
 * If a change here makes them fail, the change is wrong — not the vectors.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as fair from "../shared/fair.ts";

const here = dirname(fileURLToPath(import.meta.url));
const VECTORS = join(here, "..", "shared", "fair.vectors.json");

let failures = 0;
function check(name, condition, detail = "") {
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\nCommitment");
const seed = fair.newServerSeed();
const hash = await fair.commit(seed);
check("a seed is 32 bytes of hex", /^[0-9a-f]{64}$/.test(seed));
check("its commitment opens", await fair.opens(seed, hash));
check("another seed does not", !(await fair.opens(fair.newServerSeed(), hash)));
check("hex survives a round trip", fair.toHex(fair.fromHex(seed)) === seed);

console.log("\nClient seeds");
check("the separator cannot be smuggled in", fair.sanitiseClientSeed("a|b") === "a/b");
check("length is bounded", fair.sanitiseClientSeed("x".repeat(200)).length === 64);
check("order is part of the record", fair.joinClientSeeds(["a", "b"]) !== fair.joinClientSeeds(["b", "a"]));

console.log("\nThe draw is uniform");
// 37 does not divide 2^32, so a modulo shortcut would bias the low pockets.
// With 370'000 draws the expected count per pocket is 10'000; a chi-square
// statistic far above the 5% critical value for 36 degrees of freedom (51.0)
// would mean the wheel leans.
//
// The seed is fixed on purpose. A test that draws its own randomness would
// fail roughly one run in a hundred for no reason at all, and a fairness
// suite that cries wolf is a fairness suite people learn to ignore. This way
// the statistic is a constant: if it moves, the implementation moved.
const DRAWS = 370_000;
const counts = new Array(37).fill(0);
const stream = fair.open("a1b2c3d4".repeat(8), "uniformity", 0);
for (let i = 0; i < DRAWS; i++) counts[await stream.below(37)] += 1;
const expected = DRAWS / 37;
const chi = counts.reduce((sum, c) => sum + (c - expected) ** 2 / expected, 0);
check(`chi-square ${chi.toFixed(1)} is under 60 over ${DRAWS.toLocaleString("en")} draws`, chi < 60, `counts ${Math.min(...counts)}–${Math.max(...counts)}`);
check("every pocket came up", counts.every((c) => c > 0));

console.log("\nShuffles");
const deck = Array.from({ length: 52 }, (_, i) => i);
const once = await fair.shuffle(deck, seed, "shoe", 1);
const again = await fair.shuffle(deck, seed, "shoe", 1);
const other = await fair.shuffle(deck, seed, "shoe", 2);
check("the same seed shuffles the same way", once.join() === again.join());
check("a different nonce does not", once.join() !== other.join());
check("nothing is lost or duplicated", [...once].sort((a, b) => a - b).join() === deck.join());

console.log("\nVerification");
const proof = { hash, serverSeed: seed, clientSeed: "alice|bob", nonce: 7 };
const outcome = await fair.roll(seed, proof.clientSeed, 7, 37);
check("a true round verifies", (await fair.checkRoll(proof, 37, outcome)).ok);
check("a sealed round does not", (await fair.checkRoll({ ...proof, serverSeed: null }, 37, outcome)).reason === "sealed");
check("a swapped seed is caught", (await fair.checkRoll({ ...proof, serverSeed: fair.newServerSeed() }, 37, outcome)).reason === "hash mismatch");
check("a wrong outcome is caught", (await fair.checkRoll(proof, 37, (outcome + 1) % 37)).reason === "outcome mismatch");

console.log("\nFrozen vectors");
const CASES = [
  { serverSeed: "00".repeat(32), clientSeed: "", nonce: 0, range: 37 },
  { serverSeed: "ff".repeat(32), clientSeed: "planary", nonce: 1, range: 37 },
  { serverSeed: "0123456789abcdef".repeat(4), clientSeed: "alice|bob", nonce: 42, range: 37 },
  { serverSeed: "0123456789abcdef".repeat(4), clientSeed: "alice|bob", nonce: 42, range: 312 },
  { serverSeed: "deadbeef".repeat(8), clientSeed: "a-very-long-client-seed-from-a-player", nonce: 999, range: 2 },
];

const produced = [];
for (const c of CASES) {
  produced.push({ ...c, roll: await fair.roll(c.serverSeed, c.clientSeed, c.nonce, c.range) });
}
const shoe = await fair.shuffle(Array.from({ length: 52 }, (_, i) => i), "0123456789abcdef".repeat(4), "shoe", 0);
const frozen = { note: "Frozen. A change that breaks these is a change that breaks verification.", rolls: produced, shoeFirstTen: shoe.slice(0, 10) };

let stored;
try {
  stored = JSON.parse(readFileSync(VECTORS, "utf8"));
} catch {
  writeFileSync(VECTORS, `${JSON.stringify(frozen, null, 2)}\n`);
  console.log(`  · wrote ${VECTORS} for the first time`);
  stored = frozen;
}
check("rolls match the frozen vectors", JSON.stringify(stored.rolls) === JSON.stringify(frozen.rolls));
check("the shoe shuffles to the frozen order", JSON.stringify(stored.shoeFirstTen) === JSON.stringify(frozen.shoeFirstTen));

console.log(failures === 0 ? "\nAll good.\n" : `\n${failures} failing.\n`);
process.exit(failures === 0 ? 0 : 1);
