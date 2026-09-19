"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, SendHorizontal } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Avatar } from "@/components/Avatar";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useSocial } from "@/components/Social";
import { ApiError, callCasino, describePresence, type FriendsData, type PlayerBadge, type Presence, tableUrl, useCasino } from "@/lib/api";

interface Conversation {
  with: PlayerBadge;
  presence: Presence;
  last: { body: string; mine: boolean; at: number };
  unread: number;
}
interface Message {
  id: number;
  mine: boolean;
  body: string;
  at: number;
  read: boolean;
  pending?: boolean;
}
interface Thread {
  with: PlayerBadge;
  presence: Presence;
  relation: string;
  messages: Message[];
  more: boolean;
}

function clock(ms: number) {
  return new Date(ms).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(ms: number) {
  const d = new Date(ms);
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function ConversationList({ active, onPick }: { active: string | null; onPick: (id: string) => void }) {
  const { data } = useCasino<{ conversations: Conversation[] }>("/v1/messages", 12_000);
  const { data: friends } = useCasino<FriendsData>("/v1/friends");
  const talking = new Set(data?.conversations.map((c) => c.with.id));
  const others = friends?.friends.filter((f) => !talking.has(f.id)) ?? [];

  return (
    <aside className="convos" aria-label="Conversations">
      {!data ? (
        <div className="panel-skeleton" aria-hidden="true" />
      ) : (
        <ul>
          {data.conversations.map((c) => (
            <li key={c.with.id}>
              <button className={`convo${active === c.with.id ? " is-active" : ""}${c.unread ? " is-unread" : ""}`} onClick={() => onPick(c.with.id)}>
                <Avatar player={c.with} size={42} status={c.presence.online ? "online" : null} />
                <span className="convo-copy">
                  <span className="convo-name">{c.with.name}</span>
                  <span className="convo-last">
                    {c.last.mine ? "You: " : ""}
                    {c.last.body}
                  </span>
                </span>
                {c.unread ? <span className="count-tag">{c.unread}</span> : <time>{clock(c.last.at)}</time>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {others.length ? (
        <>
          <h2 className="convos-label">Start a conversation</h2>
          <ul>
            {others.map((f) => (
              <li key={f.id}>
                <button className={`convo${active === f.id ? " is-active" : ""}`} onClick={() => onPick(f.id)}>
                  <Avatar player={f} size={42} status={f.presence.online ? "online" : null} />
                  <span className="convo-copy">
                    <span className="convo-name">{f.name}</span>
                    <span className="convo-last">{describePresence(f.presence)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {data && data.conversations.length === 0 && others.length === 0 ? (
        <p className="card-text convos-empty">
          Messages are between friends. <Link href="/friends">Add a friend</Link> to start one.
        </p>
      ) : null}
    </aside>
  );
}

function ThreadView({ partnerId, onBack }: { partnerId: string; onBack: () => void }) {
  const { accessToken } = useAuth();
  const { refresh } = useSocial();
  const [thread, setThread] = useState<Thread | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const lastId = useRef(0);

  const load = useCallback(
    async (initial: boolean) => {
      if (!accessToken) return;
      const after = initial ? 0 : lastId.current;
      const next = await callCasino<Thread>(accessToken, `/v1/messages/${partnerId}${after ? `?after=${after}` : ""}`);
      if (next.messages.length) lastId.current = next.messages[next.messages.length - 1].id;
      setThread((prev) =>
        initial || !prev
          ? next
          : { ...next, more: prev.more, messages: [...prev.messages.filter((m) => !m.pending && !next.messages.some((n) => n.id === m.id)), ...next.messages] },
      );
      if (next.messages.some((m) => !m.mine)) refresh();
    },
    [accessToken, partnerId, refresh],
  );

  useEffect(() => {
    lastId.current = 0;
    pinned.current = true;
    setThread(null);
    void load(true).catch(() => setError("Couldn't open this conversation."));
    const timer = window.setInterval(() => void load(false).catch(() => {}), 3500);
    return () => window.clearInterval(timer);
  }, [load]);

  // Stay at the bottom as messages arrive, unless the reader scrolled up.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [thread?.messages.length]);

  async function older() {
    if (!accessToken || !thread?.messages.length) return;
    const el = scroller.current;
    const before = el ? el.scrollHeight - el.scrollTop : 0;
    const page = await callCasino<Thread>(accessToken, `/v1/messages/${partnerId}?before=${thread.messages[0].id}`);
    setThread((prev) => (prev ? { ...prev, more: page.more, messages: [...page.messages, ...prev.messages] } : prev));
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - before;
    });
  }

  async function send(event?: React.FormEvent) {
    event?.preventDefault();
    const body = text.trim();
    if (!body || !accessToken) return;
    setText("");
    setError(null);
    pinned.current = true;
    const temp: Message = { id: -Date.now(), mine: true, body, at: Date.now(), read: false, pending: true };
    setThread((prev) => (prev ? { ...prev, messages: [...prev.messages, temp] } : prev));
    try {
      await callCasino(accessToken, `/v1/messages/${partnerId}`, { body });
      await load(false);
    } catch (e) {
      setThread((prev) => (prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== temp.id) } : prev));
      setText(body);
      setError(e instanceof ApiError ? e.message : "Couldn't send. Try again.");
    }
  }

  if (!thread) return <div className="thread">{error ? <p className="form-error">{error}</p> : <div className="panel-skeleton tall" aria-hidden="true" />}</div>;

  const canWrite = thread.relation === "friend";
  const join = tableUrl(thread.presence);
  let lastDay = "";

  return (
    <section className="thread" aria-label={`Conversation with ${thread.with.name}`}>
      <header className="thread-head">
        <button className="icon-btn thread-back" onClick={onBack} aria-label="Back to conversations">
          <ArrowLeft size={17} strokeWidth={2} aria-hidden="true" />
        </button>
        <Link href={`/u/${thread.with.id}`} className="thread-who">
          <Avatar player={thread.with} size={40} status={thread.presence.online ? "online" : null} />
          <span className="friend-copy">
            <strong>{thread.with.name}</strong>
            <span className="friend-status">{describePresence(thread.presence)}</span>
          </span>
        </Link>
        {join ? (
          <a className="btn btn-sm btn-cherry" href={join}>
            Join table
          </a>
        ) : null}
      </header>

      <div
        className="thread-scroll"
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
        }}
      >
        {thread.more ? (
          <button className="btn btn-sm btn-quiet thread-older" onClick={() => void older()}>
            Load earlier messages
          </button>
        ) : null}
        {thread.messages.length === 0 ? <p className="thread-empty">Say hi to {thread.with.name}.</p> : null}
        <ol className="bubbles">
          {thread.messages.map((m, i) => {
            const day = dayLabel(m.at);
            const showDay = day !== lastDay;
            lastDay = day;
            const next = thread.messages[i + 1];
            const tail = !next || next.mine !== m.mine || next.at - m.at > 5 * 60_000;
            return (
              <li key={m.id} className="bubble-row">
                {showDay ? <span className="day-mark">{day}</span> : null}
                <div className={`bubble${m.mine ? " is-mine" : ""}${tail ? " has-tail" : ""}${m.pending ? " is-pending" : ""}`}>
                  <p>{m.body}</p>
                  {tail ? <time>{clock(m.at)}</time> : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {canWrite ? (
        <form className="composer" onSubmit={(e) => void send(e)}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 1000))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder={`Message ${thread.with.name}`}
            aria-label={`Message ${thread.with.name}`}
          />
          <button className="btn btn-cherry composer-send" type="submit" disabled={!text.trim()} aria-label="Send">
            <SendHorizontal size={18} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </form>
      ) : (
        <p className="thread-note">You can read this conversation, but only friends can message each other.</p>
      )}
      {error ? <p className="form-error thread-error">{error}</p> : null}
    </section>
  );
}

export function MessagesView() {
  const { user, loading } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const active = params.get("with");
  const pick = (id: string | null) => router.replace(id ? `/messages?with=${id}` : "/messages", { scroll: false });

  return (
    <section className="page" aria-labelledby="page-title">
      <div className="page-head">
        <h1 id="page-title">Messages</h1>
      </div>
      {loading ? null : !user ? (
        <SignInPrompt what="Sign in to message your friends." />
      ) : (
        <div className={`inbox${active ? " has-thread" : ""}`}>
          <ConversationList active={active} onPick={pick} />
          {active ? (
            <ThreadView key={active} partnerId={active} onBack={() => pick(null)} />
          ) : (
            <div className="thread thread-idle">
              <p>Pick a conversation, or start one with a friend.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
