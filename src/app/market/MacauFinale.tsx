"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Tier } from "./cosmetics";
import { crackAt } from "./sound";

/**
 * The Midnight Macau case ends its own way, and more of it the rarer the pull:
 * rare drifts sakura petals down, epic lets red lanterns rise behind the card as well,
 * and legendary dims the whole screen at the edges and sends red lanterns up both sides of it.
 * Common is left plain, so the others mean something. Placed at random per opening; decoration
 * only, under reduced motion it isn't drawn at all.
 */
export function MacauFinale({ tier, phone }: { tier: Tier; phone: boolean }) {
  const [bits] = useState(() => {
    const r = Math.random;
    const scale = phone ? 0.75 : 1;
    const petals = tier === "rare" ? 16 : tier === "epic" ? 12 : 0;
    const lanterns = tier === "epic" ? 8 : 0;
    return {
      petals: Array.from({ length: petals }, () => ({
        left: r() * 100,
        size: Math.round((12 + r() * 10) * scale),
        delay: Math.round(r() * 1400),
        duration: Math.round(2600 + r() * 1600),
        drift: Math.round((r() * 2 - 1) * 90),
        turn: Math.round(r() * 720 - 360),
      })),
      lanterns: Array.from({ length: lanterns }, (_, i) => ({
        // Spread across the width, never straight behind the middle of the card.
        left: (i / lanterns) * 100 + r() * (100 / lanterns) * 0.6,
        size: Math.round((26 + r() * 18) * scale),
        delay: Math.round(150 + r() * 900),
        duration: Math.round(3400 + r() * 1400),
        sway: Math.round(8 + r() * 14),
      })),
      sky: tier === "legendary" ? sky(phone) : [],
      crackers: tier === "legendary" ? crackers(phone) : [],
    };
  });
  // Each firecracker cracks as it hits the bottom and bursts.
  useEffect(() => {
    if (bits.crackers.length) crackAt(bits.crackers.map((c) => c.delay + c.fall));
  }, [bits]);

  if (tier === "common") return null;
  if (tier === "legendary") {
    // The whole screen, not just the stage: rendered at the end of the page, above everything
    // but the toasts, and gone with the result.
    return createPortal(
      <div className="mk-sky" aria-hidden="true">
        <div className="mk-sky-dim" />
        {bits.sky.map((l, i) => (
          <span
            key={i}
            className="mk-sky-lantern"
            style={
              {
                left: `${l.left}%`,
                width: l.size,
                height: Math.round(l.size * 1.583),
                filter: l.blur ? `blur(${l.blur}px)` : undefined,
                animationDelay: `${l.delay}ms`,
                animationDuration: `${l.rise}ms`,
                "--o": l.opacity,
                "--dx": `${l.dx}px`,
              } as React.CSSProperties
            }
          >
            <span className="mk-sky-sway" style={{ animationDuration: `${l.swayFor}ms`, animationDelay: `${-l.swayAt}ms`, "--sway": `${l.sway}px`, "--tilt": `${l.tilt}deg` } as React.CSSProperties}>
              <span className="mk-sky-body" />
            </span>
          </span>
        ))}
        {bits.crackers.map((c, i) => (
          <span
            key={`c${i}`}
            className="mk-cr"
            style={{ left: `${c.left}%`, "--fall": `${c.fall}ms`, "--at": `${c.delay}ms`, "--spin": `${c.spin}deg`, "--size": `${c.size}px` } as React.CSSProperties}
          >
            <span className="mk-cr-stick" />
            <span className="mk-cr-boom">
              <span className="mk-cr-flash" />
              {c.shreds.map((sh, k) => (
                <span key={k} className="mk-cr-shred" style={{ "--dx": `${sh.dx}px`, "--dy": `${sh.dy}px`, "--r": `${sh.r}deg`, background: sh.gold ? "#f2c14e" : "#d6232f" } as React.CSSProperties} />
              ))}
            </span>
          </span>
        ))}
      </div>,
      document.body,
    );
  }
  return (
    <div className={`mk-finale finale-${tier}`} aria-hidden="true">
      <div className="mk-finale-back">
        {bits.lanterns.map((l, i) => (
          <span
            key={i}
            className="mk-fx-lantern"
            style={
              {
                left: `${l.left}%`,
                width: l.size,
                height: Math.round(l.size * 1.53),
                animationDelay: `${l.delay}ms`,
                animationDuration: `${l.duration}ms`,
                "--sway": `${l.sway}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
      <div className="mk-finale-front">
        {bits.petals.map((p, i) => (
          <span
            key={i}
            className="mk-fx-petal"
            style={
              {
                left: `${p.left}%`,
                width: p.size,
                height: p.size,
                animationDelay: `${p.delay}ms`,
                animationDuration: `${p.duration}ms`,
                "--drift": `${p.drift}px`,
                "--turn": `${p.turn}deg`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Lanterns for the legendary sky: up both sides of the screen, never across the middle where the
 * card is. Three depths, so it doesn't look like one sheet sliding up: far ones small, soft and
 * slow, near ones big, bright and quicker. Released over a few seconds, the near ones a beat late.
 */
function sky(phone: boolean) {
  const r = Math.random;
  const depths = [
    { n: phone ? 4 : 7, size: [50, 72], blur: 2, opacity: 0.6, rise: [6400, 7800] },
    { n: phone ? 3 : 6, size: [96, 130], blur: 0.6, opacity: 0.9, rise: [5200, 6400] },
    { n: phone ? 2 : 4, size: [160, 220], blur: 0, opacity: 1, rise: [4300, 5300] },
  ];
  const out: { left: number; size: number; blur: number; opacity: number; rise: number; delay: number; dx: number; sway: number; tilt: number; swayFor: number; swayAt: number }[] = [];
  const scale = phone ? 0.55 : 1;
  depths.forEach((d, depth) => {
    for (let i = 0; i < d.n; i++) {
      const leftSide = i % 2 === 0;
      // Within the outer quarter of each side; far ones can sit a little further in.
      // Big ones hang partly off the edge, as if passing by close.
      const band = phone ? 24 : depth === 0 ? 28 : 20;
      const left = leftSide ? r() * band - (depth === 2 ? 8 : 0) : 100 - band + r() * band - (depth === 2 ? 4 : 8);
      out.push({
        left,
        size: Math.round((d.size[0] + r() * (d.size[1] - d.size[0])) * scale),
        blur: d.blur,
        opacity: d.opacity,
        rise: Math.round(d.rise[0] + r() * (d.rise[1] - d.rise[0])),
        delay: Math.round(depth * 300 + r() * 2000),
        // Drifting a touch towards the middle as they climb, as warm air does.
        dx: Math.round((leftSide ? 1 : -1) * (20 + r() * 60)),
        sway: Math.round(6 + r() * 14),
        tilt: Math.round(3 + r() * 5),
        swayFor: Math.round(1800 + r() * 1600),
        swayAt: Math.round(r() * 3000),
      });
    }
  });
  return out;
}

/**
 * Firecrackers for the legendary sky: they tumble down from the top, faster as they fall, and
 * burst when they hit the bottom of the screen, a flash and a spray of red and gold paper.
 */
function crackers(phone: boolean) {
  const r = Math.random;
  const n = phone ? 8 : 14;
  return Array.from({ length: n }, (_, i) => ({
    // Across the width, a little thinner in the middle where the card is.
    left: i % 3 === 2 ? 30 + r() * 40 : i % 2 ? 2 + r() * 26 : 72 + r() * 26,
    size: Math.round((phone ? 26 : 38) + r() * (phone ? 10 : 16)),
    delay: Math.round(500 + (i / n) * 2800 + r() * 300),
    fall: Math.round(900 + r() * 500),
    spin: Math.round((r() * 2 - 1) * 540),
    shreds: Array.from({ length: 10 }, (_, k) => {
      const angle = Math.PI + (k / 9) * Math.PI + (r() - 0.5) * 0.3; // upward fan
      const reach = (phone ? 50 : 80) + r() * (phone ? 50 : 90);
      return { dx: Math.round(Math.cos(angle) * reach), dy: Math.round(Math.sin(angle) * reach), r: Math.round(r() * 720 - 360), gold: r() > 0.65 };
    }),
  }));
}
