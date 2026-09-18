"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useRef, useState } from "react";
import { Coins, LayoutGrid, LogIn, LogOut, Search, Spade, Trophy, Users } from "lucide-react";
import { formatChips, GAMES, STARTER_CHIPS } from "@/lib/games";
import { initials, SAMPLE_FRIENDS } from "@/lib/sample";
import { useAuth } from "./AuthProvider";
import { ChipIcon } from "./ChipIcon";

const NAV = [
  { href: "/", label: "Lobby", icon: LayoutGrid },
  { href: "/games", label: "Games", icon: Spade },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/chips", label: "Chips", icon: Coins },
];

export function BrandMark({ size = 38 }: { size?: number }) {
  return <ChipIcon size={size} letter="P" />;
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Sidebar() {
  const pathname = usePathname();
  const { user, loading, signIn, signOut } = useAuth();
  const gameName = (id?: string) => GAMES.find((g) => g.id === id)?.name;

  return (
    <aside className="sidebar">
      <Link href="/" className="brand" aria-label="Planary Casino lobby">
        <BrandMark />
        <span className="brand-copy">
          <span className="brand-name">Planary</span>
          <span className="brand-sub">Casino</span>
        </span>
      </Link>

      <nav className="side-nav" aria-label="Main">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="side-link" aria-current={isActive(pathname, href) ? "page" : undefined}>
            <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>

      <section className="side-friends" aria-labelledby="online-title">
        <div className="side-heading">
          <h2 id="online-title">Online now</h2>
          <span className="sample-tag">Sample</span>
        </div>
        <ul>
          {SAMPLE_FRIENDS.map((friend) => (
            <li key={friend.name} className="friend">
              <span className={`avatar avatar-sm is-${friend.status}`} aria-hidden="true">
                {initials(friend.name)}
              </span>
              <span className="friend-copy">
                <span className="friend-name">{friend.name}</span>
                <span className="friend-status">
                  {friend.status === "away" ? "Away" : friend.game ? `Waiting for ${gameName(friend.game)}` : "In the lobby"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="side-foot">
        {loading ? null : user ? (
          <button className="side-action" onClick={() => void signOut()}>
            <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
            Sign out
          </button>
        ) : (
          <button className="side-action" onClick={() => signIn("login")}>
            <LogIn size={18} strokeWidth={1.8} aria-hidden="true" />
            Sign in
          </button>
        )}
      </div>
    </aside>
  );
}

function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  useEffect(() => {
    setValue(params.get("q") ?? "");
  }, [params]);

  function update(next: string) {
    setValue(next);
    // On the games page the list filters as you type; elsewhere Enter takes you there.
    if (pathname === "/games") {
      router.replace(next ? `/games?q=${encodeURIComponent(next)}` : "/games", { scroll: false });
    }
  }

  return (
    <form
      role="search"
      className="search"
      onSubmit={(event) => {
        event.preventDefault();
        router.push(value ? `/games?q=${encodeURIComponent(value)}` : "/games");
      }}
    >
      <Search size={18} strokeWidth={1.8} aria-hidden="true" />
      <input
        type="search"
        placeholder="Search games"
        aria-label="Search games"
        value={value}
        onChange={(event) => update(event.target.value)}
      />
    </form>
  );
}

function AccountButton({ email }: { email: string }) {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const handle = email.split("@")[0];

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const esc = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div className="account" ref={ref}>
      <button className="account-btn" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((v) => !v)}>
        <span className="avatar" aria-hidden="true">
          {handle.slice(0, 2).toUpperCase()}
        </span>
        <span className="account-copy">
          <span className="account-name">{handle}</span>
          <span className="account-mail">{email}</span>
        </span>
      </button>
      {open ? (
        <div className="account-menu" id={panelId}>
          <a href="https://wishlist.planary.ch">Planary Wishlist</a>
          <button onClick={() => void signOut()}>Sign out</button>
        </div>
      ) : null}
    </div>
  );
}

function Topbar() {
  const { user, loading, signIn } = useAuth();

  return (
    <header className="topbar">
      <Link href="/" className="topbar-brand" aria-label="Planary Casino lobby">
        <BrandMark size={32} />
      </Link>
      <Suspense fallback={<div className="search" />}>
        <SearchBox />
      </Suspense>
      <div className="topbar-actions">
        {loading ? (
          <span className="skeleton" aria-hidden="true" />
        ) : user ? (
          <>
            <Link href="/chips" className="balance">
              <ChipIcon size={20} />
              <strong>{formatChips(STARTER_CHIPS)}</strong>
              <span className="balance-label">starter chips</span>
            </Link>
            <AccountButton email={user.email} />
          </>
        ) : (
          <>
            <button className="btn btn-quiet" onClick={() => signIn("login")}>
              Sign in
            </button>
            <button className="btn btn-cherry" onClick={() => signIn("signup")}>
              Join
            </button>
          </>
        )}
      </div>
    </header>
  );
}

function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="tabbar" aria-label="Main">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} className="tab" aria-current={isActive(pathname, href) ? "page" : undefined}>
          <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

function AuthNotice() {
  const { authError, dismissAuthError, signIn } = useAuth();
  if (!authError) return null;
  return (
    <div className="notice" role="alert">
      <p>{authError}</p>
      <div className="notice-actions">
        <button className="btn btn-cherry btn-sm" onClick={() => signIn("login")}>
          Sign in again
        </button>
        <button className="btn btn-quiet btn-sm" onClick={dismissAuthError}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <Sidebar />
      <div className="stage">
        <Topbar />
        <AuthNotice />
        <main className="content">{children}</main>
        <footer className="legal">
          Play money only. Planary Chips have no cash value and cannot be bought, sold or exchanged.{" "}
          <a href="https://planary.ch">planary.ch</a>
        </footer>
      </div>
      <TabBar />
    </div>
  );
}
