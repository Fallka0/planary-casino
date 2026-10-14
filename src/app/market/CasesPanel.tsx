"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { ChipIcon } from "@/components/ChipIcon";
import { ApiError, callCasino, type Me, useCasino, useCasinoAction } from "@/lib/api";
import { formatChips } from "@/lib/games";
import { opens, roll } from "../../../shared/fair";
import { type ItemInfo, type Kind, Swatch, type Tier, TierLabel } from "./cosmetics";

interface CaseItem extends ItemInfo {
  weight: number;
}
interface CaseInfo {
  id: string;
  name: string;
  price: number;
  blurb: string;
  total: number;
  items: CaseItem[];
}
interface Proof {
  hash: string;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  roll: number;
  total: number;
}
interface Opened {
  item: ItemInfo;
  copyId: number;
  proof: Proof;
  balance: number;
}

const TIERS: Tier[] = ["legendary", "epic", "rare", "common"];
const TILE = 132; // tile width + gap, px
const REEL_LENGTH = 54;
const WINNER_AT = 46;
/** The reel is the show, so it takes its time; the button answering the press does not. */
const SPIN_MS = 5600;

const randomSeed = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(16).padStart(2, "0")).join("");

function pct(part: number, total: number) {
  const value = (part / total) * 100;
  return `${value < 1 ? value.toFixed(2) : value.toFixed(1)}%`;
}

/** Filler for the reel, drawn with the case's own odds so it looks like what the case holds. Only the tile at WINNER_AT is the result. */
function filler(box: CaseInfo, n: number) {
  return Array.from({ length: n }, () => {
    let at = Math.random() * box.total;
    for (const item of box.items) {
      if (at < item.weight) return item;
      at -= item.weight;
    }
    return box.items[0];
  });
}

/** Re-runs the draw in this browser: the seed matches the hash shown before paying, and the seeds give this roll. */
async function check(proof: Proof) {
  return (await opens(proof.serverSeed, proof.hash)) && (await roll(proof.serverSeed, proof.clientSeed, proof.nonce, proof.total)) === proof.roll;
}

function Reel({ box, result, me, onDone }: { box: CaseInfo; result: Opened; me: Me; onDone: () => void }) {
  const [tiles] = useState(() => {
    const strip = filler(box, REEL_LENGTH);
    strip[WINNER_AT] = { ...result.item, weight: 0 };
    return strip;
  });
  const [offset, setOffset] = useState(0);
  const windowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      onDone();
      return;
    }
    const width = windowRef.current?.clientWidth ?? 600;
    // Land somewhere inside the winning tile, not dead centre, the way a real reel would.
    const jitter = (Math.random() - 0.5) * (TILE - 40);
    const frame = requestAnimationFrame(() => setOffset(WINNER_AT * TILE + TILE / 2 - width / 2 + jitter));
    const done = window.setTimeout(onDone, SPIN_MS + 250);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(done);
    };
  }, [onDone]);

  return (
    <div className="reel" ref={windowRef} aria-hidden="true">
      <div className="reel-strip" style={{ transform: `translateX(${-offset}px)`, transitionDuration: `${SPIN_MS}ms` }}>
        {tiles.map((item, i) => (
          <div key={i} className={`reel-tile item-${item.tier}`}>
            <div className="reel-swatch">
              <Swatch item={item} me={me} size={56} />
            </div>
            <span className={`reel-name tier-${item.tier}`}>{item.name}</span>
          </div>
        ))}
      </div>
      <span className="reel-marker" />
    </div>
  );
}

function Result({ opened, me, onAgain, onSell, again }: { opened: Opened; me: Me; onAgain: () => void; onSell: (kind: Kind) => void; again: boolean }) {
  const act = useCasinoAction();
  const [equipped, setEquipped] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [showProof, setShowProof] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    check(opened.proof).then((ok) => live && setVerified(ok), () => live && setVerified(false));
    return () => {
      live = false;
    };
  }, [opened]);

  async function equip() {
    setError(null);
    try {
      await act("/v1/inventory/equip", { kind: opened.item.kind, itemId: opened.item.id });
      setEquipped(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
    }
  }

  return (
    <div className={`case-result item-${opened.item.tier}`} role="status">
      <div className="case-result-swatch">
        <Swatch item={opened.item} me={me} size={88} />
      </div>
      <div className="case-result-copy">
        <TierLabel tier={opened.item.tier} />
        <strong>{opened.item.name}</strong>
        <p>{opened.item.blurb}</p>
      </div>
      <div className="case-result-actions">
        <button className="btn btn-cherry" onClick={onAgain} disabled={!again}>
          Open another
        </button>
        <button className="btn btn-quiet" onClick={() => void equip()} disabled={equipped}>
          {equipped ? (
            <>
              <Check size={15} strokeWidth={2.6} aria-hidden="true" /> Equipped
            </>
          ) : (
            "Equip"
          )}
        </button>
        <button className="btn btn-quiet" onClick={() => onSell(opened.item.kind)}>
          Sell on the market
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="proof-toggle" onClick={() => setShowProof((v) => !v)} aria-expanded={showProof}>
        {verified === null ? (
          "Checking the draw…"
        ) : verified ? (
          <>
            <ShieldCheck size={15} strokeWidth={2.2} aria-hidden="true" /> Draw checked in your browser
          </>
        ) : (
          <>
            <X size={15} strokeWidth={2.4} aria-hidden="true" /> This draw didn&apos;t check out
          </>
        )}
      </button>
      {showProof ? (
        <dl className="proof">
          <dt>Committed before you paid</dt>
          <dd>{opened.proof.hash}</dd>
          <dt>Server seed, revealed</dt>
          <dd>{opened.proof.serverSeed}</dd>
          <dt>Your seed</dt>
          <dd>{opened.proof.clientSeed}</dd>
          <dt>Roll</dt>
          <dd>
            {formatChips(opened.proof.roll)} of {formatChips(opened.proof.total)}
          </dd>
        </dl>
      ) : null}
    </div>
  );
}

export function CasesPanel({ me, onSell }: { me: Me; onSell: (kind: Kind) => void }) {
  const { accessToken } = useAuth();
  const { data } = useCasino<{ balance: number; cases: CaseInfo[] }>("/v1/cases");
  const [caseId, setCaseId] = useState<string | null>(null);
  const [commitment, setCommitment] = useState<{ caseId: string; openingId: string; hash: string } | null>(null);
  const [clientSeed, setClientSeed] = useState(randomSeed);
  const [phase, setPhase] = useState<"idle" | "paying" | "spinning" | "done">("idle");
  const [opened, setOpened] = useState<Opened | null>(null);
  const [error, setError] = useState<string | null>(null);

  const box = data?.cases.find((c) => c.id === (caseId ?? data.cases[0]?.id)) ?? null;
  const balance = opened?.balance ?? data?.balance ?? me.balance;

  // A fresh commitment for whichever case is up next. It's shown before paying, so
  // it has to exist before the button does anything.
  const boxId = box?.id ?? null;
  const committedTo = commitment?.caseId ?? null;
  useEffect(() => {
    if (!accessToken || !boxId || phase !== "idle" || committedTo === boxId) return;
    let live = true;
    callCasino<{ openingId: string; hash: string }>(accessToken, `/v1/cases/${boxId}/prepare`, {}).then(
      (next) => live && setCommitment({ caseId: boxId, ...next }),
      (e) => live && setError(e instanceof ApiError ? e.message : "Couldn't get the case ready."),
    );
    return () => {
      live = false;
    };
  }, [accessToken, boxId, phase, committedTo]);

  async function open() {
    if (!box || !commitment || !accessToken) return;
    setPhase("paying");
    setError(null);
    try {
      const result = await callCasino<Opened>(accessToken, `/v1/cases/${box.id}/open`, { openingId: commitment.openingId, clientSeed });
      setOpened(result);
      setPhase("spinning");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
      setCommitment(null);
      setPhase("idle");
    }
  }

  const landed = useCallback(() => {
    setPhase("done");
    window.dispatchEvent(new Event("casino:changed"));
  }, []);

  function again() {
    setOpened(null);
    setClientSeed(randomSeed());
    setCommitment(null);
    setPhase("idle");
  }

  if (!data || !box) return <div className="panel-skeleton tall" aria-hidden="true" />;

  const busy = phase === "paying" || phase === "spinning";
  const affordable = balance >= box.price;
  const byTier = TIERS.map((tier) => ({ tier, items: box.items.filter((i) => i.tier === tier) })).filter((t) => t.items.length);

  return (
    <div className="cases">
      <div className="filters" role="tablist" aria-label="Case">
        {data.cases.map((c) => (
          <button
            key={c.id}
            role="tab"
            className="filter"
            aria-selected={c.id === box.id}
            aria-pressed={c.id === box.id}
            disabled={busy}
            onClick={() => {
              setCaseId(c.id);
              again();
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      <section className="case-stage" aria-label={box.name}>
        <div className="case-head">
          <div className={`case-art case-${box.id}`} aria-hidden="true">
            <span>{box.name.replace(" Case", "")}</span>
          </div>
          <div className="case-copy">
            <h2>{box.name}</h2>
            <p>{box.blurb}</p>
            <div className="case-buy">
              <button className="btn btn-cherry btn-lg" onClick={() => void open()} disabled={busy || phase === "done" || !commitment || !affordable}>
                {phase === "paying" ? "Opening…" : phase === "spinning" ? "Rolling…" : (
                  <>
                    Open for <ChipIcon size={17} /> {formatChips(box.price)}
                  </>
                )}
              </button>
              {!affordable && phase === "idle" ? <span className="case-short">You need {formatChips(box.price - balance)} more chips.</span> : null}
            </div>
            {error ? <p className="form-error">{error}</p> : null}
          </div>
        </div>

        {phase === "spinning" || phase === "done" ? (
          opened ? (
            phase === "spinning" ? (
              <Reel box={box} result={opened} me={me} onDone={landed} />
            ) : (
              <Result opened={opened} me={me} again={balance >= box.price} onAgain={again} onSell={onSell} />
            )
          ) : null
        ) : null}

        <details className="case-fair">
          <summary>
            <ShieldCheck size={15} strokeWidth={2.2} aria-hidden="true" /> Provably fair
          </summary>
          <p>
            Before you pay, the house commits to a server seed by showing its hash. Your seed and that one decide the item together, so neither side can steer
            it. After opening, the seed is revealed and your browser re-runs the draw.
          </p>
          <dl className="proof">
            <dt>House commitment</dt>
            <dd>{commitment?.hash ?? "…"}</dd>
          </dl>
          <label className="field">
            Your seed
            <input value={clientSeed} maxLength={64} onChange={(e) => setClientSeed(e.target.value)} disabled={busy} />
          </label>
        </details>
      </section>

      <section className="case-contents" aria-label="What's inside">
        {byTier.map(({ tier, items }) => (
          <div key={tier} className="case-tier">
            <h3>
              <TierLabel tier={tier} />
              <span className="case-odds">{pct(items.reduce((sum, i) => sum + i.weight, 0), box.total)}</span>
            </h3>
            <ul className="case-items">
              {items.map((item) => (
                <li key={item.id} className={`case-item item-${item.tier}`} title={item.blurb}>
                  <div className="case-item-swatch">
                    <Swatch item={item} me={me} size={48} />
                  </div>
                  <span>{item.name}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
