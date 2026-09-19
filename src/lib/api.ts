"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export const CASINO_API = process.env.NEXT_PUBLIC_CASINO_API || "https://planary-casino-api.planary.workers.dev";

export interface Presence {
  online: boolean;
  where: "lobby" | "blackjack" | "roulette" | null;
  table: string | null;
}
export interface Me {
  id: string;
  name: string;
  balance: number;
  bonus: { amount: number; available: boolean; nextAt: number | null };
}
export interface Friend {
  id: string;
  name: string;
  presence: Presence;
}
export interface FriendsData {
  friends: Friend[];
  incoming: { id: string; name: string }[];
  outgoing: { id: string; name: string }[];
}
export interface BoardRow {
  rank: number;
  id: string;
  name: string;
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
  kind: "starter" | "bonus" | "game" | "transfer_in" | "transfer_out";
  game: string | null;
  created_at: number;
  counterparty_name: string | null;
}

export class ApiError extends Error {}

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

/** Tells friends we're in the casino lobby. */
export function usePresence() {
  const { accessToken } = useAuth();
  useEffect(() => {
    if (!accessToken) return;
    const ping = () => call(accessToken, "/v1/presence", { where: "lobby" }).catch(() => {});
    void ping();
    const timer = window.setInterval(ping, 30_000);
    return () => window.clearInterval(timer);
  }, [accessToken]);
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
