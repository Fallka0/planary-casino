"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { buildAuthUrl, supabase } from "@/lib/supabase";

export interface CasinoUser {
  id: string;
  email: string;
}

interface AuthState {
  user: CasinoUser | null;
  loading: boolean;
  /** Set when a redirect back from planary-auth carried a session we could not use. */
  authError: string | null;
  dismissAuthError: () => void;
  signIn: (mode?: "login" | "signup") => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// planary-auth redirects back with the session in the URL hash (#access_token=…&refresh_token=…).
async function absorbSessionFromHash() {
  if (!supabase) return;
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return;

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);
  if (error) throw error;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CasinoUser | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let active = true;

    void (async () => {
      try {
        await absorbSessionFromHash();
      } catch {
        // Invalid or expired tokens in the hash: tell the player, then fall back to any stored session.
        if (active) setAuthError("Sign-in didn't complete. The link may have expired, so please sign in again.");
      }
      const { data } = await client.auth.getSession();
      if (!active) return;
      const sessionUser = data.session?.user;
      setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email ?? "" } : null);
      setLoading(false);
    })();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user;
      setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email ?? "" } : null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback((mode: "login" | "signup" = "login") => {
    window.location.assign(buildAuthUrl(mode, `${window.location.origin}${window.location.pathname}`));
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
    setUser(null);
  }, []);

  const dismissAuthError = useCallback(() => setAuthError(null), []);

  return (
    <AuthContext.Provider value={{ user, loading, authError, dismissAuthError, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
