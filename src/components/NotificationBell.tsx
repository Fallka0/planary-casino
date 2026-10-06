"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Bell, Check, ChevronRight, RotateCw, X } from "lucide-react";
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

/** Where a notification takes you when you click it, if anywhere. */
function destination(n: NotificationItem): string | null {
  switch (n.kind) {
    case "friend_request":
    case "friend_accepted":
      return n.actor ? `/u/${n.actor.id}` : null;
    case "chips_received":
      return "/chips";
    case "achievement":
      return "/achievements";
    default:
      return null;
  }
}

function Item({ n, now, fresh, onDone }: { n: NotificationItem; now: number; fresh: boolean; onDone: () => void }) {
  const act = useCasinoAction();
  // An answer settles the prompt here and now: the reload behind `act` arrives a
  // round trip later, and until then the buttons would invite a second click
  // that only 404s.
  const [answered, setAnswered] = useState<"accepted" | "declined" | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const who = n.actor?.name ?? "Someone";
  const game = n.data?.game === "roulette" || n.data?.game === "blackjack" ? GAME[n.data.game] : null;
  const href = destination(n);

  async function answer(path: string, outcome: "accepted" | "declined") {
    setBusy(true);
    setFailed(null);
    try {
      await act(path, { userId: n.actor!.id });
      setAnswered(outcome);
    } catch (e) {
      // Already answered elsewhere: the prompt is spent either way.
      if (e instanceof ApiError && e.status === 404) setAnswered(outcome);
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
      if (answered) {
        actions = <span className="notif-done">{answered === "accepted" ? "You're friends now." : "Declined."}</span>;
      } else if (!n.resolved && n.actor) {
        actions = (
          <>
            <button className="btn btn-sm btn-cherry" onClick={() => void answer("/v1/friends/accept", "accepted")} disabled={busy}>
              <Check size={14} strokeWidth={2.6} aria-hidden="true" /> Accept
            </button>
            <button className="btn btn-sm btn-quiet" onClick={() => void answer("/v1/friends/remove", "declined")} disabled={busy} aria-label={`Decline ${who}`}>
              <X size={14} strokeWidth={2.4} aria-hidden="true" /> Decline
            </button>
          </>
        );
      }
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
          <strong>{who}</strong> sent you <strong>{formatChips(n.data?.amount ?? 0)}</strong> chips.
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
            Join table
          </a>
        ) : (
          <span className="notif-done">This invite has expired.</span>
        );
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
    default:
      // A kind this page doesn't know yet still says something.
      text = <>Something happened on your account.</>;
  }

  const icon =
    n.kind === "achievement" && n.achievement ? (
      <AchievementBadge grade={n.achievement.grade} glyph={n.achievement.glyph} size={40} />
    ) : n.actor ? (
      <Avatar player={n.actor} size={40} />
    ) : (
      <span className="notif-house" aria-hidden="true">
        <Bell size={18} strokeWidth={2} />
      </span>
    );

  const body = (
    <>
      <span className="notif-icon">{icon}</span>
      <span className="notif-copy">
        <span className="notif-text">{text}</span>
        <time dateTime={new Date(n.at).toISOString()}>{timeAgo(n.at, now)}</time>
      </span>
      {href ? <ChevronRight size={16} className="notif-go" aria-hidden="true" /> : null}
    </>
  );

  return (
    <li className={`notif${fresh ? " is-new" : ""}`}>
      {href ? (
        <Link href={href} onClick={onDone} className="notif-main">
          {body}
        </Link>
      ) : (
        <div className="notif-main">{body}</div>
      )}
      {actions || failed ? (
        <div className="notif-actions">
          {actions}
          {failed ? <p className="form-error notif-error">{failed}</p> : null}
        </div>
      ) : null}
    </li>
  );
}

export function NotificationBell() {
  const { unread, refresh } = useSocial();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();
  // Kept fresh while open, so a request that arrives meanwhile shows up.
  const { data, error, reload } = useCasino<{ notifications: NotificationItem[] }>(open ? "/v1/notifications" : null, 20_000);
  const act = useCasinoAction();

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => !ref.current?.contains(event.target as Node) && setOpen(false);
    const esc = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
      // Read on the way out, not on the way in: what was new stays marked
      // for as long as the panel is open to look at it.
      void act("/v1/notifications/read", {}).then(refresh, () => {});
    };
  }, [open, act, refresh]);

  const count = unread.notifications;
  const list = data?.notifications ?? null;
  const fresh = list?.filter((n) => !n.read) ?? [];
  const earlier = list?.filter((n) => n.read) ?? [];

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
            {fresh.length ? <span className="bell-count">{fresh.length} new</span> : null}
          </div>
          {list === null ? (
            error ? (
              <div className="bell-state">
                <p>Your notifications couldn&apos;t be loaded.</p>
                <button className="btn btn-sm btn-quiet" onClick={reload}>
                  <RotateCw size={14} aria-hidden="true" /> Try again
                </button>
              </div>
            ) : (
              <div className="bell-loading" aria-label="Loading">
                <span />
                <span />
                <span />
              </div>
            )
          ) : list.length === 0 ? (
            <div className="bell-state">
              <Bell size={22} strokeWidth={1.6} aria-hidden="true" />
              <p>Nothing yet. Friend requests, invites, chips from friends and new achievements show up here.</p>
            </div>
          ) : (
            <>
              {fresh.length ? (
                <>
                  <p className="bell-group">New</p>
                  <ul className="notif-list">
                    {fresh.map((n) => (
                      <Item key={n.id} n={n} now={now} fresh onDone={() => setOpen(false)} />
                    ))}
                  </ul>
                </>
              ) : null}
              {earlier.length ? (
                <>
                  {fresh.length ? <p className="bell-group">Earlier</p> : null}
                  <ul className="notif-list">
                    {earlier.map((n) => (
                      <Item key={n.id} n={n} now={now} fresh={false} onDone={() => setOpen(false)} />
                    ))}
                  </ul>
                </>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
