"use client";

import { useCallback, useRef, useState } from "react";
import type { Tier } from "./cosmetics";

const KEY = "planary-market-sound";
const REVEAL: Record<Tier, number[]> = { common: [523], rare: [523, 659], epic: [523, 659, 784], legendary: [523, 659, 784, 1047, 1319] };

function stored() {
  try {
    return window.localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

/** The opening's sound cues. Off until the player turns them on; the choice is remembered on this device. */
export function useMarketSound() {
  const [on, setOn] = useState(() => typeof window !== "undefined" && stored());
  const context = useRef<AudioContext | null>(null);

  const blip = useCallback((frequency: number, duration: number, gain: number, type: OscillatorType = "triangle", delay = 0) => {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    context.current ??= new Ctx();
    const ac = context.current;
    const osc = ac.createOscillator();
    const amp = ac.createGain();
    const t = ac.currentTime + delay;
    osc.type = type;
    osc.frequency.value = frequency;
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(amp).connect(ac.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }, []);

  const play = useCallback(
    (cue: "tick" | "tear" | "land" | "reveal", tier: Tier = "common") => {
      if (!on) return;
      if (cue === "tick") blip(1600, 0.03, 0.04);
      if (cue === "tear") blip(220, 0.12, 0.08, "square");
      if (cue === "land") blip(880, 0.08, 0.06);
      if (cue === "reveal") REVEAL[tier].forEach((f, i) => blip(f, 0.6, 0.06, "triangle", i * 0.09));
    },
    [on, blip],
  );

  const toggle = useCallback(() => {
    setOn((was) => {
      try {
        window.localStorage.setItem(KEY, was ? "off" : "on");
      } catch {
        // Private mode: the choice just doesn't outlive the page.
      }
      return !was;
    });
  }, []);

  return { on, toggle, play };
}
