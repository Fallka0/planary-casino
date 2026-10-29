"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import type { Tier } from "./cosmetics";

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
    };
  });

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
                height: Math.round(l.size * 1.53),
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
    { n: phone ? 4 : 8, size: [22, 32], blur: 1.6, opacity: 0.55, rise: [9500, 12000] },
    { n: phone ? 4 : 7, size: [40, 56], blur: 0.4, opacity: 0.85, rise: [8000, 10000] },
    { n: phone ? 3 : 5, size: [64, 92], blur: 0, opacity: 1, rise: [6800, 8600] },
  ];
  const out: { left: number; size: number; blur: number; opacity: number; rise: number; delay: number; dx: number; sway: number; tilt: number; swayFor: number; swayAt: number }[] = [];
  const scale = phone ? 0.7 : 1;
  depths.forEach((d, depth) => {
    for (let i = 0; i < d.n; i++) {
      const leftSide = i % 2 === 0;
      // Within the outer quarter of each side; far ones can sit a little further in.
      const band = phone ? 26 : depth === 0 ? 30 : 24;
      const left = leftSide ? r() * band : 100 - band + r() * band - 6;
      out.push({
        left,
        size: Math.round((d.size[0] + r() * (d.size[1] - d.size[0])) * scale),
        blur: d.blur,
        opacity: d.opacity,
        rise: Math.round(d.rise[0] + r() * (d.rise[1] - d.rise[0])),
        delay: Math.round(depth * 350 + r() * 2600),
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
