import type { Metadata } from "next";
import { LeaderboardView } from "./LeaderboardView";

export const metadata: Metadata = { title: "Leaderboard · Planary Casino" };

export default function LeaderboardPage() {
  return <LeaderboardView />;
}
