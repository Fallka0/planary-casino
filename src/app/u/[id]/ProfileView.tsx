"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Camera, Check, Coins, MessageCircle, Pencil, Sparkles, UserPlus, X } from "lucide-react";
import { AchievementBadge } from "@/components/AchievementBadge";
import { useAuth } from "@/components/AuthProvider";
import { Avatar } from "@/components/Avatar";
import { FriendButton } from "@/components/FriendMenu";
import { SignInPrompt } from "@/components/SignInPrompt";
import {
  type AchievementEntry,
  ApiError,
  describePresence,
  type Profile,
  tableUrl,
  uploadAvatar,
  useCasino,
  useCasinoAction,
} from "@/lib/api";
import { formatChips } from "@/lib/games";
import { percent, rarityLabel, squareImage } from "@/lib/image";

function joined(ms: number) {
  return new Date(ms).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function signed(n: number) {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${formatChips(Math.abs(n))}`;
}

function Showcased({ a }: { a: AchievementEntry }) {
  return (
    <li className="showcase-item">
      <AchievementBadge grade={a.grade} glyph={a.glyph} size={104} />
      <strong>{a.name}</strong>
      <span className={`rarity rarity-${rarityLabel(a.rarity).toLowerCase()}`}>
        {rarityLabel(a.rarity)} · {percent(a.rarity)} of players
      </span>
    </li>
  );
}

function PictureButton() {
  const { accessToken } = useAuth();
  const act = useCasinoAction();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file || !accessToken) return;
    setBusy(true);
    setError(null);
    try {
      await uploadAvatar(accessToken, await squareImage(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <button className="avatar-edit" onClick={() => input.current?.click()} disabled={busy} aria-label="Change profile picture">
        <Camera size={17} strokeWidth={2.1} aria-hidden="true" />
      </button>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} />
      {error ? (
        <p className="form-error profile-pic-error" role="alert">
          {error}{" "}
          <button className="link-btn" onClick={() => void act("/v1/profile/avatar/remove").then(() => setError(null))}>
            Remove picture
          </button>
        </p>
      ) : null}
    </>
  );
}

function BioEditor({ bio, onDone }: { bio: string | null; onDone: () => void }) {
  const act = useCasinoAction();
  const [value, setValue] = useState(bio ?? "");
  return (
    <form
      className="bio-form"
      onSubmit={(e) => {
        e.preventDefault();
        void act("/v1/profile", { bio: value }).then(onDone, () => {});
      }}
    >
      <textarea value={value} onChange={(e) => setValue(e.target.value.slice(0, 160))} rows={2} maxLength={160} placeholder="A line about you" autoFocus />
      <div className="bio-actions">
        <span className="bio-count">{value.length}/160</span>
        <button type="button" className="btn btn-sm btn-quiet" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn btn-sm btn-cherry">
          Save
        </button>
      </div>
    </form>
  );
}

function ShowcasePicker({ owned, pinned, onDone }: { owned: AchievementEntry[]; pinned: string[]; onDone: () => void }) {
  const act = useCasinoAction();
  const [picked, setPicked] = useState<string[]>(pinned);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]));
  return (
    <div className="picker" role="dialog" aria-modal="true" aria-labelledby="picker-title">
      <div className="picker-card">
        <div className="picker-head">
          <h2 id="picker-title">Showcase</h2>
          <p>Pick up to three. With none picked, your rarest three are shown.</p>
          <button className="icon-btn" onClick={onDone} aria-label="Close">
            <X size={17} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
        {owned.length === 0 ? (
          <p className="card-text">No achievements yet. Play a round to earn your first.</p>
        ) : (
          <ul className="picker-grid">
            {[...owned]
              .sort((a, b) => a.rarity - b.rarity)
              .map((a) => {
                const at = picked.indexOf(a.id);
                return (
                  <li key={a.id}>
                    <button className={`picker-item${at >= 0 ? " is-picked" : ""}`} onClick={() => toggle(a.id)} aria-pressed={at >= 0}>
                      <AchievementBadge grade={a.grade} glyph={a.glyph} size={64} />
                      <span>{a.name}</span>
                      <small>{percent(a.rarity)}</small>
                      {at >= 0 ? <i className="picker-order">{at + 1}</i> : null}
                    </button>
                  </li>
                );
              })}
          </ul>
        )}
        <div className="picker-actions">
          <button className="btn btn-quiet" onClick={() => setPicked([])}>
            Use my rarest
          </button>
          <button className="btn btn-cherry" onClick={() => void act("/v1/profile", { showcase: picked }).then(onDone, () => {})}>
            Save showcase
          </button>
        </div>
      </div>
    </div>
  );
}

function Actions({ p }: { p: Profile }) {
  const act = useCasinoAction();
  const [error, setError] = useState<string | null>(null);
  const run = (path: string) => act(path, { userId: p.id }).catch((e) => setError(e instanceof ApiError ? e.message : "That didn't work."));

  if (p.relation === "self") {
    return (
      <div className="profile-actions">
        <Link className="btn btn-quiet" href="/shop">
          <Sparkles size={16} strokeWidth={2.1} aria-hidden="true" /> Customize
        </Link>
      </div>
    );
  }
  return (
    <div className="profile-actions">
      {p.relation === "friend" ? (
        <>
          {tableUrl(p.presence) ? (
            <a className="btn btn-cherry" href={tableUrl(p.presence)!}>
              Join table
            </a>
          ) : null}
          <Link className="btn btn-quiet" href={`/messages?with=${p.id}`}>
            <MessageCircle size={16} strokeWidth={2.1} aria-hidden="true" /> Message
          </Link>
          <Link className="btn btn-quiet" href={`/chips?to=${p.id}`}>
            <Coins size={16} strokeWidth={2.1} aria-hidden="true" /> Send chips
          </Link>
          <FriendButton friend={{ ...p, presence: p.presence }} className="btn btn-quiet">
            More
          </FriendButton>
        </>
      ) : p.relation === "incoming" ? (
        <button className="btn btn-cherry" onClick={() => void run("/v1/friends/accept")}>
          <Check size={16} strokeWidth={2.4} aria-hidden="true" /> Accept friend request
        </button>
      ) : p.relation === "requested" ? (
        <span className="btn btn-quiet is-static">Request sent</span>
      ) : (
        <button className="btn btn-cherry" onClick={() => void run("/v1/friends/request")}>
          <UserPlus size={16} strokeWidth={2.2} aria-hidden="true" /> Add friend
        </button>
      )}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}

export function ProfileView({ id }: { id: string }) {
  const { user, loading } = useAuth();
  const { data: p, error } = useCasino<Profile>(user ? `/v1/profile/${encodeURIComponent(id)}` : null, 30_000);
  const self = p?.relation === "self";
  const { data: mine } = useCasino<{ achievements: AchievementEntry[] }>(self ? "/v1/achievements" : null);
  const [editingBio, setEditingBio] = useState(false);
  const [picking, setPicking] = useState(false);

  if (loading) return null;
  if (!user) return <SignInPrompt what="Sign in to see player profiles." />;
  if (error && !p) return <div className="empty"><h2>Player not found</h2><p>That profile doesn&apos;t exist, or it was removed.</p></div>;
  if (!p) return <div className="panel-skeleton tall" aria-hidden="true" />;

  const stats = [
    { label: "Blackjack rounds", value: formatChips(p.stats.blackjackRounds) },
    { label: "Naturals", value: formatChips(p.stats.naturals) },
    { label: "Best streak", value: String(p.stats.bestStreak) },
    { label: "Roulette spins", value: formatChips(p.stats.rouletteSpins) },
    { label: "Best round", value: p.stats.bestRound ? `+${formatChips(p.stats.bestRound)}` : "—" },
    { label: "This week", value: signed(p.stats.weekNet), tone: p.stats.weekNet > 0 ? "up" : p.stats.weekNet < 0 ? "down" : "" },
  ];

  return (
    <section className="page profile" aria-labelledby="profile-name">
      <header className={`profile-head banner ${p.banner ?? "banner-default"}`}>
        <div className="profile-id">
          <div className="profile-avatar">
            <Avatar player={p} size={124} status={p.presence.online ? "online" : null} />
            {self ? <PictureButton /> : null}
          </div>
          <div className="profile-copy">
            {p.title ? <span className="profile-title">{p.title}</span> : null}
            <h1 id="profile-name">{p.name}</h1>
            <p className="profile-meta">
              {describePresence(p.presence)} · Joined {joined(p.joinedAt)}
            </p>
          </div>
          <Actions p={p} />
        </div>
      </header>

      <div className="profile-grid">
        <div className="profile-main">
          <section className="card" aria-labelledby="about-title">
            <div className="card-head">
              <h2 id="about-title">About</h2>
              {self && !editingBio ? (
                <button className="icon-btn" onClick={() => setEditingBio(true)} aria-label="Edit bio">
                  <Pencil size={15} strokeWidth={2} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            {editingBio ? (
              <BioEditor bio={p.bio} onDone={() => setEditingBio(false)} />
            ) : (
              <p className={p.bio ? "profile-bio" : "card-text"}>{p.bio ?? (self ? "Add a line about yourself." : "No bio yet.")}</p>
            )}
            <dl className="profile-stats">
              {stats.map((s) => (
                <div key={s.label} className={s.tone ? `is-${s.tone}` : undefined}>
                  <dt>{s.label}</dt>
                  <dd>{s.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="card" aria-labelledby="recent-title">
            <div className="card-head">
              <h2 id="recent-title">Recently unlocked</h2>
              <Link className="card-link" href={self ? "/achievements" : `/achievements?user=${p.id}`}>
                {p.achievements.unlocked} of {p.achievements.total}
              </Link>
            </div>
            {p.recent.length === 0 ? (
              <p className="card-text">{self ? "Nothing yet. Your first round of blackjack or roulette unlocks one." : "Nothing unlocked yet."}</p>
            ) : (
              <ul className="recent-list">
                {p.recent.map((a) => (
                  <li key={a.id}>
                    <AchievementBadge grade={a.grade} glyph={a.glyph} size={48} />
                    <span>
                      <strong>{a.name}</strong>
                      <small>{a.description}</small>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="card showcase" aria-labelledby="showcase-title">
          <div className="card-head">
            <h2 id="showcase-title">Showcase</h2>
            {self ? (
              <button className="btn btn-sm btn-quiet" onClick={() => setPicking(true)}>
                Edit
              </button>
            ) : null}
          </div>
          {p.showcase.length ? (
            <ul className="showcase-list">
              {p.showcase.map((a) => (
                <Showcased key={a.id} a={a} />
              ))}
            </ul>
          ) : (
            <p className="card-text">{self ? "Unlock achievements and your rarest ones show up here." : "No achievements to show yet."}</p>
          )}
          <div className="achv-meter" aria-label={`${p.achievements.unlocked} of ${p.achievements.total} achievements`}>
            <span style={{ width: `${(p.achievements.unlocked / Math.max(1, p.achievements.total)) * 100}%` }} />
          </div>
        </section>
      </div>

      {picking && mine ? (
        <ShowcasePicker owned={mine.achievements.filter((a) => a.unlockedAt)} pinned={p.pinned} onDone={() => setPicking(false)} />
      ) : null}
    </section>
  );
}
