"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Link2, Loader2, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { CASINO_API } from "@/lib/api";
import { commit, opens, roll } from "../../../shared/fair";
import { checkCards, prettyCard, shuffledShoe } from "../../../shared/deck";

/**
 * Check a spin or a hand for yourself.
 *
 * Everything on this page happens in the browser, with the same two files the
 * tables run — shared/fair.ts and shared/deck.ts. Nothing here depends on
 * trusting what our server says about its own wheel or its own shoe. The boxes
 * can be filled from a round we hold on file, or typed in by hand from a
 * screenshot, by somebody without an account.
 */

type Mode = "roulette" | "blackjack";

interface Fields {
  serverSeed: string;
  hash: string;
  clientSeed: string;
  nonce: string;
  /** Roulette: how many pockets were on the wheel, and the number it gave. */
  pockets: string;
  claimed: string;
  /** Blackjack: where in the shoe the hand started, and the cards it pulled. */
  from: string;
  drawn: string;
}

const EMPTY: Fields = { serverSeed: "", hash: "", clientSeed: "", nonce: "", pockets: "37", claimed: "", from: "", drawn: "" };

const COMMON: { key: keyof Fields; label: string; hint: string; mono?: boolean }[] = [
  { key: "serverSeed", label: "Server seed", hint: "Published by the table afterwards.", mono: true },
  { key: "hash", label: "Commitment", hint: "The hash the table showed beforehand.", mono: true },
  { key: "clientSeed", label: "Player seeds", hint: "What players contributed, joined by | in the order taken.", mono: true },
];

const EXTRA: Record<Mode, { key: keyof Fields; label: string; hint: string; mono?: boolean }[]> = {
  roulette: [
    { key: "nonce", label: "Spin number", hint: "Counts spins at that table." },
    { key: "pockets", label: "Pockets on the wheel", hint: "37 on a European wheel." },
    { key: "claimed", label: "The number it gave", hint: "What the table said came up." },
  ],
  blackjack: [
    { key: "nonce", label: "Shoe number", hint: "Counts shoes at that table." },
    { key: "from", label: "Position in the shoe", hint: "Which card of the shuffle this hand started on." },
    { key: "drawn", label: "Cards dealt, in order", hint: "As recorded: Aspade 10heart Kclub …", mono: true },
  ],
};

type Verdict =
  | { ok: true; text: React.ReactNode }
  | { ok: false; text: React.ReactNode };

function Result({ verdict }: { verdict: Verdict | null }) {
  if (!verdict) return null;
  return (
    <p className={`verdict ${verdict.ok ? "is-ok" : "is-bad"}`}>
      {verdict.ok ? <Check size={20} aria-hidden="true" /> : <X size={20} aria-hidden="true" />}
      <span>{verdict.text}</span>
    </p>
  );
}

function Verifier() {
  const params = useSearchParams();
  const { accessToken } = useAuth();
  const [mode, setMode] = useState<Mode>("roulette");
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [work, setWork] = useState<[string, string, boolean?][] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const roundId = params.get("round");

  const set = (key: keyof Fields) => (value: string) => {
    setFields((f) => ({ ...f, [key]: value }));
    setVerdict(null);
    setWork(null);
  };

  /** Fills the boxes from a round we hold. The checking still happens here. */
  const load = useCallback(
    async (id: string) => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`${CASINO_API}/v1/rounds/${encodeURIComponent(id)}`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        });
        if (res.status === 401) throw new Error("Sign in to look a round up by its number — or paste the proof in by hand below.");
        if (!res.ok) throw new Error("No round with that number.");
        const round = (await res.json()) as {
          game: string;
          outcome: string;
          log: { from?: number; drawn?: string[] } | null;
          proof: { hash: string; clientSeed: string; nonce: number; serverSeed: string | null };
        };
        const game: Mode = round.game === "blackjack" ? "blackjack" : "roulette";
        setMode(game);
        setFields({
          ...EMPTY,
          serverSeed: round.proof.serverSeed ?? "",
          hash: round.proof.hash,
          clientSeed: round.proof.clientSeed,
          nonce: String(round.proof.nonce),
          claimed: game === "roulette" ? String(Number.parseInt(round.outcome, 10)) : "",
          from: round.log?.from !== undefined ? String(round.log.from) : "",
          drawn: (round.log?.drawn ?? []).join(" "),
        });
        setVerdict(null);
        setWork(null);
        if (game === "blackjack" && !round.proof.serverSeed) {
          setLoadError("This shoe is still in play. Its seed is published when the dealer shuffles, and then the whole shoe can be checked at once.");
        }
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Could not fetch that round.");
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  useEffect(() => {
    if (roundId) void load(roundId);
  }, [roundId, load]);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    const nonce = Number.parseInt(fields.nonce, 10);
    if (!fields.serverSeed) {
      setVerdict({ ok: false, text: <><strong>Nothing to check yet.</strong> The server seed is published once the spin lands, or once the shoe is finished.</> });
      return;
    }
    const hashes = await commit(fields.serverSeed);
    const sealed = await opens(fields.serverSeed, fields.hash);
    const rows: [string, string, boolean?][] = [
      ["SHA-256 of the server seed", hashes, sealed],
      ["The commitment it is checked against", fields.hash.trim().toLowerCase() || "—"],
    ];

    if (!sealed) {
      setWork(rows);
      setVerdict({ ok: false, text: <><strong>That does not add up.</strong> The seed does not hash to that commitment — these two did not come from the same round.</> });
      return;
    }

    if (mode === "roulette") {
      const pockets = Number.parseInt(fields.pockets, 10);
      const claimed = Number.parseInt(fields.claimed, 10);
      if (!Number.isInteger(pockets) || pockets < 2 || !Number.isInteger(nonce) || !Number.isInteger(claimed)) {
        setVerdict({ ok: false, text: <><strong>Something is missing.</strong> The spin number, the pocket count and the number it gave all have to be whole numbers.</> });
        return;
      }
      const outcome = await roll(fields.serverSeed, fields.clientSeed, nonce, pockets);
      rows.push(["HMAC-SHA256, reduced to a pocket", String(outcome), outcome === claimed]);
      setWork(rows);
      setVerdict(
        outcome === claimed
          ? { ok: true, text: <><strong>It checks out.</strong> The seed matches the hash the table published beforehand, and those seeds give <b className="num">{outcome}</b> — the number you were paid on.</> }
          : { ok: false, text: <><strong>That does not add up.</strong> These seeds give {outcome}, not the number entered. Check the spin number and the order of the player seeds.</> },
      );
      return;
    }

    const from = Number.parseInt(fields.from, 10);
    const drawn = fields.drawn.trim().split(/[\s,]+/).filter(Boolean);
    if (!Number.isInteger(nonce) || !Number.isInteger(from) || drawn.length === 0) {
      setVerdict({ ok: false, text: <><strong>Something is missing.</strong> A hand needs the shoe number, the position it started at, and the cards it pulled.</> });
      return;
    }
    const shoe = await shuffledShoe(fields.serverSeed, fields.clientSeed, nonce);
    const check = checkCards(shoe, from, drawn);
    rows.push(["The shoe this seed shuffles to, from that position", shoe.slice(from, from + drawn.length).map(prettyCard).join(" "), check.ok]);
    rows.push(["The cards the table says it dealt", drawn.map(prettyCard).join(" ")]);
    setWork(rows);
    setVerdict(
      check.ok
        ? {
            ok: true,
            text: (
              <>
                <strong>It checks out.</strong> The seed matches the hash shown while the shoe was dealt, and card {from + 1} of that shuffle onwards is exactly{" "}
                <b>{drawn.map(prettyCard).join(" ")}</b> — the hand you played.
              </>
            ),
          }
        : {
            ok: false,
            text: (
              <>
                <strong>That does not add up.</strong> The committed shoe holds different cards at that position. Check the shoe number and the position — a
                hand from a different shoe will not match.
              </>
            ),
          },
    );
  }

  const shown = [...COMMON, ...EXTRA[mode]];

  return (
    <section className="page verify" aria-labelledby="page-title">
      <div className="page-head">
        <h1 id="page-title">Check it yourself</h1>
        <p className="page-sub">
          Every Planary spin and every shoe is decided before you bet, by a seed the table commits to in advance. This page takes
          that seed and works the result out again — here, in your browser, with the same code the table runs. You do not have to
          take our word for anything.
        </p>
      </div>

      <div className="card">
        <div className="verify-modes" role="group" aria-label="What are you checking?">
          {(
            [
              ["roulette", "A roulette spin"],
              ["blackjack", "A blackjack hand"],
            ] as [Mode, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`verify-mode${mode === id ? " is-on" : ""}`}
              aria-pressed={mode === id}
              onClick={() => {
                setMode(id);
                setVerdict(null);
                setWork(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <form className="verify-form" onSubmit={verify}>
          {roundId ? (
            <p className="verify-round">
              <Link2 size={15} aria-hidden="true" /> Round <b className="mono">{roundId}</b>
              {loading ? <Loader2 size={15} className="spin" aria-hidden="true" /> : null}
            </p>
          ) : null}
          {loadError ? <p className="form-error">{loadError}</p> : null}

          {shown.map((f) => (
            <label key={f.key} className="field">
              {f.label}
              <input
                value={fields[f.key]}
                onChange={(e) => set(f.key)(e.target.value)}
                className={f.mono ? "mono" : "num"}
                spellCheck={false}
                autoComplete="off"
                inputMode={f.mono ? "text" : "numeric"}
              />
              <span className="field-hint">{f.hint}</span>
            </label>
          ))}

          <button type="submit" className="btn btn-cherry">
            Work it out
          </button>
        </form>

        <Result verdict={verdict} />

        {work ? (
          <dl className="verify-work">
            {work.map(([label, value, ok]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd className={`mono ${ok === undefined ? "" : ok ? "is-ok" : "is-bad"}`}>{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>

      <div className="card verify-how">
        <h2>How it is decided</h2>
        <ol className="rules-list">
          <li>
            <strong>Before you can bet</strong>, the table draws a random server seed and shows you only its SHA-256 hash. From
            that moment it cannot change the seed without changing a hash you have already seen.
          </li>
          <li>
            <strong>While betting is open</strong>, any player may add a seed of their own. They are joined in the order the table
            took them and published when betting closes.
          </li>
          <li>
            <strong>Roulette</strong> takes HMAC-SHA256 of the server seed over the player seeds and the spin number, and reduces
            it to a pocket by rejection sampling — not by a remainder, which would make some pockets very slightly likelier than
            others.
          </li>
          <li>
            <strong>Blackjack</strong> shuffles all 312 cards from the same kind of seed before the first is dealt, and the cut
            card comes out of it too — so where the shoe ends is settled in advance as well. The seed stays sealed until the shoe
            is finished, because publishing it sooner would show you the rest of the cards.
          </li>
          <li>
            <strong>Afterwards</strong> the seed is published. Hash it: it matches what you were shown. Run it again: it gives the
            number you were paid on, or the exact cards you were dealt.
          </li>
        </ol>
        <p className="rules-note">
          Neither side can steer it. The house committed before it saw the players&apos; seeds, and the players chose before they
          saw the house&apos;s.
        </p>
      </div>
    </section>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <Verifier />
    </Suspense>
  );
}
