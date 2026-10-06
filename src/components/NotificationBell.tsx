"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Bell, Check, X } from "lucide-react";
import { ApiError, useCasino, useCasinoAction } from "@/lib/api";
import { formatChips } from "@/lib/games";
import { AchievementBadge } from "./AchievementBadge";
import { Avatar } from "./Avatar";
import { type NotificationItem, useSocial } from "./Social";

const GAME = {
  blackjack: { name: "Blackjack", host: "https://21.planary.ch" },
  roulette: { name: "Roulette", host: "https://roulette.planary.ch" },
} as const;

export function timeAgo(ms: number, now: number) {
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  return d < 7 ? `${d} d` : new Date(ms).toLocaleDateString("de-CH", { day: "numeric", month: "short" });
}

function Item({ n, now, onDone }: { n: NotificationItem; now: number; onDone: () => void }) {
  const act = useCasinoAction();
  // An answer settles the prompt here and now: the reload behind `act` arrives a
  // round trip later, and until then the buttons would invite a second click
  // that only 404s.
  const [answered, setAnswered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const who = n.actor?.name ?? "Someone";
  const game = n.data?.game === "roulette" || n.data?.game === "blackjack" ? GAME[n.data.game] : null;

  async function answer(path: string) {
    setBusy(true);
    setFailed(null);
    try {
      await act(path, { userId: n.actor!.id });
      setAnswered(true);
    } catch (e) {
      // Already answered elsewhere: the prompt is spent either way.
      if (e instanceof ApiError && e.status === 404) setAnswered(true);
      else setFailed(e instanceof ApiError ? e.message : "Didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  let text: React.ReactNode;
  let actions: React.ReactNode = null;
  switch (n.kind) {
    case "friend_request":
      text = (
        <>
          <strong>{who}</strong> wants to be friends.
        </>
      );
      actions =
        n.resolved || answered || !n.actor ? null : (
          <>
            <button className="btn btn-sm btn-cherry" onClick={() => void answer("/v1/friends/accept")} disabled={busy}>
              <Check size={14} strokeWidth={2.6} aria-hidden="true" /> Accept
            </button>
            <button className="icon-btn" onClick={() => void answer("/v1/friends/remove")} disabled={busy} aria-label={`Decline ${who}`}>
              <X size={15} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </>
        );
      break;
    case "friend_accepted":
      text = (
        <>
          <strong>{who}</strong> accepted your friend request.
        </>
      );
      break;
    case "chips_received":
      text = (
        <>
          <strong>{who}</strong> sent you {formatChips(n.data?.amount ?? 0)} chips.
        </>
      );
      break;
    case "table_invite":
      text = (
        <>
          <strong>{who}</strong> invited you to {game ? game.name : "a table"}.
        </>
      );
      actions =
        game && n.data?.table && now - n.at < 3 * 3600_000 ? (
          <a className="btn btn-sm btn-cherry" href={`${game.host}/t/${n.data.table}`}>
            Join
          </a>
        ) : null;
      break;
    case "announcement":
      text = (
        <>
          <strong>{n.data?.title ?? "News from Planary Casino"}</strong> {n.data?.body}
        </>
      );
      break;
    case "staff":
      text = <>{n.data?.text ?? "A message from Planary Casino."}</>;
      break;
    case "achievement":
      text = (
        <>
          Unlocked <strong>{n.achievement?.name ?? "an achievement"}</strong>
          {n.data?.rewards?.length ? ", with a reward in your shop inventory" : ""}.
        </>
      );
      break;
  }

  return (
    <li className={`notif${n.read ? "" : " is-new"}`}>
      {n.kind === "achievement" && n.achievement ? (
        <AchievementBadge grade={n.achievement.grade} glyph={n.achievement.glyph} size={40} />
      ) : n.actor ? (
        <Link href={`/u/${n.actor.id}`} onClick={onDone} className="notif-avatar">
          <Avatar player={n.actor} size={40} />
        </Link>
      ) : null}
      <div className="notif-copy">
        <p>{text}</p>
        <time>{timeAgo(n.at, now)}</time>
        {actions ? <div className="notif-actions">{actions}</div> : null}
        {failed ? <p className="form-error notif-error">{failed}</p> : null}
      </div>
    </li>
  );
}

export function NotificationBell() {
  const { unread, refresh } = useSocial();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const { data, reload } = useCasino<{ notifications: NotificationItem[] }>(open ? "/v1/notifications" : null);
  const act = useCasinoAction();

  useEffect(() => {
    if (!open) return;
    reload();
    const away = (event: MouseEvent) => !ref.current?.contains(event.target as Node) && setOpen(false);
    const esc = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    // Opening the panel counts as reading it.
    const timer = window.setTimeout(() => void act("/v1/notifications/read", {}).then(refresh, () => {}), 1500);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open, reload, act, refresh]);

  const count = unread.notifications;
  return (
    <div className="bell" ref={ref}>
      <button
        className="bell-btn"
        onClick={() => {
          setNow(Date.now());
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={count ? `Notifications, ${count} new` : "Notifications"}
      >
        <Bell size={19} strokeWidth={1.9} aria-hidden="true" />
        {count ? <span className="badge">{count > 9 ? "9+" : count}</span> : null}
      </button>
      {open ? (
        <div className="bell-panel" id={panelId} role="dialog" aria-label="Notifications">
          <div className="bell-head">
            <h2>Notifications</h2>
          </div>
          {!data ? (
            <div className="panel-skeleton" aria-hidden="true" />
          ) : data.notifications.length === 0 ? (
            <p className="bell-empty">Nothing yet. Friend requests, invites and new achievements show up here.</p>
          ) : (
            <ul className="notif-list">
              {data.notifications.map((n) => (
                <Item key={n.id} n={n} now={now} onDone={() => setOpen(false)} />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
