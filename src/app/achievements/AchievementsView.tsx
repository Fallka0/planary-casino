"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AchievementBadge } from "@/components/AchievementBadge";
import { useAuth } from "@/components/AuthProvider";
import { SignInPrompt } from "@/components/SignInPrompt";
import { type AchievementEntry, ApiError, type Profile, useCasino, useCasinoAction } from "@/lib/api";
import { formatChips } from "@/lib/games";
import { percent, rarityLabel } from "@/lib/image";

const CATEGORIES: { id: AchievementEntry["category"]; label: string }[] = [
  { id: "blackjack", label: "Blackjack" },
  { id: "poker", label: "Hold’em" },
  { id: "roulette", label: "Roulette" },
  { id: "grimoire", label: "Grimoire" },
  { id: "chips", label: "Chips" },
  { id: "social", label: "Social" },
  { id: "collector", label: "Collector" },
];

type Filter = "all" | "claim" | "unlocked" | "locked";

function when(ms: number) {
  return new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

interface Claimed {
  claimed: { id: string; chips: number; items: string[] }[];
  balance: number;
}

function Card({ a, onClaim, busy }: { a: AchievementEntry; onClaim?: () => void; busy?: boolean }) {
  const locked = !a.unlockedAt;
  const label = rarityLabel(a.rarity);
  const reward = a.rewards?.length ? ` + ${a.rewards.map((r) => r.name).join(", ")}` : "";
  return (
    <li className={`achv${locked ? " is-locked" : ""}${a.claimable ? " is-claimable" : ""} achv-g${a.grade}`}>
      <AchievementBadge grade={a.grade} glyph={a.glyph} size={84} locked={locked} />
      <div className="achv-copy">
        <strong>{a.name}</strong>
        <p>{a.description}</p>
        <div className="achv-foot">
          <span className={`rarity rarity-${label.toLowerCase()}`} title={`${percent(a.rarity)} of players have this`}>
            {label} · {percent(a.rarity)}
          </span>
          {a.unlockedAt && !a.claimable ? (
            <time>{when(a.unlockedAt)}</time>
          ) : (
            <span className="achv-chips">
              +{formatChips(a.chips)} chips{reward}
            </span>
          )}
        </div>
        {a.claimable && onClaim ? (
          <button className="btn btn-sm btn-cherry achv-claim" onClick={onClaim} disabled={busy}>
            {busy ? "Claiming…" : `Claim +${formatChips(a.chips)} chips`}
          </button>
        ) : null}
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
  const act = useCasinoAction();
  const [filter, setFilter] = useState<Filter>("all");
  const [rarest, setRarest] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [claimNote, setClaimNote] = useState<{ ok: boolean; text: string } | null>(null);

  const list = data?.achievements ?? [];
  const unlocked = list.filter((a) => a.unlockedAt);
  const waiting = list.filter((a) => a.claimable);
  const waitingChips = waiting.reduce((sum, a) => sum + a.chips, 0);
  const rarestOwned = [...unlocked].sort((a, b) => a.rarity - b.rarity)[0];
  const shown: Filter = filter === "claim" && !waiting.length ? "all" : filter;
  const visible = list.filter((a) =>
    shown === "all" ? true : shown === "claim" ? a.claimable : shown === "unlocked" ? a.unlockedAt : !a.unlockedAt,
  );
  const isMine = !other || owner?.relation === "self";

  async function collect(id: string | null) {
    setClaiming(id ?? "all");
    setClaimNote(null);
    try {
      const res = await act<Claimed>(id ? `/v1/achievements/${id}/claim` : "/v1/achievements/claim-all");
      const chips = res.claimed.reduce((sum, c) => sum + c.chips, 0);
      const items = res.claimed.reduce((sum, c) => sum + c.items.length, 0);
      setClaimNote({
        ok: true,
        text: `+${formatChips(chips)} chips${items ? `, and ${items === 1 ? "a reward" : `${items} rewards`} in your inventory` : ""}.`,
      });
    } catch (e) {
      setClaimNote({ ok: false, text: e instanceof ApiError ? e.message : "That didn't work." });
    } finally {
      setClaiming(null);
    }
  }
  const claimFor = (a: AchievementEntry) => (isMine && a.claimable ? () => void collect(a.id) : undefined);

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
            {isMine && waiting.length ? (
              <div className="achv-claims">
                <span>
                  <small>Ready to claim</small>
                  <strong>+{formatChips(waitingChips)} chips</strong>
                  <span>
                    {waiting.length} {waiting.length === 1 ? "achievement" : "achievements"}
                  </span>
                </span>
                <button className="btn btn-cherry" onClick={() => void collect(null)} disabled={claiming !== null}>
                  {claiming === "all" ? "Claiming…" : waiting.length === 1 ? "Claim" : "Claim all"}
                </button>
              </div>
            ) : null}
            {claimNote ? <p className={claimNote.ok ? "form-ok" : "form-error"}>{claimNote.text}</p> : null}
            {!isMine && owner ? (
              <Link className="btn btn-quiet" href={`/u/${owner.id}`}>
                Back to profile
              </Link>
            ) : null}
          </div>

          <div className="shop-bar">
            <div className="filters" role="group" aria-label="Show">
              {(["all", ...(isMine && waiting.length ? (["claim"] as const) : []), "unlocked", "locked"] as const).map((f) => (
                <button key={f} className="filter" aria-pressed={shown === f} onClick={() => setFilter(f)}>
                  {f === "all" ? "All" : f === "claim" ? `To claim · ${waiting.length}` : f === "unlocked" ? "Unlocked" : "Locked"}
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
                <Card key={a.id} a={a} onClaim={claimFor(a)} busy={claiming === a.id || claiming === "all"} />
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
                      <Card key={a.id} a={a} onClaim={claimFor(a)} busy={claiming === a.id || claiming === "all"} />
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
