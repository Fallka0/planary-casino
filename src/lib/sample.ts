// SAMPLE DATA. There is no social or wallet backend yet; everything here is illustrative
// and is always rendered with a "Sample" label. Replace with real queries once Postgres lands.

import type { GameId } from "./games";

export interface SampleFriend {
  name: string;
  status: "online" | "away";
  /** Game the friend is waiting on, if any. */
  game?: GameId;
}

export const SAMPLE_FRIENDS: SampleFriend[] = [
  { name: "Lea Brunner", status: "online", game: "blackjack" },
  { name: "Jonas Keller", status: "online", game: "poker" },
  { name: "Mia Rossi", status: "away" },
  { name: "Noah Frei", status: "online" },
];

export interface SampleRank {
  name: string;
  chips: number;
}

export const SAMPLE_LEADERBOARD: SampleRank[] = [
  { name: "Lea Brunner", chips: 18450 },
  { name: "Jonas Keller", chips: 12900 },
  { name: "Samira Haddad", chips: 9720 },
  { name: "Luca Meier", chips: 7340 },
  { name: "Mia Rossi", chips: 5010 },
];

export function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
