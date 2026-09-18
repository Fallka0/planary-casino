import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const AUTH_BASE_URL = process.env.NEXT_PUBLIC_AUTH_BASE_URL ?? "https://auth.planary.ch";

// Null when env vars are missing, so the lobby still renders (signed out) in local dev.
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export function buildAuthUrl(mode: "login" | "signup", returnTo: string) {
  const target = new URL(mode === "signup" ? "/signup" : "/", AUTH_BASE_URL);
  target.searchParams.set("returnTo", returnTo);
  return target.toString();
}
