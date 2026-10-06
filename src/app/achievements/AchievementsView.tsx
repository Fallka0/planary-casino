"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AchievementBadge } from "@/components/AchievementBadge";
import { useAuth } from "@/components/AuthProvider";
import { SignInPrompt } from "@/components/SignInPrompt";
import { type AchievementEntry, type Profile, useCasino } from "@/lib/api";
import { formatChips } from "@/lib/games";
import { percent, rarityLabel } from "@/lib/image";

const CATEGORIES: { id: AchievementEntry["category"]; label: string }[] = [
  { id: "blackjack", label: "Blackjack" },
  { id: "roulette", label: "Roulette" },
  { id: "grimoire", label: "Grimoire" },
  { id: "chips", label: "Chips" },
  { id: "social", label: "Social" },
  { id: "collector", label: "Collector" },
];

type Filter = "all" | "unlocked" | "locked";

function when(ms: number) {
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function Card({ a }: { a: AchievementEntry }) {
  const locked = !a.unlockedAt;
  const label = rarityLabel(a.rarity);
  return (
    <li className={`achv${locked ? " is-locked" : ""} achv-g${a.grade}`}>
      <AchievementBadge grade={a.grade} glyph={a.glyph} size={84} locked={locked} />
      <div className="achv-copy">
        <strong>{a.name}</strong>
        <p>{a.description}</p>
        <div className="achv-foot">
          <span className={`rarity rarity-${label.toLowerCase()}`} title={`${percent(a.rarity)} of players have this`}>
            {label} · {percent(a.rarity)}
          </span>
          {a.unlockedAt ? <time>{when(a.unlockedAt)}</time> : null}
        </div>
        {a.progress ? (
          <div className="achv-progress" aria-label={`${a.progress.value} of ${a.progress.target}`}>
            <span style={{ width: `${(a.progress.value / a.progress.target) * 100}%` }} />
            <small>
              {formatChips(a.progress.value)} / {formatChips(a.progress.target)}
            </small>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function AchievementsView() {
  const params = useSearchParams();
  const other = params.get("user");
  const { user, loading } = useAuth();
  const { data } = useCasino<{ achievements: AchievementEntry[] }>(user ? `/v1/achievements${other ? `?user=${encodeURIComponent(other)}` : ""}` : null);
  const { data: owner } = useCasino<Profile>(user && other ? `/v1/profile/${encodeURIComponent(other)}` : null);
  const [filter, setFilter] = useState<Filter>("all");
  const [rarest, setRarest] = useState(false);

  const list = data?.achievements ?? [];
  const unlocked = list.filter((a) => a.unlockedAt);
  const rarestOwned = [...unlocked].sort((a, b) => a.rarity - b.rarity)[0];
  const visible = list.filter((a) => (filter === "all" ? true : filter === "unlocked" ? a.unlockedAt : !a.unlockedAt));
  const isMine = !other || owner?.relation === "self";

  return (
    <section className="page" aria-labelledby="page-title">
      <div className="page-head">
        <h1 id="page-title">{isMine ? "Achievements" : owner ? `${owner.name}'s achievements` : "Achievements"}</h1>
        <p className="page-sub">
          Earned at the tables and around the casino. Rarity is the share of all players who own one, so it shifts as people play.
        </p>
      </div>

      {loading ? null : !user ? (
        <SignInPrompt what="Sign in to see your achievements." />
      ) : !data ? (
        <div className="panel-skeleton tall" aria-hidden="true" />
      ) : (
        <>
          <div className="achv-summary">
            <div className="achv-total">
              <strong>
                {unlocked.length}
                <span>/{list.length}</span>
              </strong>
              <span>unlocked</span>
              <div className="achv-meter">
                <span style={{ width: `${(unlocked.length / Math.max(1, list.length)) * 100}%` }} />
              </div>
            </div>
            {rarestOwned ? (
              <div className="achv-rarest">
                <AchievementBadge grade={rarestOwned.grade} glyph={rarestOwned.glyph} size={72} />
                <span>
                  <small>Rarest</small>
                  <strong>{rarestOwned.name}</strong>
                  <span className={`rarity rarity-${rarityLabel(rarestOwned.rarity).toLowerCase()}`}>{percent(rarestOwned.rarity)} of players</span>
                </span>
              </div>
            ) : null}
            {!isMine && owner ? (
              <Link className="btn btn-quiet" href={`/u/${owner.id}`}>
                Back to profile
              </Link>
            ) : null}
          </div>

          <div className="shop-bar">
            <div className="filters" role="group" aria-label="Show">
              {(["all", "unlocked", "locked"] as const).map((f) => (
                <button key={f} className="filter" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  {f === "all" ? "All" : f === "unlocked" ? "Unlocked" : "Locked"}
                </button>
              ))}
            </div>
            <label className="owned-toggle">
              <input type="checkbox" checked={rarest} onChange={(e) => setRarest(e.target.checked)} /> Rarest first
            </label>
          </div>

          {rarest ? (
            <ul className="achv-grid">
              {[...visible].sort((a, b) => a.rarity - b.rarity).map((a) => (
                <Card key={a.id} a={a} />
              ))}
            </ul>
          ) : (
            CATEGORIES.map((cat) => {
              const items = visible.filter((a) => a.category === cat.id);
              if (!items.length) return null;
              const got = list.filter((a) => a.category === cat.id && a.unlockedAt).length;
              const total = list.filter((a) => a.category === cat.id).length;
              return (
                <section key={cat.id} className="achv-section" aria-labelledby={`cat-${cat.id}`}>
                  <div className="row-head">
                    <h2 id={`cat-${cat.id}`}>{cat.label}</h2>
                    <span className="achv-count">
                      {got}/{total}
                    </span>
                  </div>
                  <ul className="achv-grid">
                    {items.map((a) => (
                      <Card key={a.id} a={a} />
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </>
      )}
    </section>
  );
}
