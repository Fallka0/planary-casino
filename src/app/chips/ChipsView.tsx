"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Gift, Send } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { ChipIcon } from "@/components/ChipIcon";
import { SignInPrompt } from "@/components/SignInPrompt";
import { ApiError, type FriendsData, type LedgerEntry, type Me, useCasino, useCasinoAction } from "@/lib/api";
import { formatChips } from "@/lib/games";

function until(ms: number) {
  const left = Math.max(0, ms - Date.now());
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

function when(ms: number) {
  const d = new Date(ms);
  const today = new Date();
  const time = d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
  return `${d.toLocaleDateString("de-CH", { day: "numeric", month: "short" })}, ${time}`;
}

function describe(entry: LedgerEntry) {
  switch (entry.kind) {
    case "starter":
      return "Welcome chips";
    case "bonus":
      return "Daily bonus";
    case "transfer_in":
      return `From ${entry.counterparty_name ?? "a friend"}`;
    case "transfer_out":
      return `To ${entry.counterparty_name ?? "a friend"}`;
    case "game":
      return entry.amount < 0 ? "Blackjack · bet" : "Blackjack · payout";
  }
}

function BonusCard({ me }: { me: Me }) {
  const act = useCasinoAction();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    if (me.bonus.available) return;
    const timer = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(timer);
  }, [me.bonus.available]);

  async function claim() {
    setBusy(true);
    setError(null);
    try {
      await act("/v1/chips/bonus");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't claim the bonus. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="bonus-title">
      <h2 id="bonus-title">Daily bonus</h2>
      {me.bonus.available ? (
        <>
          <p className="card-text">{formatChips(me.bonus.amount)} free chips, once a day. Resets at midnight.</p>
          <button className="btn btn-cherry btn-lg" onClick={() => void claim()} disabled={busy}>
            <Gift size={18} strokeWidth={2.2} aria-hidden="true" />
            {busy ? "Claiming…" : `Claim ${formatChips(me.bonus.amount)} chips`}
          </button>
        </>
      ) : (
        <p className="card-text">
          Claimed for today. The next {formatChips(me.bonus.amount)} chips are ready in{" "}
          <strong>{me.bonus.nextAt ? until(me.bonus.nextAt) : "a few hours"}</strong>.
        </p>
      )}
      {error ? <p className="form-error">{error}</p> : null}
    </section>
  );
}

function SendCard({ me }: { me: Me }) {
  const params = useSearchParams();
  const { data } = useCasino<FriendsData>("/v1/friends");
  const act = useCasinoAction();
  const [to, setTo] = useState(params.get("to") ?? "");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const friends = data?.friends ?? [];

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const value = Number(amount);
    const friend = friends.find((f) => f.id === to);
    if (!friend) return setStatus({ kind: "error", text: "Pick a friend first." });
    if (!Number.isInteger(value) || value < 10) return setStatus({ kind: "error", text: "Send at least 10 chips." });
    if (value > me.balance) return setStatus({ kind: "error", text: "That's more than you have." });
    setBusy(true);
    setStatus(null);
    try {
      await act("/v1/chips/send", { userId: to, amount: value });
      setStatus({ kind: "ok", text: `Sent ${formatChips(value)} chips to ${friend.name}.` });
      setAmount("");
    } catch (e) {
      setStatus({ kind: "error", text: e instanceof ApiError ? e.message : "Couldn't send. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="send-title">
      <h2 id="send-title">Send chips</h2>
      {data && friends.length === 0 ? (
        <p className="card-text">
          You can send chips to friends. <Link href="/friends">Add a friend</Link> first.
        </p>
      ) : (
        <form className="send-form" onSubmit={send}>
          <label className="field">
            <span>Friend</span>
            <select value={to} onChange={(e) => setTo(e.target.value)} required>
              <option value="">Choose a friend</option>
              {friends.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Amount</span>
            <input
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="e.g. 250"
              required
            />
          </label>
          <button className="btn btn-quiet" type="submit" disabled={busy}>
            <Send size={16} strokeWidth={2.2} aria-hidden="true" />
            {busy ? "Sending…" : "Send"}
          </button>
        </form>
      )}
      {status ? <p className={status.kind === "ok" ? "form-ok" : "form-error"}>{status.text}</p> : null}
    </section>
  );
}

export function ChipsView() {
  const { user, loading } = useAuth();
  const { data: me } = useCasino<Me>(user ? "/v1/me" : null);
  const { data: history } = useCasino<{ entries: LedgerEntry[] }>(user ? "/v1/chips/history" : null);

  return (
    <section className="page" aria-labelledby="page-title">
      <div className="page-head">
        <h1 id="page-title">Chips</h1>
        <p className="page-sub">One balance for every Planary table. Play money only, with no cash value.</p>
      </div>

      {loading ? null : !user ? (
        <SignInPrompt what="Sign in to see your chips, claim the daily bonus and send chips to friends." />
      ) : !me ? (
        <div className="panel-skeleton tall" aria-hidden="true" />
      ) : (
        <>
          <div className="chip-grid">
            <section className="card card-balance" aria-label="Balance">
              <ChipIcon size={56} />
              <p className="balance-big">{formatChips(me.balance)}</p>
              <p className="card-text">chips</p>
            </section>
            <BonusCard me={me} />
            <SendCard me={me} />
          </div>

          <section className="card" aria-labelledby="history-title">
            <h2 id="history-title">History</h2>
            {!history ? (
              <div className="panel-skeleton" aria-hidden="true" />
            ) : (
              <ul className="ledger">
                {history.entries.map((entry) => (
                  <li key={entry.id}>
                    <span className="ledger-what">
                      <span>{describe(entry)}</span>
                      <time>{when(entry.created_at)}</time>
                    </span>
                    <span className={`ledger-amount${entry.amount < 0 ? " is-minus" : ""}`}>
                      {entry.amount > 0 ? "+" : "−"}
                      {formatChips(Math.abs(entry.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </section>
  );
}
