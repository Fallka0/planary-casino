"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Link2, Loader2, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { CASINO_API } from "@/lib/api";
import { checkRoll, commit, roll, type Check as Verdict } from "../../../shared/fair";

/**
 * Check a spin for yourself.
 *
 * Everything on this page happens in the browser. The arithmetic is the same
 * file the table runs — shared/fair.ts — so nothing here depends on trusting
 * what our server says about its own wheel. You can even fill the boxes in by
 * hand from a screenshot of the table and never ask us anything at all.
 */

interface Proof {
  serverSeed: string;
  hash: string;
  clientSeed: string;
  nonce: string;
  pockets: string;
  claimed: string;
}

const EMPTY: Proof = { serverSeed: "", hash: "", clientSeed: "", nonce: "", pockets: "37", claimed: "" };

const FIELDS: { key: keyof Proof; label: string; hint: string; mono?: boolean }[] = [
  { key: "serverSeed", label: "Server seed", hint: "Published by the table after the ball landed.", mono: true },
  { key: "hash", label: "Commitment", hint: "The hash the table showed before anyone bet.", mono: true },
  { key: "clientSeed", label: "Player seeds", hint: "What the players contributed, joined by | in the order taken.", mono: true },
  { key: "nonce", label: "Spin number", hint: "Counts spins at that table." },
  { key: "pockets", label: "Pockets on the wheel", hint: "37 on a European wheel." },
  { key: "claimed", label: "The number it gave", hint: "What the table said came up." },
];

function Verdict({ verdict, recomputed }: { verdict: Verdict | null; recomputed: number | null }) {
  if (!verdict) return null;
  if (verdict.ok) {
    return (
      <p className="verdict is-ok">
        <Check size={20} aria-hidden="true" />
        <span>
          <strong>It checks out.</strong> The seed matches the hash the table published beforehand, and those seeds give{" "}
          <b className="num">{verdict.outcome}</b> — the number you were paid on.
        </span>
      </p>
    );
  }
  const why = {
    sealed: "This spin has not been opened yet. The seed is published when the ball lands.",
    "hash mismatch": "The seed does not hash to that commitment. These two did not come from the same spin.",
    "outcome mismatch": `These seeds give ${recomputed}, not the number entered. Check the spin number and the order of the player seeds.`,
  }[verdict.reason];
  return (
    <p className="verdict is-bad">
      <X size={20} aria-hidden="true" />
      <span>
        <strong>That does not add up.</strong> {why}
      </span>
    </p>
  );
}

function Verifier() {
  const params = useSearchParams();
  const { accessToken } = useAuth();
  const [proof, setProof] = useState<Proof>(EMPTY);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [recomputed, setRecomputed] = useState<number | null>(null);
  const [hashOfSeed, setHashOfSeed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const roundId = params.get("round");

  const set = (key: keyof Proof) => (value: string) => {
    setProof((p) => ({ ...p, [key]: value }));
    setVerdict(null);
  };

  /** Fills the boxes from a round we have on file. The checking still happens here. */
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
          outcome: string;
          proof: { hash: string; clientSeed: string; nonce: number; serverSeed: string | null };
        };
        setProof({
          serverSeed: round.proof.serverSeed ?? "",
          hash: round.proof.hash,
          clientSeed: round.proof.clientSeed,
          nonce: String(round.proof.nonce),
          pockets: "37",
          claimed: String(Number.parseInt(round.outcome, 10)),
        });
        setVerdict(null);
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
    const pockets = Number.parseInt(proof.pockets, 10);
    const nonce = Number.parseInt(proof.nonce, 10);
    const claimed = Number.parseInt(proof.claimed, 10);
    if (!Number.isInteger(pockets) || pockets < 2 || !Number.isInteger(nonce) || !Number.isInteger(claimed)) {
      setVerdict({ ok: false, reason: "outcome mismatch" });
      return;
    }
    setHashOfSeed(proof.serverSeed ? await commit(proof.serverSeed) : null);
    setRecomputed(proof.serverSeed ? await roll(proof.serverSeed, proof.clientSeed, nonce, pockets) : null);
    setVerdict(await checkRoll({ hash: proof.hash, serverSeed: proof.serverSeed || null, clientSeed: proof.clientSeed, nonce }, pockets, claimed));
  }

  return (
    <section className="page verify" aria-labelledby="page-title">
      <div className="page-head">
        <h1 id="page-title">Check it yourself</h1>
        <p className="page-sub">
          Every Planary spin is decided before you bet, by a seed the table commits to in advance. This page takes that seed and
          works the number out again — here, in your browser, using the same code the table runs. You do not have to take our
          word for anything.
        </p>
      </div>

      <div className="card">
        <form className="verify-form" onSubmit={verify}>
          {roundId ? (
            <p className="verify-round">
              <Link2 size={15} aria-hidden="true" /> Round <b className="mono">{roundId}</b>
              {loading ? <Loader2 size={15} className="spin" aria-hidden="true" /> : null}
            </p>
          ) : null}
          {loadError ? <p className="form-error">{loadError}</p> : null}

          {FIELDS.map((f) => (
            <label key={f.key} className="field">
              {f.label}
              <input
                value={proof[f.key]}
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

        <Verdict verdict={verdict} recomputed={recomputed} />

        {verdict && hashOfSeed ? (
          <dl className="verify-work">
            <div>
              <dt>SHA-256 of the server seed</dt>
              <dd className={`mono ${hashOfSeed === proof.hash.trim().toLowerCase() ? "is-ok" : "is-bad"}`}>{hashOfSeed}</dd>
            </div>
            <div>
              <dt>The commitment it was checked against</dt>
              <dd className="mono">{proof.hash.trim().toLowerCase() || "—"}</dd>
            </div>
            <div>
              <dt>HMAC-SHA256, reduced to a pocket</dt>
              <dd className="num">{recomputed}</dd>
            </div>
          </dl>
        ) : null}
      </div>

      <div className="card verify-how">
        <h2>How a spin is decided</h2>
        <ol className="rules-list">
          <li>
            <strong>Before betting opens</strong>, the table draws a random server seed and shows you only its SHA-256 hash. From
            that moment it cannot change the seed without changing a hash you have already seen.
          </li>
          <li>
            <strong>While betting is open</strong>, any player may add a seed of their own. They are joined in the order the table
            took them and published when betting closes.
          </li>
          <li>
            <strong>The number</strong> is HMAC-SHA256 of the server seed over the player seeds and the spin number, reduced to a
            pocket by rejection sampling — not by a remainder, which would make some pockets very slightly likelier than others.
          </li>
          <li>
            <strong>After the ball lands</strong>, the server seed is published. Hash it: it matches what you were shown. Run the
            HMAC: it gives the number you were paid on.
          </li>
        </ol>
        <p className="rules-note">
          Neither side can steer it. The house committed before it saw the players&apos; seeds, and the players chose before they
          saw the house&apos;s. Blackjack works the same way, with one commitment covering a whole shoe.
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
