"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Tier } from "./cosmetics";

const KEY = "planary-market-sound";

function stored() {
  try {
    return window.localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

type Cue = "tick" | "tear" | "land" | "reveal" | "pops" | "drop";

/**
 * The opening's sound cues, all synthesised, nothing to download. Off until the player turns
 * them on; the choice is remembered on this device.
 *
 * The reveal grows with the tier: a pluck for common, a rising arpeggio for rare, a bass note
 * under a fuller one for epic, and for legendary a gong, a fanfare and a shower of sparkles.
 */
export function useMarketSound() {
  const [on, setOn] = useState(() => typeof window !== "undefined" && stored());
  const context = useRef<AudioContext | null>(null);
  const out = useRef<AudioNode | null>(null);
  const noise = useRef<AudioBuffer | null>(null);

  // Every part of the page that makes a sound follows the same switch.
  useEffect(() => {
    const sync = () => setOn(stored());
    window.addEventListener("market-sound", sync);
    return () => window.removeEventListener("market-sound", sync);
  }, []);

  const ctx = useCallback(() => {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!context.current) {
      const ac = new Ctx();
      // One gentle limiter at the end, so stacked notes never clip.
      const limit = ac.createDynamicsCompressor();
      limit.threshold.value = -14;
      limit.ratio.value = 6;
      const master = ac.createGain();
      master.gain.value = 0.9;
      limit.connect(master).connect(ac.destination);
      context.current = ac;
      out.current = limit;
    }
    if (context.current.state === "suspended") void context.current.resume();
    return context.current;
  }, []);

  const tone = useCallback(
    (frequency: number, duration: number, gain: number, type: OscillatorType = "triangle", delay = 0, attack = 0.004) => {
      const ac = ctx();
      if (!ac || !out.current) return;
      const osc = ac.createOscillator();
      const amp = ac.createGain();
      const t = ac.currentTime + delay;
      osc.type = type;
      osc.frequency.value = frequency;
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(gain, t + attack);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);
      osc.connect(amp).connect(out.current);
      osc.start(t);
      osc.stop(t + duration + 0.05);
    },
    [ctx],
  );

  /** A burst of filtered noise: the crack of a firecracker. */
  const crack = useCallback(
    (delay: number, gain: number, pitch: number) => {
      const ac = ctx();
      if (!ac || !out.current) return;
      if (!noise.current) {
        const buffer = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        noise.current = buffer;
      }
      const src = ac.createBufferSource();
      src.buffer = noise.current;
      const band = ac.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = pitch;
      band.Q.value = 0.9;
      const amp = ac.createGain();
      const t = ac.currentTime + delay;
      amp.gain.setValueAtTime(gain, t);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      src.connect(band).connect(amp).connect(out.current);
      src.start(t);
      src.stop(t + 0.12);
    },
    [ctx],
  );

  const play = useCallback(
    (cue: Cue, tier: Tier = "common", pace = 1) => {
      if (!on) return;
      switch (cue) {
        case "tick":
          // A click that climbs and firms up as the strip slows: the last few count.
          tone(900 + (1 - pace) * 1100, 0.035, 0.03 + (1 - pace) * 0.05, "square");
          break;
        case "tear":
          tone(220, 0.12, 0.08, "square");
          break;
        case "land":
          tone(160, 0.18, 0.16, "sine");
          tone(1320, 0.05, 0.05, "triangle");
          break;
        case "reveal":
          if (tier === "common") {
            tone(523, 0.35, 0.09);
            tone(659, 0.4, 0.07, "triangle", 0.07);
          } else if (tier === "rare") {
            [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.6, 0.08, "triangle", i * 0.07));
            tone(2093, 0.5, 0.025, "sine", 0.3);
          } else if (tier === "epic") {
            tone(131, 1.1, 0.16, "sine");
            [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.8, 0.08, "triangle", 0.05 + i * 0.07));
            [2637, 3136].forEach((f, i) => tone(f, 0.5, 0.025, "sine", 0.45 + i * 0.08));
          } else {
            // A gong: a few inharmonic partials with a long tail.
            [110, 163, 232, 311, 424].forEach((f, i) => tone(f, 2.8 - i * 0.3, 0.14 / (i + 1), "sine", 0, 0.01));
            // The fanfare over it.
            [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.9, 0.08, "sawtooth", 0.22 + i * 0.08, 0.01));
            tone(1568, 1.4, 0.06, "triangle", 0.75);
            // Sparkles.
            for (let i = 0; i < 12; i++) tone(2400 + Math.random() * 2200, 0.25, 0.02, "sine", 0.6 + i * 0.09);
          }
          break;
        case "pops":
          // A string of firecrackers: quick cracks, irregular, fading out.
          for (let i = 0, t = 0; i < 16; i++, t += 0.05 + Math.random() * 0.09) crack(t, 0.5 * (1 - i / 22), 1800 + Math.random() * 2400);
          break;
        case "drop":
          // Someone else pulled something big: a short bright chime, quieter than your own.
          [784, 1175].forEach((f, i) => tone(f, 0.4, tier === "legendary" ? 0.06 : 0.04, "triangle", i * 0.09));
          break;
      }
    },
    [on, tone, crack],
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
    window.setTimeout(() => window.dispatchEvent(new Event("market-sound")), 0);
  }, []);

  return { on, toggle, play };
}
