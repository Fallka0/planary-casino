"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { callCasino } from "@/lib/api";
import { AchievementBadge } from "./AchievementBadge";
import { useAuth } from "./AuthProvider";

interface Unread {
  messages: number;
  notifications: number;
}

export interface NotificationItem {
  id: number;
  kind: "friend_request" | "friend_accepted" | "chips_received" | "table_invite" | "achievement" | "announcement" | "staff";
  at: number;
  read: boolean;
  actor: import("@/lib/api").PlayerBadge | null;
  data: { amount?: number; game?: string; table?: string; id?: string; rewards?: string[]; title?: string; body?: string; text?: string } | null;
  achievement: { id: string; name: string; glyph: string; grade: 1 | 2 | 3 | 4 } | null;
}

interface Toast {
  key: number;
  achievement: NonNullable<NotificationItem["achievement"]>;
}

const SocialContext = createContext<{ unread: Unread; refresh: () => void }>({
  unread: { messages: 0, notifications: 0 },
  refresh: () => {},
});

export const useSocial = () => useContext(SocialContext);

/**
 * Keeps friends posted that we're in the lobby, and keeps the unread badges fresh.
 * New achievements (from the tables too) pop up as a toast.
 */
export function SocialProvider({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuth();
  const [unread, setUnread] = useState<Unread>({ messages: 0, notifications: 0 });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [blocked, setBlocked] = useState<string | null>(null);

  useEffect(() => {
    const onBlocked = (e: Event) => setBlocked((e as CustomEvent<string>).detail);
    window.addEventListener("casino:blocked", onBlocked);
    return () => window.removeEventListener("casino:blocked", onBlocked);
  }, []);
  const seen = useRef<number | null>(null);

  const checkAchievements = useCallback(async () => {
    if (!accessToken) return;
    const { notifications } = await callCasino<{ notifications: NotificationItem[] }>(accessToken, "/v1/notifications");
    const newest = notifications[0]?.id ?? 0;
    if (seen.current === null) {
      // First look: anything already there isn't news.
      seen.current = newest;
      return;
    }
    const fresh = notifications.filter((n) => n.id > seen.current! && n.kind === "achievement" && n.achievement && !n.read);
    seen.current = Math.max(seen.current, newest);
    if (fresh.length) setToasts((list) => [...list, ...fresh.reverse().map((n) => ({ key: n.id, achievement: n.achievement! }))]);
  }, [accessToken]);

  const lastCount = useRef(0);
  const apply = useCallback(
    (next: Unread) => {
      if (next.notifications !== lastCount.current) {
        lastCount.current = next.notifications;
        void checkAchievements().catch(() => {});
      }
      setUnread(next);
    },
    [checkAchievements],
  );

  const refresh = useCallback(() => {
    if (!accessToken) return;
    callCasino<Unread>(accessToken, "/v1/unread").then(apply, () => {});
  }, [accessToken, apply]);

  useEffect(() => {
    if (!accessToken) return;
    const ping = () => callCasino<{ unread: Unread }>(accessToken, "/v1/presence", { where: "lobby" }).then((r) => apply(r.unread), () => {});
    void ping();
    void checkAchievements().catch(() => {});
    const timer = window.setInterval(ping, 30_000);
    window.addEventListener("casino:changed", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("casino:changed", refresh);
    };
  }, [accessToken, apply, refresh, checkAchievements]);

  useEffect(() => {
    if (!toasts.length) return;
    const timer = window.setTimeout(() => setToasts((list) => list.slice(1)), 5200);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  return (
    <SocialContext.Provider value={{ unread, refresh }}>
      {blocked ? (
        <div className="blocked-bar" role="alert">
          <strong>Account restricted.</strong> {blocked} If you think this is a mistake, contact support.
        </div>
      ) : null}
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.slice(0, 1).map((t) => (
          <Link key={t.key} href="/achievements" className="unlock-toast" onClick={() => setToasts((list) => list.slice(1))}>
            <AchievementBadge grade={t.achievement.grade} glyph={t.achievement.glyph} size={58} />
            <span className="unlock-copy">
              <span className="unlock-kicker">Achievement unlocked</span>
              <strong>{t.achievement.name}</strong>
            </span>
          </Link>
        ))}
      </div>
    </SocialContext.Provider>
  );
}
