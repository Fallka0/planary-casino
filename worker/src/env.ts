export interface Env {
  DB: D1Database;
  /** Service binding to the planary-auth worker (token verification). */
  AUTH: Fetcher;
  /** Comma-separated browser origins allowed to call the API. */
  ALLOWED_ORIGINS: string;
  /** Shared with game servers (secret). Guards /internal/*. */
  INTERNAL_KEY: string;
  /** Planary account email that becomes Owner of the admin panel when there's no staff yet. */
  OWNER_EMAIL: string;
  /** Browser origins allowed to call /admin (the admin app). */
  ADMIN_ORIGINS: string;
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
  status: "active" | "suspended" | "banned";
  status_until: number | null;
  status_reason: string | null;
  muted_until: number | null;
  loss_limit: number | null;
  excluded_until: number | null;
}
