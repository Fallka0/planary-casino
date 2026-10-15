"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ApiError, callCasino, type Me, type PlayerBadge, useCasino, useCasinoAction } from "@/lib/api";
import { opens, roll } from "../../../shared/fair";
import { CaseArt, reducedMotion } from "./CaseArt";
import { type CaseInfo, type CaseItem, caseLabel, type Equipped, fmt, type ItemInfo, ItemArt, KIND_LABEL, type Tier, TIER_LABEL, TIERS } from "./cosmetics";
import { useMarketSound } from "./sound";

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
interface Drop {
  id: string;
  at: number;
  item: ItemInfo;
  player: PlayerBadge;
  mine: boolean;
}
type Phase = "idle" | "anticipation" | "reel" | "hold" | "result" | "error";

// The reel: 40 tiles, the winner at 34. Everything else on it is drawn from the case's own odds.
const REEL_TILES = 40;
const WINNER = 34;
const GAP = 8;
/** When the ticket has torn and the reel takes over. */
const REEL_IN = 1300;
const ACCELERATE = 600;
const DECELERATE = 3600;
const HOLD: Record<Tier, number> = { common: 400, rare: 600, epic: 600, legendary: 900 };
const PARTICLES: Record<Tier, number> = { common: 0, rare: 14, epic: 22, legendary: 34 };
const RAYS: Record<Tier, number> = { common: 0, rare: 0.18, epic: 0.26, legendary: 0.34 };

const randomSeed = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, "0")).join("");
const isPhone = () => typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches;

function draw(box: CaseInfo) {
  let at = Math.random() * box.total;
  for (const item of box.items) {
    if (at < item.weight) return item;
    at -= item.weight;
  }
  return box.items[0];
}

/** Re-runs the draw here: the seed matches the hash shown before paying, and the seeds give this roll. */
async function check(proof: Proof) {
  return (await opens(proof.serverSeed, proof.hash)) && (await roll(proof.serverSeed, proof.clientSeed, proof.nonce, proof.total)) === proof.roll;
}

function Reel({
  box,
  result,
  me,
  hold,
  onLanded,
  onTick,
}: {
  box: CaseInfo;
  result: ItemInfo;
  me: Me;
  hold: boolean;
  onLanded: () => void;
  onTick: () => void;
}) {
  const [tiles] = useState(() => {
    const strip: (CaseItem | ItemInfo)[] = Array.from({ length: REEL_TILES }, () => draw(box));
    strip[WINNER] = result;
    return strip;
  });
  const [phone] = useState(isPhone);
  const view = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const tile = phone ? { w: 96, h: 124 } : { w: 132, h: 156 };
  // The run reads these live, so turning the sound on mid-reel is heard at once.
  const cues = useRef({ onLanded, onTick });
  useEffect(() => {
    cues.current = { onLanded, onTick };
  }, [onLanded, onTick]);

  useEffect(() => {
    const v = view.current;
    const s = strip.current;
    if (!v || !s) return;
    v.animate([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: 200, easing: "cubic-bezier(.2,0,0,1)" });

    // Accelerate, then decelerate onto the winner's centre. The deceleration
    // starts at exactly the speed the acceleration ended on, so there's no seam.
    const width = v.clientWidth;
    const pitch = tile.w + GAP;
    const distance = WINNER * pitch + tile.w / 2 - width / 2;
    const k = 4;
    const decel = distance / (1 + (k * ACCELERATE) / (2 * DECELERATE));
    const speed = (decel * k) / DECELERATE;
    const accel = (speed * ACCELERATE) / 2;
    const t0 = performance.now();
    let frame = 0;
    let last = -1;
    const step = (now: number) => {
      const t = now - t0;
      const x =
        t < ACCELERATE
          ? (speed * t * t) / (2 * ACCELERATE)
          : t < ACCELERATE + DECELERATE
            ? accel + decel * (1 - Math.pow(1 - (t - ACCELERATE) / DECELERATE, k))
            : distance;
      s.style.transform = `translateX(${-x}px)`;
      const under = Math.floor((x + width / 2) / pitch);
      if (under !== last) {
        last = under;
        cues.current.onTick();
      }
      if (t < ACCELERATE + DECELERATE) frame = requestAnimationFrame(step);
      else cues.current.onLanded();
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // The run is fixed the moment the reel mounts; it must not restart on a re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mk-reel" ref={view} aria-hidden="true">
      <div className="mk-reel-strip" ref={strip}>
        {tiles.map((item, i) => (
          <div
            key={i}
            className={`mk-reel-tile frame-${item.tier}${hold && i === WINNER ? " is-winner" : ""}${hold && i !== WINNER ? " is-dim" : ""}`}
            style={{ width: tile.w, height: tile.h }}
          >
            <div className="mk-reel-in">
              <div className="mk-reel-art">
                <ItemArt item={item} me={me} size={tile.h - 52} />
              </div>
              <div className="mk-reel-name">{item.name}</div>
              <div className={`mk-edge is-thick edge-${item.tier}`} />
            </div>
          </div>
        ))}
      </div>
      <span className="mk-marker" />
      <span className="mk-notch-top" />
      <span className="mk-notch-bottom" />
    </div>
  );
}

/** Flat confetti, placed the same way every time for the same item. */
function particles(item: ItemInfo, phone: boolean) {
  const count = PARTICLES[item.tier];
  const inks = item.tier === "legendary" ? ["#ff5a78", "#fff3c4", "#8ee6ff", "#c58bff", "#f7c65c"] : [`var(--tier-${item.tier})`, "var(--paper)"];
  let seed = 0;
  for (const ch of item.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const r = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296;
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + r() * 0.4;
    const reach = (phone ? 120 : 170) + r() * (phone ? 80 : 150);
    const square = r() > 0.5;
    const size = 6 + r() * 7;
    return {
      dx: Math.round(Math.cos(angle) * reach),
      dy: Math.round(Math.sin(angle) * reach),
      turn: Math.round(r() * 540 - 270),
      w: Math.round(square ? size : size * 0.45),
      h: Math.round(square ? size : size * 1.6),
      round: r() > 0.7,
      color: inks[i % inks.length],
      delay: Math.round(120 + r() * 140),
    };
  });
}

function Result({
  opened,
  box,
  cases,
  me,
  equipped,
  balance,
  canOpen,
  onAgain,
  onSell,
}: {
  opened: Opened;
  box: CaseInfo;
  cases: CaseInfo[];
  me: Me;
  equipped: Equipped | null;
  balance: number;
  canOpen: boolean;
  onAgain: () => void;
  onSell: () => void;
}) {
  const act = useCasinoAction();
  const { item, proof } = opened;
  const [verified, setVerified] = useState<boolean | null>(null);
  const [showProof, setShowProof] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phone] = useState(isPhone);
  const [still] = useState(reducedMotion);
  const bits = useMemo(() => (still ? [] : particles(item, phone)), [item, phone, still]);
  const wearing = equipped?.[item.kind] === item.id;

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      check(proof).then(
        (ok) => live && setVerified(ok),
        () => live && setVerified(false),
      );
    }, 600);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [proof]);

  async function equip() {
    setError(null);
    try {
      await act("/v1/inventory/equip", { kind: item.kind, itemId: item.id });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That didn't work.");
    }
  }

  return (
    <div className={`mk-result tier-${item.tier}${still ? " is-still" : ""}`} role="status">
      {RAYS[item.tier] && !still ? <div className={`mk-rays rays-${item.tier}`} style={{ "--ray-op": RAYS[item.tier] } as React.CSSProperties} /> : null}
      <div className="mk-result-card-wrap">
        <div className="mk-burst">
          {bits.map((b, i) => (
            <span
              key={i}
              style={
                {
                  width: b.w,
                  height: b.h,
                  background: b.color,
                  borderRadius: b.round ? "50%" : 2,
                  animationDelay: `${b.delay}ms`,
                  animationDuration: item.tier === "legendary" ? "1200ms" : "900ms",
                  "--dx": `${b.dx}px`,
                  "--dy": `${b.dy}px`,
                  "--r": `${b.turn}deg`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
        <div className={`mk-result-card frame-${item.tier}`}>
          <div className="mk-result-in">
            <div className="mk-result-art">
              <ItemArt item={item} me={me} size={phone ? 122 : 162} />
            </div>
            <div className="mk-meta">
              <span className={`mk-tier tier-${item.tier}`}>{TIER_LABEL[item.tier]}</span>
              <span>
                {KIND_LABEL[item.kind]} · {caseLabel(item, cases) ?? box.name}
              </span>
            </div>
            <div className="mk-result-name">{item.name}</div>
            {item.tier === "legendary" && !still ? <div className="mk-sweep" /> : null}
          </div>
          {item.tier === "legendary" ? <div className="mk-stamp">Legendary</div> : null}
        </div>
      </div>

      <div className="mk-result-foot">
        {verified === null ? (
          <p className="mk-dim mk-small">Checking the draw in your browser…</p>
        ) : verified ? (
          <button className="mk-proof-pill" onClick={() => setShowProof((v) => !v)} aria-expanded={showProof}>
            <span className="mk-check">✓</span>Draw checked in your browser<span className="mk-quiet">{showProof ? "Hide proof" : "Show proof"}</span>
          </button>
        ) : (
          <p className="mk-error">This draw didn&apos;t check out. Keep the proof below and tell us.</p>
        )}
        {showProof || verified === false ? (
          <dl className="mk-proof">
            <dt>Hash shown first</dt>
            <dd className="mk-mono">{proof.hash}</dd>
            <dt>Revealed seed</dt>
            <dd className="mk-mono">{proof.serverSeed}</dd>
            <dt>Your seed</dt>
            <dd className="mk-mono">
              {proof.clientSeed} · nonce {proof.nonce}
            </dd>
            <dt>Roll</dt>
            <dd>
              {fmt(proof.roll)} of {fmt(proof.total)} → {item.name}
            </dd>
          </dl>
        ) : null}
        <div className="mk-actions is-center">
          {balance >= box.price ? (
            <button className="mk-btn mk-btn-primary" onClick={onAgain} disabled={!canOpen}>
              Open another · {fmt(box.price)}
            </button>
          ) : (
            <span className="mk-btn mk-btn-off">Need {fmt(box.price - balance)} more to open</span>
          )}
          <button className="mk-btn mk-btn-quiet" onClick={() => void equip()} disabled={wearing}>
            {wearing ? "Equipped" : "Equip"}
          </button>
          {item.tradeable ? (
            <button className="mk-btn mk-btn-quiet" onClick={onSell}>
              Sell on the market
            </button>
          ) : null}
        </div>
        {error ? <p className="mk-error">{error}</p> : null}
      </div>
    </div>
  );
}

export function CasesPanel({
  me,
  balance,
  equipped,
  onSell,
}: {
  me: Me;
  balance: number;
  equipped: Equipped | null;
  onSell: (itemId: string) => void;
}) {
  const { accessToken } = useAuth();
  const { data } = useCasino<{ balance: number; cases: CaseInfo[] }>("/v1/cases");
  const { data: recent } = useCasino<{ drops: Drop[] }>("/v1/cases/recent", 20_000);
  const sound = useMarketSound();
  const [caseId, setCaseId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [play, setPlay] = useState(0);
  const [commitment, setCommitment] = useState<{ caseId: string; openingId: string; hash: string } | null>(null);
  const [clientSeed, setClientSeed] = useState(() => `${me.name.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "you"}-${randomSeed()}`);
  const [fairOpen, setFairOpen] = useState(false);
  const [opened, setOpened] = useState<Opened | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  const box = data?.cases.find((c) => c.id === (caseId ?? data.cases[0]?.id)) ?? null;
  const funds = opened?.balance ?? balance;
  const busy = phase === "anticipation" || phase === "reel" || phase === "hold";

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  // A commitment for whichever case is up next. It's shown before paying, so it
  // has to exist before the button does anything; after an opening uses it, the
  // next one is drawn straight away, while the reel is still running.
  const boxId = box?.id ?? null;
  const committedTo = commitment?.caseId ?? null;
  useEffect(() => {
    if (!accessToken || !boxId || committedTo === boxId) return;
    let live = true;
    callCasino<{ openingId: string; hash: string }>(accessToken, `/v1/cases/${boxId}/prepare`, {}).then(
      (next) => live && setCommitment({ caseId: boxId, ...next }),
      (e) => live && setError(e instanceof ApiError ? e.message : "Couldn't get the case ready."),
    );
    return () => {
      live = false;
    };
  }, [accessToken, boxId, committedTo]);

  const reveal = useCallback(() => {
    clearTimers();
    setPhase("result");
    window.dispatchEvent(new Event("casino:changed"));
  }, [clearTimers]);

  useEffect(() => {
    if (phase === "result" && opened) sound.play("reveal", opened.item.tier);
    // Only when the result first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, opened]);

  async function open() {
    if (!box || !commitment || !accessToken || busy || funds < box.price) return;
    const started = performance.now();
    const still = reducedMotion();
    clearTimers();
    setOpened(null);
    setError(null);
    setPhase("anticipation");
    setPlay(Date.now());
    if (!still) later(() => sound.play("tear"), 780);
    try {
      const result = await callCasino<Opened>(accessToken, `/v1/cases/${box.id}/open`, { openingId: commitment.openingId, clientSeed });
      setCommitment(null);
      setOpened(result);
      if (still) reveal();
      else later(() => setPhase("reel"), Math.max(0, REEL_IN - (performance.now() - started)));
    } catch (e) {
      clearTimers();
      setError(e instanceof ApiError ? e.message : null);
      setCommitment(null);
      setPhase("error");
    }
  }

  const landed = useCallback(() => {
    if (!opened) return;
    sound.play("land");
    setPhase("hold");
    later(reveal, HOLD[opened.item.tier]);
  }, [opened, sound, later, reveal]);

  const tick = useCallback(() => sound.play("tick"), [sound]);

  if (!data || !box) return <CasesSkeleton />;

  const drops = recent?.drops ?? [];
  const tierRows = TIERS.map((tier) => {
    const items = box.items.filter((i) => i.tier === tier);
    return { tier, items, share: items.reduce((sum, i) => sum + i.weight, 0) / box.total };
  }).filter((t) => t.items.length);
  const pct = (share: number) => `${Math.round(share * 1000) / 10}%`;

  return (
    <div className="mk-stack">
      {drops.length ? (
        <div className="mk-drops">
          <span className="mk-label">Recent drops</span>
          <div className="mk-drops-row">
            {drops.map((d) => (
              <div key={d.id} className={`mk-drop${d.mine ? " is-mine" : ""}`}>
                <span className="mk-drop-art">
                  <ItemArt item={d.item} me={{ ...me, ...d.player }} size={26} />
                </span>
                <span className="mk-dim">{d.mine ? "You" : d.player.name}</span>
                <span className={`tier-${d.item.tier} mk-drop-name`}>{d.item.name}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <section className="mk-stage" aria-label={box.name}>
        {phase === "idle" || phase === "anticipation" ? (
          <div className="mk-stage-idle">
            <div className="mk-ticket-well">
              <CaseArt caseId={box.id} play={phase === "anticipation" ? play : 0} />
            </div>
            <div className="mk-stage-copy">
              <div className="mk-picker" role="radiogroup" aria-label="Case">
                {data.cases.map((c) => (
                  <button
                    key={c.id}
                    role="radio"
                    aria-checked={c.id === box.id}
                    className={`mk-pick${c.id === box.id ? " is-on" : ""}`}
                    disabled={busy}
                    onClick={() => {
                      setCaseId(c.id);
                      setPhase("idle");
                      setOpened(null);
                    }}
                  >
                    <span className="mk-pick-art">
                      <CaseArt caseId={c.id} idle={false} small />
                    </span>
                    <span className="mk-pick-copy">
                      <span className="mk-pick-name">{c.name}</span>
                      <span className="mk-pick-meta">{c.items.length} items</span>
                    </span>
                  </button>
                ))}
              </div>
              <div>
                <h2 className="mk-h2">{box.name}</h2>
                <p className="mk-sub">
                  {box.blurb} · {box.items.length} items
                </p>
              </div>
              <div className="mk-odds">
                <div className="mk-odds-bar">
                  {tierRows.map((t) => (
                    <span key={t.tier} className={`fill-${t.tier}`} style={{ width: pct(t.share) }} />
                  ))}
                </div>
                <div className="mk-odds-legend">
                  {tierRows.map((t) => (
                    <span key={t.tier}>
                      <span className={`mk-tier tier-${t.tier}`}>{TIER_LABEL[t.tier]}</span>
                      <span className="mk-num">{pct(t.share)}</span>
                    </span>
                  ))}
                </div>
              </div>
              <div className="mk-actions">
                {funds >= box.price ? (
                  <button
                    className={`mk-btn mk-btn-primary mk-btn-lg${phase === "anticipation" ? " is-held" : ""}`}
                    onClick={() => void open()}
                    disabled={!commitment && phase === "idle"}
                  >
                    {phase === "anticipation" ? "Opening…" : `Open for ${fmt(box.price)}`}
                  </button>
                ) : (
                  <>
                    <span className="mk-btn mk-btn-off mk-btn-lg">Open for {fmt(box.price)}</span>
                    <span className="mk-strong">You need {fmt(box.price - funds)} more chips.</span>
                  </>
                )}
              </div>
              <div className="mk-fair">
                <button className="mk-fair-toggle" onClick={() => setFairOpen((v) => !v)} aria-expanded={fairOpen}>
                  <span className="mk-check is-square">✓</span>Provably fair
                  <span className="mk-grow" />
                  <span className="mk-quiet mk-small">{commitment ? `Hash ${commitment.hash.slice(0, 6)}…${commitment.hash.slice(-4)}` : ""}</span>
                  <span className={`mk-chev${fairOpen ? " is-open" : ""}`}>▾</span>
                </button>
                {fairOpen ? (
                  <div className="mk-fair-panel">
                    <p className="mk-dim mk-small">
                      The house commits to its seed before you pay; your seed and that one decide the item together. Afterwards the seed is revealed and your
                      browser checks the draw.
                    </p>
                    <div>
                      <div className="mk-quiet mk-small">House seed hash</div>
                      <div className="mk-mono">{commitment?.hash ?? "Sealing…"}</div>
                    </div>
                    <label className="mk-quiet mk-small" htmlFor="client-seed">
                      Your client seed
                    </label>
                    <div className="mk-seed-row">
                      <input
                        id="client-seed"
                        className="mk-input mk-mono"
                        value={clientSeed}
                        maxLength={64}
                        disabled={busy}
                        onChange={(e) => setClientSeed(e.target.value.slice(0, 64))}
                      />
                      <button className="mk-btn mk-btn-quiet" disabled={busy} onClick={() => setClientSeed(`${clientSeed.split("-")[0] || "you"}-${randomSeed()}`)}>
                        Shuffle
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {(phase === "reel" || phase === "hold") && opened ? (
          <div className="mk-reel-stage">
            <div className="mk-reel-head">
              <div className="mk-h3">Opening {box.name}</div>
              <span className="mk-grow" />
              <button className="mk-btn mk-btn-quiet mk-btn-sm" onClick={sound.toggle} aria-pressed={sound.on}>
                {sound.on ? "Sound on" : "Sound off"}
              </button>
              <button className="mk-btn mk-btn-quiet mk-btn-sm" onClick={reveal}>
                Skip ›
              </button>
            </div>
            <Reel box={box} result={opened.item} me={me} hold={phase === "hold"} onLanded={landed} onTick={tick} />
            <p className="mk-quiet mk-small">
              <span className="mk-dim">Already drawn</span> · {opened.proof.hash.slice(0, 10)}…
            </p>
          </div>
        ) : null}

        {phase === "result" && opened ? (
          <Result
            opened={opened}
            box={box}
            cases={data.cases}
            me={me}
            equipped={equipped}
            balance={funds}
            canOpen={Boolean(commitment)}
            onAgain={() => void open()}
            onSell={() => onSell(opened.item.id)}
          />
        ) : null}

        {phase === "error" ? (
          <div className="mk-empty">
            <div className="mk-bang">!</div>
            <div className="mk-h3">The case didn&apos;t open</div>
            <p className="mk-sub">Nothing was charged.{error && error !== "Not enough chips." ? ` ${error}` : ""}</p>
            <div className="mk-actions is-center">
              <button className="mk-btn mk-btn-primary" onClick={() => void open()} disabled={!commitment}>
                Try again
              </button>
              <button className="mk-btn mk-btn-quiet" onClick={() => setPhase("idle")}>
                Back to the case
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="mk-panel" aria-label="In this case">
        <div className="mk-panel-head">
          <h3 className="mk-h3">In this case</h3>
          <span className="mk-quiet">{box.items.length} items</span>
        </div>
        {tierRows.map((t) => (
          <div key={t.tier} className="mk-tier-group">
            <div className="mk-tier-row">
              <span className={`mk-tier tier-${t.tier}`}>{TIER_LABEL[t.tier]}</span>
              <span className="mk-num">{pct(t.share)}</span>
              <span className="mk-rule" />
            </div>
            <div className="mk-contents">
              {t.items.map((item) => (
                <div key={item.id} className={`mk-content frame-${item.tier}`} title={item.blurb}>
                  <div className="mk-content-in">
                    <div className="mk-content-art">
                      <ItemArt item={item} me={me} size={60} />
                    </div>
                    <div className="mk-content-copy">
                      <div className="mk-strong">{item.name}</div>
                      <div className="mk-quiet mk-small">{KIND_LABEL[item.kind]}</div>
                    </div>
                    <div className={`mk-edge edge-${item.tier}`} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function CasesSkeleton() {
  return (
    <div className="mk-stack mk-skeleton" aria-hidden="true">
      <div className="mk-skel-row">
        <span style={{ width: 120 }} />
        <span style={{ width: 200 }} />
        <span style={{ width: 200 }} />
      </div>
      <div className="mk-skel-stage">
        <span className="mk-skel-art" />
        <div className="mk-skel-col">
          <span style={{ height: 64 }} />
          <span style={{ height: 48, width: "70%" }} />
          <span style={{ height: 18, width: "50%" }} />
          <span style={{ height: 12 }} />
          <span style={{ height: 50, width: 220 }} />
        </div>
      </div>
    </div>
  );
}
