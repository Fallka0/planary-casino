"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export const CASINO_API = process.env.NEXT_PUBLIC_CASINO_API || "https://planary-casino-api.planary.workers.dev";

export interface Presence {
  online: boolean;
  where: "lobby" | "blackjack" | "roulette" | null;
  table: string | null;
}
/** How a player shows up anywhere: name, picture, border and title. */
export interface PlayerBadge {
  id: string;
  name: string;
  /** Path on the casino API, or null for initials. */
  avatar: string | null;
  border: string | null;
  title: string | null;
}
export interface Me extends PlayerBadge {
  balance: number;
  banner: string | null;
  cardback: string | null;
  chipset: string | null;
  bonusStreak: number;
  bonus: { amount: number; available: boolean; nextAt: number | null };
}
export interface Friend extends PlayerBadge {
  presence: Presence;
}
export interface FriendsData {
  friends: Friend[];
  incoming: PlayerBadge[];
  outgoing: PlayerBadge[];
}
export interface BoardRow extends PlayerBadge {
  rank: number;
  net: number;
  isMe: boolean;
}
export interface Board {
  scope: "friends" | "all";
  weekStart: number;
  rows: BoardRow[];
  me: BoardRow | null;
}
export interface LedgerEntry {
  id: number;
  amount: number;
  kind: "starter" | "bonus" | "game" | "transfer_in" | "transfer_out" | "shop";
  ref: string | null;
  game: string | null;
  created_at: number;
  counterparty_name: string | null;
}

export class ApiError extends Error {}

export function avatarSrc(path: string | null) {
  return path ? CASINO_API + path : null;
}

async function call<T>(token: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(CASINO_API + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? "Something went wrong. Try again.");
  return data as T;
}

/** Reads from the casino API while signed in; re-polls every `every` ms and whenever `casino:changed` fires. */
export function useCasino<T>(path: string | null, every = 0) {
  const { accessToken } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!accessToken || !path) return;
    call<T>(accessToken, path)
      .then((value) => {
        setData(value);
        setError(null);
      })
      .catch((e: Error) => setError(e.message));
  }, [accessToken, path]);

  useEffect(() => {
    load();
    window.addEventListener("casino:changed", load);
    const timer = every ? window.setInterval(load, every) : 0;
    return () => {
      window.removeEventListener("casino:changed", load);
      if (timer) window.clearInterval(timer);
    };
  }, [load, every]);

  return { data, error, reload: load };
}

/** Writes to the casino API, then tells every reader on the page to refresh. */
export function useCasinoAction() {
  const { accessToken } = useAuth();
  return useCallback(
    async <T,>(path: string, body: unknown = {}): Promise<T> => {
      if (!accessToken) throw new ApiError("Sign in first.");
      const result = await call<T>(accessToken, path, body);
      window.dispatchEvent(new Event("casino:changed"));
      return result;
    },
    [accessToken],
  );
}

export async function callCasino<T>(token: string, path: string, body?: unknown) {
  return call<T>(token, path, body);
}

/** Sends raw image bytes (already resized) as the profile picture. */
export async function uploadAvatar(token: string, image: Blob) {
  const res = await fetch(CASINO_API + "/v1/profile/avatar", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": image.type },
    body: image,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? "Upload failed. Try again.");
  window.dispatchEvent(new Event("casino:changed"));
  return data as { avatar: string };
}

const GAME_HOSTS = { blackjack: "https://21.planary.ch", roulette: "https://roulette.planary.ch" } as const;

/** Link to the table a friend is at, in whichever game they're playing. */
export function tableUrl(presence: Presence) {
  const host = presence.where === "roulette" || presence.where === "blackjack" ? GAME_HOSTS[presence.where] : null;
  return host && presence.table ? `${host}/t/${presence.table}` : null;
}

export function describePresence(p: Presence) {
  if (!p.online) return "Offline";
  if (p.where === "blackjack") return p.table ? "At a Blackjack table" : "In Blackjack";
  if (p.where === "roulette") return p.table ? "At a Roulette table" : "In Roulette";
  return "In the lobby";
}

export interface AchievementEntry {
  id: string;
  name: string;
  description: string;
  category: "blackjack" | "roulette" | "chips" | "social" | "collector";
  grade: 1 | 2 | 3 | 4;
  glyph: string;
  secret: boolean;
  /** Share of all players who own it, 0–1. */
  rarity: number;
  unlockedAt: number | null;
  progress: { value: number; target: number } | null;
}

export interface Profile extends PlayerBadge {
  bio: string | null;
  banner: string | null;
  joinedAt: number;
  presence: Presence;
  relation: "self" | "friend" | "requested" | "incoming" | "none";
  pinned: string[];
  stats: { blackjackRounds: number; naturals: number; bestStreak: number; rouletteSpins: number; bestRound: number; weekNet: number };
  achievements: { unlocked: number; total: number };
  showcase: AchievementEntry[];
  recent: AchievementEntry[];
}
