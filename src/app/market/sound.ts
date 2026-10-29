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
 * The legendary fanfare, about five seconds in a hall, scored like a film's big moment rather
 * than a toy: a cymbal swells up out of nothing into a taiko hit, a tam-tam and a wide chord of
 * low brass and strings in open fifths; an erhu sings a slow phrase over it, one legato line
 * sliding between its notes, in the D gong mode (D E F# A B); a second hit lifts the chord an
 * octave into D major, and a soft guzheng falls away through the tail.
 */
export function fanfare(ac: BaseAudioContext, toDry: AudioNode, toHall: AudioNode) {
  const now = ac.currentTime + 0.02;
  // Its own level: many voices at once, so the whole fanfare sits lower than a single cue.
  const dry = ac.createGain();
  dry.gain.value = 0.5;
  dry.connect(toDry);
  const hall = ac.createGain();
  hall.gain.value = 0.5;
  hall.connect(toHall);
  const send = (node: AudioNode, wet: number) => {
    node.connect(dry);
    const g = ac.createGain();
    g.gain.value = wet;
    node.connect(g).connect(hall);
  };
  const noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const noise = (t: number, len: number) => {
    const n = ac.createBufferSource();
    n.buffer = noiseBuf;
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
    o.stop(t + len);
    return o;
  };
  const filter = (type: BiquadFilterType, f: number, q = 0.7) => {
    const b = ac.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  };

  const D2 = 73.4, A2 = 110, D3 = 146.8, A3 = 220, D4 = 293.7, Fs4 = 370, A4 = 440, B4 = 493.9, D5 = 587.3, E5 = 659.3, Fs5 = 740, A5 = 880;

  /** A cymbal swelling up out of silence, cut off by the hit: the classic lead-in. */
  const swell = (at: number, len: number) => {
    const t = now + at;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + len);
    g.gain.linearRampToValueAtTime(0, t + len + 0.02);
    send(noise(t, len + 0.05).connect(filter("highpass", 3500)).connect(g), 0.6);
  };
  /** Taiko: a deep, heavy drum, its pitch sagging, with the thud of the stick. */
  const taiko = (at: number, gain: number) => {
    const t = now + at;
    const o = osc("sine", 68, t, 1.4);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.5);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.setTargetAtTime(0.0001, t + 0.02, 0.28);
    send(o.connect(g), 0.35);
    const ng = ac.createGain();
    ng.gain.setValueAtTime(gain * 0.5, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    send(noise(t, 0.15).connect(filter("lowpass", 520)).connect(ng), 0.3);
  };
  /** Tam-tam: dark partials that bloom slowly and hang in the hall. */
  const gong = (at: number, gain: number) => {
    const t = now + at;
    [1, 1.52, 2.03, 2.61, 3.27].forEach((m, i) => {
      const o = osc("sine", 58 * m, t, 9);
      o.frequency.exponentialRampToValueAtTime(58 * m * 0.99, t + 4);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain / (1 + i * 0.8), t + 0.08 + i * 0.05);
      g.gain.setTargetAtTime(0.0001, t + 0.2, 1.3 - i * 0.15);
      send(o.connect(g), 0.9);
    });
  };
  /** An ensemble chord: each note three detuned saws, low brass and strings swelling in together. */
  const ensemble = (notes: number[], at: number, len: number, gain: number, bright: number) =>
    notes.forEach((f) =>
      [-11, 0, 11].forEach((cents) => {
        const t = now + at;
        const o = osc("sawtooth", f, t, len + 2);
        o.detune.value = cents;
        const lp = filter("lowpass", 300, 0.5);
        lp.frequency.setValueAtTime(260, t);
        lp.frequency.exponentialRampToValueAtTime(bright, t + 0.45);
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(gain, t + 0.35);
        g.gain.setTargetAtTime(0.0001, t + len * 0.55, len / 3);
        send(o.connect(lp).connect(g), 0.55);
      }),
    );
  /** Erhu: one bowed line, sliding between notes, with a vibrato that blooms on long ones. */
  const erhu = (phrase: [number, number][], at: number, end: number, gain: number) => {
    const t = now + at;
    const o = osc("sawtooth", phrase[0][0], t, end - at + 0.6);
    const o2 = osc("triangle", phrase[0][0], t, end - at + 0.6);
    const vib = osc("sine", 5.4, t, end - at + 0.6);
    const depth = ac.createGain();
    depth.gain.value = 0;
    vib.connect(depth);
    depth.connect(o.frequency);
    depth.connect(o2.frequency);
    phrase.forEach(([f, when], i) => {
      const w = now + when;
      if (i) {
        // A slide into the note, as a finger moves along the string.
        o.frequency.setTargetAtTime(f, w, 0.045);
        o2.frequency.setTargetAtTime(f, w, 0.045);
      }
      depth.gain.setValueAtTime(0, w);
      depth.gain.setTargetAtTime(f * 0.011, w + 0.18, 0.15);
    });
    const body = filter("bandpass", 1150, 0.8);
    const soft = filter("lowpass", 2800, 0.6);
    const mix = ac.createGain();
    mix.gain.value = 0.7;
    o.connect(body).connect(soft).connect(mix);
    o2.connect(mix);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.12);
    g.gain.setValueAtTime(gain, now + end - 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, now + end + 0.5);
    send(mix.connect(g), 0.5);
  };
  /** Guzheng, softly: a warm plucked string. */
  const pluck = (f: number, at: number, gain: number) => {
    const t = now + at;
    const o = osc("sine", f, t, 2);
    const h = osc("triangle", f * 2, t, 1);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.setTargetAtTime(0.0001, t + 0.01, 0.45);
    const gh = ac.createGain();
    gh.gain.setValueAtTime(gain * 0.25, t);
    gh.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    send(o.connect(g), 0.7);
    send(h.connect(gh), 0.7);
  };

  // 1. Out of nothing, a cymbal swells up…
  swell(0, 0.62);
  // 2. …into the hit: taiko, tam-tam, and a wide chord in open fifths.
  taiko(0.62, 0.75);
  gong(0.62, 0.2);
  ensemble([D2, A2, D3, A3, D4], 0.62, 2.1, 0.022, 1500);
  taiko(1.05, 0.4);
  // 3. The erhu sings over it.
  erhu(
    [
      [A4, 0.95],
      [B4, 1.3],
      [D5, 1.5],
      [E5, 2.05],
      [D5, 2.3],
      [A5, 2.75],
    ],
    0.95,
    4.1,
    0.07,
  );
  // 4. The lift: a second hit, the chord an octave up into D major.
  taiko(2.7, 0.7);
  taiko(2.9, 0.35);
  gong(2.72, 0.14);
  ensemble([D3, A3, D4, Fs4, A4, D5, Fs5], 2.72, 2.4, 0.018, 2600);
  // 5. A soft guzheng falls away through the tail.
  [A5, Fs5, E5, D5, B4, A4, Fs4].forEach((f, i) => pluck(f, 3.5 + i * 0.16, 0.05 - i * 0.004));
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
