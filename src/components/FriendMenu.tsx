"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Coins, DoorOpen, MessageCircle, Send, UserRound, UserX } from "lucide-react";
import { ApiError, describePresence, type Friend, tableUrl, useCasinoAction } from "@/lib/api";
import { Avatar } from "./Avatar";

const GAME_HOSTS = { blackjack: "https://21.planary.ch", roulette: "https://roulette.planary.ch" } as const;

function privateTableId() {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `p-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

/**
 * Everything you can do with a friend, from wherever their name shows up.
 * Rendered into the body and positioned against the viewport: the sidebar is
 * sticky, and a sticky element traps its descendants in its own stacking
 * context, which would let the page behind it paint over the menu.
 */
export function FriendMenu({ friend, anchor, onClose }: { friend: Friend; anchor: HTMLElement; onClose: () => void }) {
  const act = useCasinoAction();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const join = tableUrl(friend.presence);

  useLayoutEffect(() => {
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const menu = ref.current;
      const w = menu?.offsetWidth ?? 260;
      const h = menu?.offsetHeight ?? 320;
      const roomRight = window.innerWidth - r.right > w + 16;
      const left = roomRight ? r.right + 10 : Math.max(12, Math.min(r.left, window.innerWidth - w - 12));
      const top = roomRight ? Math.min(Math.max(12, r.top - 8), window.innerHeight - h - 12) : Math.min(r.bottom + 8, window.innerHeight - h - 12);
      setPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor]);

  useEffect(() => {
    const away = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node) && !anchor.contains(event.target as Node)) onClose();
    };
    const esc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        anchor.focus();
      }
    };
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [anchor, onClose]);

  // Focus the first action once the menu is placed (it's hidden until then).
  const placed = pos !== null;
  useEffect(() => {
    if (placed) ref.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
  }, [placed]);

  async function invite(game: keyof typeof GAME_HOSTS) {
    setBusy(true);
    setStatus(null);
    const table = privateTableId();
    try {
      await act("/v1/invites", { userId: friend.id, game, table });
      // Open the table the invite points to; the friend gets a notification with the same link.
      window.location.href = `${GAME_HOSTS[game]}/t/${table}`;
    } catch (e) {
      setStatus(e instanceof ApiError ? e.message : "Couldn't send the invite.");
      setBusy(false);
    }
  }

  async function remove() {
    await act("/v1/friends/remove", { userId: friend.id }).catch(() => {});
    onClose();
  }

  return createPortal(
    <div
      ref={ref}
      className="friend-menu"
      role="menu"
      aria-label={`${friend.name}`}
      style={pos ? { top: pos.top, left: pos.left } : { visibility: "hidden" }}
    >
      <div className="friend-menu-head">
        <Avatar player={friend} size={44} status={friend.presence.online ? "online" : null} />
        <span className="friend-copy">
          <strong>{friend.name}</strong>
          <span className="friend-status">{friend.title ?? describePresence(friend.presence)}</span>
        </span>
      </div>
      <div className="friend-menu-list">
        {join ? (
          <a role="menuitem" href={join} className="is-primary">
            <DoorOpen size={17} strokeWidth={2} aria-hidden="true" /> Join their table
          </a>
        ) : null}
        <Link role="menuitem" href={`/u/${friend.id}`} onClick={onClose}>
          <UserRound size={17} strokeWidth={2} aria-hidden="true" /> View profile
        </Link>
        <Link role="menuitem" href={`/messages?with=${friend.id}`} onClick={onClose}>
          <MessageCircle size={17} strokeWidth={2} aria-hidden="true" /> Send a message
        </Link>
        <p className="friend-menu-label">Invite to a new private table</p>
        <div className="friend-menu-row">
          <button role="menuitem" onClick={() => void invite("blackjack")} disabled={busy}>
            <Send size={15} strokeWidth={2} aria-hidden="true" /> Blackjack
          </button>
          <button role="menuitem" onClick={() => void invite("roulette")} disabled={busy}>
            <Send size={15} strokeWidth={2} aria-hidden="true" /> Roulette
          </button>
        </div>
        <Link role="menuitem" href={`/chips?to=${friend.id}`} onClick={onClose}>
          <Coins size={17} strokeWidth={2} aria-hidden="true" /> Send chips
        </Link>
        {confirmRemove ? (
          <button role="menuitem" className="is-danger" onClick={() => void remove()}>
            <UserX size={17} strokeWidth={2} aria-hidden="true" /> Yes, remove {friend.name}
          </button>
        ) : (
          <button role="menuitem" className="is-quiet" onClick={() => setConfirmRemove(true)}>
            <UserX size={17} strokeWidth={2} aria-hidden="true" /> Remove friend
          </button>
        )}
      </div>
      {status ? <p className="form-error friend-menu-error">{status}</p> : null}
    </div>,
    document.body,
  );
}

/** A friend's row that opens the menu. */
export function FriendButton({ friend, children, className }: { friend: Friend; children: React.ReactNode; className?: string }) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        ref={setAnchor}
        className={className}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        aria-label={`${friend.name}, ${describePresence(friend.presence)}. Open menu`}
      >
        {children}
      </button>
      {open && anchor ? <FriendMenu friend={friend} anchor={anchor} onClose={() => setOpen(false)} /> : null}
    </>
  );
}
