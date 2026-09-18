import { formatChips } from "@/lib/games";
import { initials, type SampleRank } from "@/lib/sample";
import { ChipIcon } from "./ChipIcon";

export function RankList({ ranks }: { ranks: SampleRank[] }) {
  return (
    <ol className="ranks">
      {ranks.map((rank, i) => (
        <li key={rank.name} className="rank">
          <span className="rank-pos">{i + 1}</span>
          <span className="avatar" aria-hidden="true">
            {initials(rank.name)}
          </span>
          <span className="rank-name">{rank.name}</span>
          <span className="rank-chips">
            <ChipIcon size={15} />
            {formatChips(rank.chips)}
          </span>
        </li>
      ))}
    </ol>
  );
}
