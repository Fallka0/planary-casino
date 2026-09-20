#!/bin/sh
# Copies the canonical fairness module and its frozen vectors into every game.
#
# The scheme only works if the table, the archive and the verifier agree on the
# arithmetic to the bit, so there is exactly one source and the copies are
# never edited by hand. Each project runs fair-test.mjs against the same
# vectors, which is what actually catches a drift.
set -e
here=$(cd "$(dirname "$0")/.." && pwd)
for project in planary-roulette planary-blackjack planary-devil; do
  target="$here/../$project"
  [ -d "$target" ] || { echo "skip $project (not here)"; continue; }
  mkdir -p "$target/shared" "$target/scripts"
  cp "$here/shared/fair.ts" "$target/shared/fair.ts"
  cp "$here/shared/fair.vectors.json" "$target/shared/fair.vectors.json"
  cp "$here/scripts/fair-test.mjs" "$target/scripts/fair-test.mjs"
  echo "synced → $project"
done
