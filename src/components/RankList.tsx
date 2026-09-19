import Link from "next/link";
import type { BoardRow } from "@/lib/api";
import { formatChips } from "@/lib/games";
import { Avatar } from "./Avatar";
import { ChipIcon } from "./ChipIcon";

export function RankList({ rows }: { rows: BoardRow[] }) {
  return (
    <ol className="ranks">
      {rows.map((row) => (
        <li key={row.id} className={`rank${row.isMe ? " is-me" : ""}`}>
          <span className="rank-pos">{row.rank}</span>
          <Avatar player={row} size={36} />
          <Link href={`/u/${row.id}`} className="rank-name">
            {row.isMe ? `${row.name} (you)` : row.name}
            {row.title ? <span className="rank-title">{row.title}</span> : null}
          </Link>
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
