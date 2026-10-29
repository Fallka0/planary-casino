"use client";

import { useState } from "react";
import type { Tier } from "./cosmetics";

/**
 * The Midnight Macau case ends its own way, and more of it the rarer the pull:
 * rare drifts sakura petals down, epic lets red lanterns rise behind the card as well,
 * and legendary adds a rain of red envelopes and two strings of firecrackers that go off
 * from the bottom up. Common is left plain, so the others mean something. Placed at
 * random per opening; decoration only, under reduced motion it isn't drawn at all.
 */
export function MacauFinale({ tier, phone }: { tier: Tier; phone: boolean }) {
  const [bits] = useState(() => {
    const r = Math.random;
    const scale = phone ? 0.75 : 1;
    const petals = tier === "rare" ? 16 : tier === "epic" ? 12 : tier === "legendary" ? 14 : 0;
    const lanterns = tier === "epic" ? 8 : tier === "legendary" ? 10 : 0;
    const envelopes = tier === "legendary" ? (phone ? 16 : 24) : 0;
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
      envelopes: Array.from({ length: envelopes }, () => ({
        left: r() * 100,
        size: Math.round((20 + r() * 12) * scale),
        delay: Math.round(500 + r() * 1300),
        duration: Math.round(1800 + r() * 1000),
        turn: Math.round(r() * 540 - 270),
        flip: r() > 0.5 ? 1 : -1,
      })),
    };
  });

  if (tier === "common") return null;
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
        {bits.envelopes.map((e, i) => (
          <span
            key={i}
            className="mk-fx-hongbao"
            style={
              {
                left: `${e.left}%`,
                width: e.size,
                height: Math.round(e.size * 1.3),
                animationDelay: `${e.delay}ms`,
                animationDuration: `${e.duration}ms`,
                "--turn": `${e.turn}deg`,
                "--flip": e.flip,
              } as React.CSSProperties
            }
          />
        ))}
        {tier === "legendary"
          ? (["left", "right"] as const).map((side) => (
              <span key={side} className={`mk-fx-cracker is-${side}`}>
                {Array.from({ length: 8 }, (_, i) => (
                  // Bottom to top, the way a string goes off.
                  <span key={i} className="mk-fx-pop" style={{ bottom: `${8 + i * 11}%`, animationDelay: `${650 + i * 110 + (side === "right" ? 55 : 0)}ms` }} />
                ))}
              </span>
            ))
          : null}
      </div>
    </div>
  );
}
