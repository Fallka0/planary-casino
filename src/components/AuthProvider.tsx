"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { buildAuthUrl, signOutUrl } from "@/lib/auth";
import { absorbSessionFromHash, clearSession, loadSession, verifySession } from "@/lib/session";

export interface CasinoUser {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  user: CasinoUser | null;
  accessToken: string | null;
  loading: boolean;
  /** Set when a redirect back from planary-auth carried a session we could not use. */
  authError: string | null;
  dismissAuthError: () => void;
  signIn: (mode?: "login" | "signup") => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const here = () => `${window.location.origin}${window.location.pathname}`;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CasinoUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const hadToken = window.location.hash.includes("access_token=");
    const session = absorbSessionFromHash() ?? loadSession();
    if (!session) {
      if (hadToken) setAuthError("Sign-in didn't complete. The link may have expired, so please sign in again.");
      setLoading(false);
      return;
    }
    setUser({ id: session.userId, email: session.email, name: session.name });
    setAccessToken(session.accessToken);
    setLoading(false);
    void verifySession(session).then((ok) => {
      if (!active || ok) return;
      clearSession();
      setUser(null);
      setAccessToken(null);
      if (hadToken) setAuthError("Sign-in didn't complete. The link may have expired, so please sign in again.");
    });
    // Tokens last an hour: renew them through planary-auth (single sign-on, no click) just before.
    const timer = window.setTimeout(() => {
      clearSession();
      window.location.replace(buildAuthUrl("login", here()));
    }, Math.max(0, session.expiresAt * 1000 - Date.now() - 60_000));
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  const signIn = useCallback((mode: "login" | "signup" = "login") => {
    window.location.assign(buildAuthUrl(mode, here()));
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    window.location.assign(signOutUrl(here()));
  }, []);

  const dismissAuthError = useCallback(() => setAuthError(null), []);

  return (
    <AuthContext.Provider value={{ user, accessToken, loading, authError, dismissAuthError, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
