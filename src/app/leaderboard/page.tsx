import type { Metadata } from "next";
import { RankList } from "@/components/RankList";
import { SoonPage } from "@/components/SoonPage";
import { SAMPLE_LEADERBOARD } from "@/lib/sample";

export const metadata: Metadata = { title: "Leaderboard · Planary Casino" };

export default function LeaderboardPage() {
  return (
    <SoonPage
      title="Leaderboard"
      sub="Weekly chip rankings across every Planary table."
      what="Rankings start once the first table opens and chips can change hands. The names below are sample data."
    >
      <RankList ranks={SAMPLE_LEADERBOARD} />
    </SoonPage>
  );
}
