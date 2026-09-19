"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Search, UserPlus, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { SignInPrompt } from "@/components/SignInPrompt";
import { ApiError, describePresence, type FriendsData, tableUrl, useCasino, useCasinoAction } from "@/lib/api";
import { initials } from "@/lib/games";

type Relation = "none" | "requested" | "incoming" | "friend";
interface Found {
  id: string;
  name: string;
  relation: Relation;
}

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function PlayerSearch() {
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim(), 250);
  const { data } = useCasino<{ players: Found[] }>(q.length >= 2 ? `/v1/players/search?q=${encodeURIComponent(q)}` : null);
  const act = useCasinoAction();
  const [error, setError] = useState<string | null>(null);
  const results = q.length >= 2 ? (data?.players ?? null) : null;

  async function run(path: string, userId: string) {
    setError(null);
    try {
      await act(path, { userId });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work. Try again.");
    }
  }

  return (
    <section className="card" aria-labelledby="find-title">
      <h2 id="find-title">Find players</h2>
      <label className="search-field">
        <Search size={18} strokeWidth={1.9} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by display name"
          aria-label="Search players by display name"
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      {results === null ? (
        <p className="card-text">Type at least two letters of a name.</p>
      ) : results.length === 0 ? (
        <p className="card-text">Nobody by that name yet. Names are the display names people chose when they signed up.</p>
      ) : (
        <ul className="people">
          {results.map((p) => (
            <li key={p.id} className="person">
              <span className="avatar" aria-hidden="true">
                {initials(p.name)}
              </span>
              <span className="person-name">{p.name}</span>
              {p.relation === "none" ? (
                <button className="btn btn-sm btn-cherry" onClick={() => void run("/v1/friends/request", p.id)}>
                  <UserPlus size={15} strokeWidth={2.2} aria-hidden="true" /> Add
                </button>
              ) : p.relation === "incoming" ? (
                <button className="btn btn-sm btn-cherry" onClick={() => void run("/v1/friends/accept", p.id)}>
                  <Check size={15} strokeWidth={2.4} aria-hidden="true" /> Accept
                </button>
              ) : p.relation === "requested" ? (
                <span className="person-note">Request sent</span>
              ) : (
                <span className="person-note">Friends</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function FriendsView() {
  const { user, loading } = useAuth();
  const { data } = useCasino<FriendsData>(user ? "/v1/friends" : null, 20_000);
  const act = useCasinoAction();
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const run = (path: string, userId: string) => act(path, { userId }).catch(() => {});

  return (
    <section className="page" aria-labelledby="page-title">
      <div className="page-head">
        <h1 id="page-title">Friends</h1>
        <p className="page-sub">See who&apos;s online, join their table, send them chips.</p>
      </div>

      {loading ? null : !user ? (
        <SignInPrompt what="Sign in to add friends and see who is at a table." />
      ) : (
        <div className="friends-layout">
          <div className="friends-main">
            {data && data.incoming.length > 0 ? (
              <section className="card card-attention" aria-labelledby="incoming-title">
                <h2 id="incoming-title">Friend requests</h2>
                <ul className="people">
                  {data.incoming.map((p) => (
                    <li key={p.id} className="person">
                      <span className="avatar" aria-hidden="true">
                        {initials(p.name)}
                      </span>
                      <span className="person-name">{p.name}</span>
                      <button className="btn btn-sm btn-cherry" onClick={() => void run("/v1/friends/accept", p.id)}>
                        <Check size={15} strokeWidth={2.4} aria-hidden="true" /> Accept
                      </button>
                      <button className="icon-btn" onClick={() => void run("/v1/friends/remove", p.id)} aria-label={`Decline ${p.name}`}>
                        <X size={16} strokeWidth={2.2} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="card" aria-labelledby="list-title">
              <h2 id="list-title">Your friends</h2>
              {!data ? (
                <div className="panel-skeleton" aria-hidden="true" />
              ) : data.friends.length === 0 ? (
                <p className="card-text">No friends yet. Search for someone&apos;s display name to send a request.</p>
              ) : (
                <ul className="people">
                  {data.friends.map((f) => (
                    <li key={f.id} className="person">
                      <span className={`avatar${f.presence.online ? " is-online" : ""}`} aria-hidden="true">
                        {initials(f.name)}
                      </span>
                      <span className="person-copy">
                        <span className="person-name">{f.name}</span>
                        <span className="person-status">{describePresence(f.presence)}</span>
                      </span>
                      {tableUrl(f.presence) ? (
                        <a className="btn btn-sm btn-cherry" href={tableUrl(f.presence)!}>
                          Join table
                        </a>
                      ) : null}
                      <Link className="btn btn-sm btn-quiet" href={`/chips?to=${f.id}`}>
                        Send chips
                      </Link>
                      {confirmRemove === f.id ? (
                        <button
                          className="btn btn-sm btn-quiet danger"
                          onClick={() => {
                            setConfirmRemove(null);
                            void run("/v1/friends/remove", f.id);
                          }}
                        >
                          Remove?
                        </button>
                      ) : (
                        <button className="icon-btn" onClick={() => setConfirmRemove(f.id)} aria-label={`Remove ${f.name}`}>
                          <X size={16} strokeWidth={2.2} aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {data && data.outgoing.length > 0 ? (
              <section className="card" aria-labelledby="outgoing-title">
                <h2 id="outgoing-title">Waiting for an answer</h2>
                <ul className="people">
                  {data.outgoing.map((p) => (
                    <li key={p.id} className="person">
                      <span className="avatar" aria-hidden="true">
                        {initials(p.name)}
                      </span>
                      <span className="person-name">{p.name}</span>
                      <button className="btn btn-sm btn-quiet" onClick={() => void run("/v1/friends/remove", p.id)}>
                        Cancel
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
          <PlayerSearch />
        </div>
      )}
    </section>
  );
}
