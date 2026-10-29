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

type Cue = "tick" | "tear" | "land" | "reveal" | "pops" | "hello";

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
 * The legendary sound, "golden reveal", four seconds: a riser sweeps up into an impact and a
 * tam-tam, a warm drone opens under it, bronze bells climb a pentatonic arpeggio (D E G A) and
 * ring out on a high one, with a glitter of small bells in the hall. From 3.5 s everything,
 * the hall's tail included, fades out, silent by 4 s.
 */
export function fanfare(ac: BaseAudioContext, toOut: AudioNode) {
  const t0 = ac.currentTime + 0.03;
  // The fade sits after a hall of its own, so the reverb's tail ends at 4 s too.
  const fade = ac.createGain();
  fade.gain.setValueAtTime(1, t0 + 3.5);
  fade.gain.linearRampToValueAtTime(0, t0 + 4);
  fade.connect(toOut);
  const dry = ac.createGain();
  dry.gain.value = 0.34;
  dry.connect(fade);
  const hallIn = ac.createGain();
  hallIn.gain.value = 0.28;
  hallIn.connect(makeHall(ac, fade));

  const nb = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const send = (node: AudioNode, wet = 0.4) => {
    node.connect(dry);
    const g = ac.createGain();
    g.gain.value = wet;
    node.connect(g).connect(hallIn);
  };
  const noise = (t: number, len: number) => {
    const n = ac.createBufferSource();
    n.buffer = nb;
    n.loop = true;
    n.start(t);
    n.stop(t + len);
    return n;
  };
  const osc = (type: OscillatorType, f: number, t: number, len: number) => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.start(t);
    o.stop(Math.min(t + len, t0 + 4.1));
    return o;
  };
  const filt = (type: BiquadFilterType, f: number, q = 0.7) => {
    const b = ac.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  };
  const env = (t: number, peak: number, tau: number, attack = 0.004) => {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(0.0001, t + attack, tau);
    return g;
  };
  const drive = (amount: number) => {
    const w = ac.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) curve[i] = Math.tanh((i / 511.5 - 1) * amount) / Math.tanh(amount);
    w.curve = curve;
    return w;
  };

  /** A noise sweep and a rising detuned tone, up into the hit. */
  const riser = (at: number, len: number, gain: number) => {
    const t = t0 + at;
    const bp = filt("bandpass", 300, 1.5);
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(7000, t + len);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25 * gain, t + len);
    g.gain.linearRampToValueAtTime(0, t + len + 0.02);
    send(noise(t, len + 0.05).connect(bp).connect(g), 0.6);
    [-15, 0, 15].forEach((cents) => {
      const o = osc("sawtooth", 90, t, len + 0.05);
      o.detune.value = cents;
      o.frequency.exponentialRampToValueAtTime(720, t + len);
      const lp = filt("lowpass", 400);
      lp.frequency.exponentialRampToValueAtTime(5000, t + len);
      const og = ac.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.04 * gain, t + len);
      og.gain.linearRampToValueAtTime(0, t + len + 0.02);
      send(o.connect(lp).connect(og), 0.5);
    });
  };
  /** The impact: a sub drop, a gritty mid thump and the click of the hit. */
  const impact = (at: number, gain: number) => {
    const t = t0 + at;
    const sub = osc("sine", 62, t, 3);
    sub.frequency.exponentialRampToValueAtTime(28, t + 1.4);
    send(sub.connect(env(t, 0.75 * gain, 0.35)), 0.2);
    const mid = osc("sine", 120, t, 1.2);
    mid.frequency.exponentialRampToValueAtTime(55, t + 0.4);
    send(mid.connect(drive(4)).connect(filt("lowpass", 900)).connect(env(t, 0.35 * gain, 0.18)), 0.4);
    send(noise(t, 0.3).connect(filt("lowpass", 4500)).connect(env(t, 0.5 * gain, 0.03, 0.001)), 0.5);
  };
  /** A tam-tam, blooming slowly. */
  const gong = (at: number, gain: number, base: number) => {
    const t = t0 + at;
    [1, 1.52, 2.03, 2.61, 3.27, 4.1].forEach((m, i) => {
      const o = osc("sine", base * m, t, 8);
      o.frequency.exponentialRampToValueAtTime(base * m * 0.99, t + 5);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime((0.22 * gain) / (1 + i * 0.3), t + 0.12 + i * 0.06);
      g.gain.setTargetAtTime(0.0001, t + 0.3, 1.5 - i * 0.18);
      send(o.connect(g), 0.9);
    });
    send(noise(t, 2).connect(filt("bandpass", 1200, 0.6)).connect(env(t, 0.05 * gain, 0.5, 0.15)), 0.9);
  };
  /** A bronze bell: inharmonic partials, struck. */
  const bell = (f: number, at: number, gain: number) => {
    const t = t0 + at;
    ([
      [0.5, 0.35, 3],
      [1, 1, 2.4],
      [2, 0.5, 1.4],
      [2.76, 0.4, 1],
      [5.4, 0.2, 0.5],
      [8.9, 0.1, 0.25],
    ] as const).forEach(([m, a, tau]) => send(osc("sine", f * m, t, tau * 6).connect(env(t, 0.13 * gain * a, tau, 0.002)), 0.7));
    send(noise(t, 0.05).connect(filt("bandpass", f * 3, 2)).connect(env(t, 0.06 * gain, 0.01, 0.001)), 0.5);
  };
  /** A warm drone of detuned saws opening from dark to bright. */
  const pad = (notes: number[], at: number, len: number, gain: number, bright: number) =>
    notes.forEach((f) =>
      [-12, 0, 12].forEach((cents) => {
        const t = t0 + at;
        const o = osc("sawtooth", f, t, len + 3);
        o.detune.value = cents;
        const lp = filt("lowpass", 250, 0.5);
        lp.frequency.setValueAtTime(250, t);
        lp.frequency.exponentialRampToValueAtTime(bright, t + 0.6);
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.5);
        g.gain.setTargetAtTime(0.0001, t + len * 0.6, len / 3);
        send(o.connect(lp).connect(g), 0.6);
      }),
    );
  /** Small bells glittering high in the hall. */
  const shimmer = (at: number, len: number, notes: number[], gain: number) => {
    for (let i = 0; i < len * 10; i++) {
      const f = notes[Math.floor(Math.random() * notes.length)] * (Math.random() > 0.5 ? 2 : 4);
      const t = t0 + at + i * 0.1 + Math.random() * 0.05;
      send(osc("sine", f, t, 1.5).connect(env(t, gain * (1 - i / (len * 10)), 0.35, 0.003)), 0.9);
    }
  };

  riser(0, 0.7, 0.7);
  impact(0.7, 0.9);
  gong(0.72, 0.7, 60);
  pad([73.4, 110, 146.8, 220], 0.7, 2.6, 0.016, 1800);
  [587, 659, 784, 880, 1175, 1319, 1568].forEach((f, i) => bell(f, 0.85 + i * 0.12, 0.55));
  bell(1760, 1.75, 0.9);
  shimmer(1.9, 1.6, [1175, 1319, 1568, 1760], 0.015);
}

/**
 * Firecracker bursts at the given times from now (in ms), each a quick crack and a couple of
 * smaller ones after it, heard only when the case sounds are on.
 */
export function crackAt(times: number[]) {
  if (!stored()) return;
  const a = audio();
  if (!a) return;
  const { ac, out } = a;
  const buf = ac.createBuffer(1, ac.sampleRate * 0.3, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const crack = (t: number, gain: number, pitch: number) => {
    const src = ac.createBufferSource();
    src.buffer = buf;
    const band = ac.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = pitch;
    band.Q.value = 0.8;
    const amp = ac.createGain();
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    src.connect(band).connect(amp).connect(out);
    src.start(t);
    src.stop(t + 0.1);
    // A low thump under the crack, for weight.
    const o = ac.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.1);
    const g = ac.createGain();
    g.gain.setValueAtTime(gain * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.14);
  };
  const t0 = ac.currentTime;
  times.forEach((ms) => {
    const t = t0 + ms / 1000;
    crack(t, 0.32, 1800 + Math.random() * 1600);
    crack(t + 0.06 + Math.random() * 0.04, 0.16, 2600 + Math.random() * 2000);
    if (Math.random() > 0.4) crack(t + 0.13 + Math.random() * 0.06, 0.1, 3000 + Math.random() * 2000);
  });
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
    if (a) fanfare(a.ac, a.out);
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
