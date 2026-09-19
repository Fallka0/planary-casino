export interface Env {
  DB: D1Database;
  /** Service binding to the planary-auth worker (token verification). */
  AUTH: Fetcher;
  /** Comma-separated browser origins allowed to call the API. */
  ALLOWED_ORIGINS: string;
  /** Shared with game servers (secret). Guards /internal/*. */
  INTERNAL_KEY: string;
}

export interface Player {
  user_id: string;
  name: string;
  balance: number;
  bonus_day: string | null;
  presence_where: string | null;
  presence_table: string | null;
  last_seen: number;
  created_at: number;
  bio: string | null;
  avatar_version: number;
  border: string | null;
  banner: string | null;
  title: string | null;
  cardback: string | null;
  chipset: string | null;
  showcase: string | null;
  bonus_streak: number;
}
