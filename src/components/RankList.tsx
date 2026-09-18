import type { BoardRow } from "@/lib/api";
import { formatChips, initials } from "@/lib/games";
import { ChipIcon } from "./ChipIcon";

export function RankList({ rows }: { rows: BoardRow[] }) {
  return (
    <ol className="ranks">
      {rows.map((row) => (
        <li key={row.id} className={`rank${row.isMe ? " is-me" : ""}`}>
          <span className="rank-pos">{row.rank}</span>
          <span className="avatar" aria-hidden="true">
            {initials(row.name)}
          </span>
          <span className="rank-name">{row.isMe ? `${row.name} (you)` : row.name}</span>
          <span className={`rank-chips${row.net < 0 ? " is-down" : ""}`}>
            <ChipIcon size={15} />
            {row.net > 0 ? "+" : row.net < 0 ? "−" : ""}
            {formatChips(Math.abs(row.net))}
          </span>
        </li>
      ))}
    </ol>
  );
}
