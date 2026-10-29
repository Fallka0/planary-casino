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

type Cue = "tick" | "tear" | "land" | "reveal" | "pops" | "drop" | "hello";

/** A hall: a reverb made from decaying noise, for the cues that should sound big. */
export function makeHall(ac: BaseAudioContext, out: AudioNode) {
  const hall = ac.createConvolver();
  const len = Math.round(ac.sampleRate * 3.2);
  const ir = ac.createBuffer(2, len, ac.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  hall.buffer = ir;
  const wet = ac.createGain();
  wet.gain.value = 0.55;
  hall.connect(wet).connect(out);
  return hall;
}

// One audio context for the whole page. Browsers only let it play once it has been started from a
// click, so `unlock` runs inside the click handlers (the sound switch, the Open button); a context
// first made later, from a timer, can stay silent.
let shared: { ac: AudioContext; out: AudioNode; hall: AudioNode } | null = null;
function audio() {
  if (typeof window === "undefined") return null;
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!shared) {
    const ac = new Ctx();
    // A limiter at the end, so stacked notes never clip, and a master gain after it.
    const limit = ac.createDynamicsCompressor();
    limit.threshold.value = -10;
    limit.ratio.value = 5;
    const master = ac.createGain();
    master.gain.value = 1.8;
    limit.connect(master).connect(ac.destination);
    shared = { ac, out: limit, hall: makeHall(ac, limit) };
  }
  if (shared.ac.state !== "running") void shared.ac.resume().catch(() => {});
  return shared;
}
/**
 * The legendary fanfare, about four seconds in a hall: a deep boom and a gong, a brass chord
 * that swells open, a pentatonic run climbing two octaves on bells, then the full chord again,
 * brighter, with a timpani roll under it and bells glittering down through the tail.
 */
export function fanfare(ac: BaseAudioContext, toDry: AudioNode, toHall: AudioNode) {
  const now = ac.currentTime + 0.02;
  // Its own level: many voices at once, so the whole fanfare sits lower than a single cue.
  const dry = ac.createGain();
  dry.gain.value = 0.42;
  dry.connect(toDry);
  const hall = ac.createGain();
  hall.gain.value = 0.42;
  hall.connect(toHall);
  const voice = (
    f: number,
    at: number,
    dur: number,
    gain: number,
    { type = "sine" as OscillatorType, attack = 0.01, wet = 0.4, open = 0, detune = 0, glide = 0 } = {},
  ) => {
    const t = now + at;
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (glide) osc.frequency.exponentialRampToValueAtTime(f * glide, t + dur * 0.6);
    osc.detune.value = detune;
    const amp = ac.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + attack);
    amp.gain.setTargetAtTime(0.0001, t + attack + dur * 0.35, dur / 3.2);
    let node: AudioNode = osc;
    if (open) {
      // Brass: a low-pass that opens as the note swells.
      const lp = ac.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 1.2;
      lp.frequency.setValueAtTime(300, t);
      lp.frequency.exponentialRampToValueAtTime(open, t + attack + 0.25);
      lp.frequency.setTargetAtTime(open * 0.4, t + attack + 0.4, dur / 2);
      node = osc.connect(lp);
    }
    node.connect(amp);
    amp.connect(dry);
    const send = ac.createGain();
    send.gain.value = wet;
    amp.connect(send).connect(hall);
    osc.start(t);
    osc.stop(t + dur + 1.5);
  };
  const bell = (f: number, at: number, gain: number, dur = 1.6) => {
    voice(f, at, dur, gain, { attack: 0.004, wet: 0.6 });
    voice(f * 2.76, at, dur * 0.4, gain * 0.35, { attack: 0.003, wet: 0.6 });
    voice(f * 5.4, at, dur * 0.2, gain * 0.15, { attack: 0.002, wet: 0.6 });
  };
  const brass = (notes: number[], at: number, dur: number, gain: number, open: number) =>
    notes.forEach((f) => {
      voice(f, at, dur, gain, { type: "sawtooth", attack: 0.16, open, wet: 0.45, detune: -7 });
      voice(f, at, dur, gain, { type: "sawtooth", attack: 0.16, open, wet: 0.45, detune: 7 });
    });

  // 1. The boom: a sub drop and a gong.
  voice(92, 0, 1.6, 0.5, { glide: 0.5, attack: 0.008, wet: 0.3 });
  [98, 147, 209, 280, 381].forEach((f, i) => voice(f, 0.02, 3.4 - i * 0.4, 0.16 / (i + 1), { attack: 0.012, wet: 0.7 }));
  // 2. The first chord swells open (C major with the ninth, voiced wide).
  brass([131, 196, 262, 330, 392, 587], 0.12, 1.3, 0.045, 2600);
  // 3. A pentatonic run up two octaves on bells: C D E G A.
  [523, 587, 659, 784, 880, 1047, 1175, 1319, 1568, 1760, 2093].forEach((f, i) => bell(f, 0.55 + i * 0.055, 0.05, 0.9));
  // 4. Timpani roll into the arrival.
  for (let i = 0; i < 10; i++) voice(98, 0.95 + i * 0.045, 0.25, 0.05 + i * 0.012, { glide: 0.8, attack: 0.004, wet: 0.35 });
  // 5. The arrival: the full chord, higher and brighter, with the root deep under it.
  brass([65, 131, 196, 262, 330, 392, 523, 659, 784], 1.42, 2.6, 0.05, 5200);
  voice(1047, 1.42, 2.4, 0.07, { type: "triangle", attack: 0.03, wet: 0.6 });
  voice(65, 1.42, 1.4, 0.35, { glide: 0.7, attack: 0.006, wet: 0.3 });
  // 6. Bells glittering down through the tail, pentatonic, so every one belongs.
  const glitter = [2093, 1760, 2349, 1568, 2637, 1319, 2093, 1760, 3136, 2637, 2349, 1568];
  glitter.forEach((f, i) => bell(f, 1.75 + i * 0.13 + Math.random() * 0.05, 0.03 + Math.random() * 0.015, 1.2));
}

/** Call from inside a click: starts the page's audio so later cues are heard. */
export function unlockSound() {
  const a = audio();
  if (!a) return;
  // A silent blip, which some browsers need before they'll play anything.
  const osc = a.ac.createOscillator();
  const amp = a.ac.createGain();
  amp.gain.value = 0;
  osc.connect(amp).connect(a.out);
  osc.start();
  osc.stop(a.ac.currentTime + 0.01);
}

/**
 * The opening's sound cues, all synthesised, nothing to download. Off until the player turns
 * them on; the choice is remembered on this device.
 *
 * The reveal grows with the tier: a pluck for common, a rising arpeggio for rare, a bass note
 * under a fuller one for epic, and for legendary a gong, a fanfare and a shower of sparkles.
 */
export function useMarketSound() {
  const [on, setOn] = useState(() => typeof window !== "undefined" && stored());
  const out = useRef<AudioNode | null>(null);
  const noise = useRef<AudioBuffer | null>(null);

  // Every part of the page that makes a sound follows the same switch.
  useEffect(() => {
    const sync = () => setOn(stored());
    window.addEventListener("market-sound", sync);
    return () => window.removeEventListener("market-sound", sync);
  }, []);

  const ctx = useCallback(() => {
    const a = audio();
    if (!a) return null;
    out.current = a.out;
    return a.ac;
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

  const legendary = useCallback(() => {
    const a = audio();
    if (a) fanfare(a.ac, a.out, a.hall);
  }, []);

  const play = useCallback(
    (cue: Cue, tier: Tier = "common", pace = 1) => {
      if (!on) return;
      switch (cue) {
        case "tick":
          // A click that climbs and firms up as the strip slows: the last few count.
          tone(900 + (1 - pace) * 1100, 0.04, 0.06 + (1 - pace) * 0.08, "square");
          break;
        case "hello":
          // Sound just switched on: a short two-note chime, so you know it works.
          tone(784, 0.25, 0.12, "triangle");
          tone(1175, 0.35, 0.1, "triangle", 0.1);
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
            legendary();
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
    [on, tone, crack, legendary],
  );

  const toggle = useCallback(() => {
    const next = !on;
    try {
      window.localStorage.setItem(KEY, next ? "on" : "off");
    } catch {
      // Private mode: the choice just doesn't outlive the page.
    }
    setOn(next);
    if (next) {
      // We're inside the click: start the audio now and say hello.
      unlockSound();
      window.setTimeout(() => {
        const a = audio();
        if (!a) return;
        out.current = a.out;
        const t = a.ac.currentTime;
        [784, 1175].forEach((f, i) => {
          const osc = a.ac.createOscillator();
          const amp = a.ac.createGain();
          osc.type = "triangle";
          osc.frequency.value = f;
          amp.gain.setValueAtTime(0.0001, t + i * 0.1);
          amp.gain.exponentialRampToValueAtTime(0.12, t + i * 0.1 + 0.01);
          amp.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.1 + 0.35);
          osc.connect(amp).connect(a.out);
          osc.start(t + i * 0.1);
          osc.stop(t + i * 0.1 + 0.4);
        });
      }, 30);
    }
    window.setTimeout(() => window.dispatchEvent(new Event("market-sound")), 0);
  }, [on]);

  return { on, toggle, play };
}
