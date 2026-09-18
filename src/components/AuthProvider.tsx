"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { buildAuthUrl } from "@/lib/auth";
import { absorbSessionFromHash, clearSession, loadSession, verifySession } from "@/lib/session";

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CasinoUser | null>(null);
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
    setUser({ id: session.userId, email: session.email });
    setLoading(false);
    void verifySession(session).then((ok) => {
      if (!active || ok) return;
      clearSession();
      setUser(null);
      if (hadToken) setAuthError("Sign-in didn't complete. The link may have expired, so please sign in again.");
    });
    const timer = window.setTimeout(() => {
      clearSession();
      setUser(null);
    }, Math.max(0, session.expiresAt * 1000 - Date.now() - 60_000));
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);

  const signIn = useCallback((mode: "login" | "signup" = "login") => {
    window.location.assign(buildAuthUrl(mode, `${window.location.origin}${window.location.pathname}`));
  }, []);

  const signOut = useCallback(async () => {
    clearSession();
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
