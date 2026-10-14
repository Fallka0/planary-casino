import Link from "next/link";
import type { BoardRow } from "@/lib/api";
import { formatChips } from "@/lib/games";
import { Avatar } from "./Avatar";
import { ChipIcon } from "./ChipIcon";

/** One decimal while the return is small, whole numbers once it isn't. */
function formatPct(pct: number) {
  const size = Math.abs(pct);
  const digits = size < 10 && Math.round(size * 10) % 10 !== 0 ? 1 : 0;
  const text = size.toLocaleString("de-CH", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${pct >= 0.05 ? "+" : pct <= -0.05 ? "−" : ""}${text}%`;
}

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
            {formatPct(row.pct)}
            <span className="rank-net">
              <ChipIcon size={13} />
              {row.net > 0 ? "+" : row.net < 0 ? "−" : ""}
              {formatChips(Math.abs(row.net))}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
