"use client";

import { useEffect, useRef } from "react";

/**
 * A case as an admit-one ticket: three inks, a motif on the left, the stub on
 * the right. Opening it rocks the ticket, zips the perforation and tears the
 * stub away; the reel takes over after that.
 */
const TICKETS: Record<string, { word: string; no: string; glyph: string }> = {
  classic: { word: "Classic", no: "No.01", glyph: "7" },
  afterhours: { word: "After hours", no: "No.02", glyph: "" },
  boardwalk: { word: "Boardwalk", no: "No.03", glyph: "" },
};

export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function CaseArt({ caseId, play = 0, idle = true, small = false }: { caseId: string; play?: number; idle?: boolean; small?: boolean }) {
  const ticket = TICKETS[caseId] ?? TICKETS.classic;
  const shake = useRef<HTMLDivElement>(null);
  const main = useRef<HTMLDivElement>(null);
  const stub = useRef<HTMLDivElement>(null);
  const perf = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!play || reducedMotion()) return;
    const run: Animation[] = [];
    const go = (el: HTMLElement | null, frames: Keyframe[], options: KeyframeAnimationOptions) => el && run.push(el.animate(frames, { fill: "forwards", ...options }));
    go(shake.current, [{ rotate: "0deg" }, { rotate: "-3deg" }, { rotate: "3deg" }, { rotate: "-2deg" }, { rotate: "1.5deg" }, { rotate: "0deg" }], {
      duration: 480,
      easing: "cubic-bezier(.36,.07,.19,.97)",
    });
    go(perf.current, [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], { duration: 300, delay: 480, easing: "cubic-bezier(.4,0,.2,1)" });
    go(
      stub.current,
      [
        { transform: "none", opacity: 1 },
        { transform: "translate(4%, 2%) rotate(5deg)", opacity: 1, offset: 0.3 },
        { transform: "translate(40%, 90%) rotate(28deg)", opacity: 0 },
      ],
      { duration: 520, delay: 780, easing: "cubic-bezier(.5,0,.75,0)" },
    );
    go(main.current, [{ transform: "none" }, { transform: "translateX(-3%)", offset: 0.35 }, { transform: "none" }], {
      duration: 420,
      delay: 780,
      easing: "cubic-bezier(.34,1.56,.64,1)",
    });
    return () => run.forEach((a) => a.cancel());
  }, [play]);

  return (
    <div className={`mk-ticket-wrap${small ? " is-small" : ""}`} aria-hidden="true">
      <div ref={shake} className={`mk-ticket-sway${idle && !play ? " is-idle" : ""}`}>
        <div className={`mk-ticket mk-ticket-${TICKETS[caseId] ? caseId : "classic"}`}>
          <div ref={main} className="mk-ticket-main">
            <div className="mk-ticket-motif" />
            {ticket.glyph ? <div className="mk-ticket-glyph">{ticket.glyph}</div> : null}
            <div className="mk-ticket-no">Planary · {ticket.no}</div>
            <div className={`mk-ticket-word${ticket.word.length > 8 ? " is-long" : ""}`}>{ticket.word}</div>
            <div className="mk-ticket-rule" />
            <span className="mk-notch is-tr" />
            <span className="mk-notch is-br" />
          </div>
          <div ref={stub} className="mk-ticket-stub">
            <div ref={perf} className="mk-ticket-perf" />
            <div className="mk-ticket-admit">Admit one</div>
            <span className="mk-notch is-tl" />
            <span className="mk-notch is-bl" />
          </div>
        </div>
      </div>
    </div>
  );
}
