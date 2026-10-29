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
 * The legendary fanfare, about four and a half seconds in a hall, in the Chinese festival manner
 * and the D gong mode (D E F# A B): a tam-tam, a big drum and a cymbal crash; a guzheng sweep up
 * two and a half octaves; the drums and small cymbals stepping in; a suona singing the tune over
 * a brass chord, sliding into its notes with vibrato; then the gong, a drum roll and the crash
 * again for the arrival, and the guzheng shimmering back down through the tail.
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
  const send = (node: AudioNode, wet: number) => {
    node.connect(dry);
    const g = ac.createGain();
    g.gain.value = wet;
    node.connect(g).connect(hall);
  };
  const env = (t: number, attack: number, peak: number, decay: number) => {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(0.0001, t + attack, decay);
    return g;
  };
  const noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const osc = (type: OscillatorType, f: number, t: number, stop: number) => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.start(t);
    o.stop(t + stop);
    return o;
  };

  // Pitches, D gong mode.
  const D3 = 146.8, A3 = 220, D4 = 293.7, E4 = 329.6, Fs4 = 370, A4 = 440, B4 = 493.9;
  const scale = [D4, E4, Fs4, A4, B4];
  const note = (step: number) => scale[((step % 5) + 5) % 5] * Math.pow(2, Math.floor(step / 5));

  /** Tam-tam: inharmonic partials that bloom, then a long shimmering tail. */
  const gong = (at: number, size: number) => {
    const t = now + at;
    [1, 1.47, 1.97, 2.53, 3.11, 3.92, 4.8].forEach((m, i) => {
      const o = osc("sine", 72 * m, t, 5);
      o.frequency.exponentialRampToValueAtTime(72 * m * 0.985, t + 3);
      const g = env(t, 0.02 + i * 0.02, (0.22 * size) / (1 + i * 0.6), 1.2 - i * 0.08);
      send(o.connect(g), 0.8);
    });
    const n = ac.createBufferSource();
    n.buffer = noiseBuf;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 900;
    bp.Q.value = 0.7;
    const g = env(t, 0.01, 0.035 * size, 0.3);
    send(n.connect(bp).connect(g), 0.5);
    n.start(t);
    n.stop(t + 2);
  };
  /** Dagu: a big barrel drum, a thump that drops in pitch, with a skin slap on top. */
  const drum = (at: number, gain: number, f = 110) => {
    const t = now + at;
    const o = osc("sine", f, t, 0.8);
    o.frequency.exponentialRampToValueAtTime(f * 0.45, t + 0.25);
    send(o.connect(env(t, 0.004, gain, 0.12)), 0.35);
    const n = ac.createBufferSource();
    n.buffer = noiseBuf;
    const lp = ac.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    send(n.connect(lp).connect(env(t, 0.002, gain * 0.35, 0.03)), 0.3);
    n.start(t);
    n.stop(t + 0.2);
  };
  /** Bo / nao: a bright cymbal crash (big) or a small hand cymbal (small). */
  const cymbal = (at: number, gain: number, big: boolean) => {
    const t = now + at;
    const n = ac.createBufferSource();
    n.buffer = noiseBuf;
    const hp = ac.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = big ? 3200 : 5200;
    const peak = ac.createBiquadFilter();
    peak.type = "peaking";
    peak.frequency.value = big ? 6500 : 8000;
    peak.gain.value = 8;
    send(n.connect(hp).connect(peak).connect(env(t, 0.003, gain, big ? 0.32 : 0.06)), 0.35);
    n.start(t);
    n.stop(t + (big ? 2 : 0.4));
  };
  /** Guzheng pluck: a bright string, quick attack, a little bend down at the start. */
  const pluck = (f: number, at: number, gain: number, len = 0.9) => {
    const t = now + at;
    const o = osc("triangle", f * 1.01, t, len + 0.5);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    send(o.connect(env(t, 0.003, gain, len / 4)), 0.55);
    const h = osc("sine", f * 2, t, len);
    send(h.connect(env(t, 0.002, gain * 0.4, len / 7)), 0.55);
  };
  /** Suona: a reedy, nasal horn; slides up into each note and sings with vibrato. */
  const suona = (f: number, at: number, dur: number, gain: number, slide = 0.94) => {
    const t = now + at;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.04);
    g.gain.setValueAtTime(gain, t + dur - 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12);
    const vib = osc("sine", 6.2, t, dur + 0.3);
    const depth = ac.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.25, dur * 0.6));
    vib.connect(depth);
    const nasal = ac.createBiquadFilter();
    nasal.type = "bandpass";
    nasal.frequency.value = 1700;
    nasal.Q.value = 1.4;
    const body = ac.createBiquadFilter();
    body.type = "lowpass";
    body.frequency.value = 4200;
    ["sawtooth", "square"].forEach((type, i) => {
      const o = osc(type as OscillatorType, f * slide, t, dur + 0.3);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
      o.detune.value = i ? 6 : -4;
      depth.connect(o.frequency);
      o.connect(i ? nasal : body);
    });
    const mix = ac.createGain();
    mix.gain.value = 0.6;
    nasal.connect(mix);
    body.connect(mix);
    send(mix.connect(g), 0.45);
  };
  /** A warm brass pad under the tune. */
  const pad = (notes: number[], at: number, dur: number, gain: number) =>
    notes.forEach((f, i) => {
      const t = now + at;
      const o = osc("sawtooth", f, t, dur + 1.5);
      o.detune.value = i % 2 ? 7 : -7;
      const lp = ac.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.setValueAtTime(400, t);
      lp.frequency.exponentialRampToValueAtTime(2400, t + 0.35);
      send(o.connect(lp).connect(env(t, 0.25, gain, dur / 2.5)), 0.5);
    });

  // 1. The opening blow: tam-tam, a big drum and a crash.
  gong(0, 1);
  drum(0, 0.6, 95);
  cymbal(0.01, 0.05, true);
  // 2. The guzheng sweeps up two and a half octaves.
  for (let i = 0; i < 13; i++) pluck(note(i - 5), 0.12 + i * 0.038, 0.1 + i * 0.004, 0.7);
  // 3. Drums and small cymbals step in: dong, dong, dong-dong, dong.
  [0.72, 1.0, 1.21, 1.31, 1.52].forEach((t, i) => {
    drum(t, i === 4 ? 0.5 : 0.36, i === 4 ? 100 : 125);
    cymbal(t + 0.005, 0.018, false);
  });
  // 4. A brass chord opens under the suona's tune.
  pad([D3, A3, D4, Fs4, A4], 0.7, 2.6, 0.03);
  const tune: [number, number, number][] = [
    // [step, start, length]: a festive call that climbs and lands on the high tonic.
    [8, 0.72, 0.22],
    [9, 0.95, 0.18],
    [10, 1.14, 0.5],
    [9, 1.66, 0.16],
    [8, 1.83, 0.16],
    [6, 2.0, 0.22],
    [8, 2.24, 0.24],
    [10, 2.5, 0.9],
  ];
  tune.forEach(([step, at, len], i) => suona(note(step), at, len, 0.11, i === 2 || i === 7 ? 0.89 : 0.95));
  // 5. The arrival: gong again, a drum roll into it, the crash, the chord a register higher.
  for (let i = 0; i < 9; i++) drum(2.12 + i * 0.042, 0.12 + i * 0.03, 140);
  gong(2.5, 1.1);
  drum(2.5, 0.65, 90);
  cymbal(2.51, 0.055, true);
  pad([D3, D4, A4, D4 * 2, Fs4 * 2], 2.5, 2.4, 0.032);
  // 6. The guzheng shimmers back down through the tail.
  for (let i = 0; i < 14; i++) pluck(note(14 - i), 2.75 + i * 0.07, 0.08 - i * 0.003, 1.1);
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
