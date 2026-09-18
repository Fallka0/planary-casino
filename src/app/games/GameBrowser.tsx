"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { GameTile } from "@/components/GameTile";
import { GAMES } from "@/lib/games";

const ALL = "All";
const TAGS = [ALL, ...Array.from(new Set(GAMES.flatMap((g) => g.tags)))];

export function GameBrowser() {
  const query = (useSearchParams().get("q") ?? "").trim().toLowerCase();
  const [tag, setTag] = useState(ALL);

  const results = useMemo(
    () =>
      GAMES.filter((game) => {
        const matchesTag = tag === ALL || game.tags.includes(tag);
        const haystack = `${game.name} ${game.tagline} ${game.tags.join(" ")}`.toLowerCase();
        return matchesTag && (!query || haystack.includes(query));
      }),
    [query, tag],
  );

  return (
    <section className="page" aria-labelledby="page-title">
      <div className="page-head">
        <h1 id="page-title">Games</h1>
        <p className="page-sub">Every table runs on its own planary.ch address. Blackjack is open, the rest are on the way.</p>
      </div>

      <div className="filters" role="group" aria-label="Filter by type">
        {TAGS.map((t) => (
          <button key={t} className="filter" aria-pressed={tag === t} onClick={() => setTag(t)}>
            {t}
          </button>
        ))}
      </div>

      {results.length ? (
        <div className="tiles tiles-grid">
          {results.map((game) => (
            <GameTile key={game.id} game={game} first={game.id === GAMES[0].id} />
          ))}
        </div>
      ) : (
        <div className="empty">
          <h2>No table matches {query ? `“${query}”` : "that filter"}</h2>
          <p>Try a game name like Poker or Slots, or clear the filter.</p>
          <div className="empty-actions">
            <Link href="/games" className="btn btn-quiet" onClick={() => setTag(ALL)}>
              Show all games
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
