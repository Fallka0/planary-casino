"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { type ItemInfo, ItemArt, TIER_LABEL } from "@/app/market/cosmetics";
import { useMarketSound } from "@/app/market/sound";
import { callCasino, type Me, type PlayerBadge } from "@/lib/api";
import { useAuth } from "./AuthProvider";
import { Avatar } from "./Avatar";

interface Drop {
  id: string;
  at: number;
  caseId: string;
  item: ItemInfo;
  player: PlayerBadge;
  mine: boolean;
}

/** Only the big ones are worth interrupting anyone for. */
const LOUD = new Set(["epic", "legendary"]);
const EVERY = 15_000;

/**
 * When someone else pulls an epic or a legendary out of a case, everyone signed in hears about
 * it: a card drops in at the top with what they got, legendary in holo. Drops from before the
 * page opened aren't news, and your own you've just watched.
 */
export function DropToasts() {
  const { accessToken } = useAuth();
  const sound = useMarketSound();
  const [queue, setQueue] = useState<Drop[]>([]);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let live = true;
    const look = () =>
      callCasino<{ drops: Drop[] }>(accessToken, "/v1/cases/recent").then(
        ({ drops }) => {
          if (!live) return;
          if (!seen.current) {
            seen.current = new Set(drops.map((d) => d.id));
            return;
          }
          const fresh = drops.filter((d) => !seen.current!.has(d.id));
          fresh.forEach((d) => seen.current!.add(d.id));
          const loud = fresh.filter((d) => !d.mine && LOUD.has(d.item.tier)).reverse();
          if (loud.length) setQueue((q) => [...q, ...loud]);
        },
        () => {},
      );
    void look();
    const timer = window.setInterval(look, EVERY);
    // An opening on this page may be news to the feed sooner than the next look.
    window.addEventListener("casino:changed", look);
    return () => {
      live = false;
      window.clearInterval(timer);
      window.removeEventListener("casino:changed", look);
    };
  }, [accessToken]);

  const current = queue[0];
  useEffect(() => {
    if (!current) return;
    sound.play("drop", current.item.tier);
    const timer = window.setTimeout(() => setQueue((q) => q.slice(1)), current.item.tier === "legendary" ? 6500 : 4800);
    return () => window.clearTimeout(timer);
    // Once per toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!current) return null;
  // ItemArt draws a ring around a player: the one who pulled it.
  const who = { ...current.player, balance: 0, banner: null, cardback: null, chipset: null, bonusStreak: 0, bonus: { amount: 0, available: false, nextAt: null } } as Me;
  return (
    <div className="drop-toasts" aria-live="polite">
      <Link key={current.id} href="/market" className={`drop-toast is-${current.item.tier}`} onClick={() => setQueue((q) => q.slice(1))}>
        <span className="drop-toast-art">
          <ItemArt item={current.item} me={who} size={52} />
        </span>
        <span className="drop-toast-copy">
          <span className="drop-toast-kicker">
            <Avatar player={current.player} size={18} />
            {current.player.name} pulled
          </span>
          <strong>{current.item.name}</strong>
          <span className={`mk-tier tier-${current.item.tier}`}>{TIER_LABEL[current.item.tier]}</span>
        </span>
      </Link>
    </div>
  );
}
