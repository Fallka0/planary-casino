"use client";

import Link from "next/link";
import { type Board, useCasino } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import { RankList } from "./RankList";

/** Lobby panel: this week's top winners at the tables. */
export function WeekBoard() {
  const { user, loading, signIn } = useAuth();
  const { data } = useCasino<Board>(user ? "/v1/leaderboard?scope=all" : null, 60_000);

  return (
    <section className="panel" aria-labelledby="board-title">
      <div className="panel-head">
        <h2 id="board-title">This week</h2>
      </div>
      {loading ? null : !user ? (
        <p className="panel-empty">
          <button className="link-btn" onClick={() => signIn("login")}>
            Sign in
          </button>{" "}
          to see who is winning this week.
        </p>
      ) : !data ? (
        <div className="panel-skeleton" aria-hidden="true" />
      ) : data.rows.length === 0 ? (
        <p className="panel-empty">No hands played this week yet. The first win puts you on top.</p>
      ) : (
        <RankList rows={data.rows.slice(0, 5)} />
      )}
      <Link href="/leaderboard" className="panel-link">
        Full leaderboard
      </Link>
    </section>
  );
}
