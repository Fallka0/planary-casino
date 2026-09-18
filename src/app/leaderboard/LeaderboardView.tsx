"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { RankList } from "@/components/RankList";
import { SignInPrompt } from "@/components/SignInPrompt";
import { type Board, useCasino } from "@/lib/api";

export function LeaderboardView() {
  const { user, loading } = useAuth();
  const [scope, setScope] = useState<"friends" | "all">("friends");
  const { data } = useCasino<Board>(user ? `/v1/leaderboard?scope=${scope}` : null, 60_000);
  const week = data ? new Date(data.weekStart).toLocaleDateString("de-CH", { day: "numeric", month: "long" }) : null;

  return (
    <section className="page" aria-labelledby="page-title">
      <div className="page-head">
        <h1 id="page-title">Leaderboard</h1>
        <p className="page-sub">
          Net chips won at the tables this week{week ? `, since Monday ${week}` : ""}. Bonuses and gifts don&apos;t count. Resets every Monday.
        </p>
      </div>

      {loading ? null : !user ? (
        <SignInPrompt what="Sign in to see the weekly rankings." />
      ) : (
        <>
          <div className="filters" role="group" aria-label="Show">
            <button className="filter" aria-pressed={scope === "friends"} onClick={() => setScope("friends")}>
              Friends
            </button>
            <button className="filter" aria-pressed={scope === "all"} onClick={() => setScope("all")}>
              Everyone
            </button>
          </div>
          <section className="card board-card">
            {!data || data.scope !== scope ? (
              <div className="panel-skeleton tall" aria-hidden="true" />
            ) : data.rows.length === 0 ? (
              <p className="card-text">
                {scope === "friends" ? "Nobody in your circle has played this week yet." : "No hands played this week yet."} Win a hand of
                Blackjack to get on the board.
              </p>
            ) : (
              <>
                <RankList rows={data.rows} />
                {!data.me ? <p className="card-text board-note">You haven&apos;t played this week yet.</p> : null}
              </>
            )}
          </section>
        </>
      )}
    </section>
  );
}
