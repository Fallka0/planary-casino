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
 * The legendary fanfare, under three seconds, in the traditional manner: no Western chords, one
 * melody line and the luogu, the gongs and drum of Chinese opera. The clapper calls it in, the
 * small gong answers with its rising "tai", the big gong lands with its falling "kuang", cymbals
 * on the strong beats; a dizi flute plays a short phrase in the G gong mode (G A C D E) with its
 * grace notes and vibrato, a pipa trembling on the same notes an octave below, and the big gong
 * closes it.
 */
export function fanfare(ac: BaseAudioContext, toDry: AudioNode, toHall: AudioNode) {
  const now = ac.currentTime + 0.02;
  // Its own level: many voices at once, so the whole fanfare sits lower than a single cue.
  const dry = ac.createGain();
  dry.gain.value = 0.45;
  dry.connect(toDry);
  const hall = ac.createGain();
  hall.gain.value = 0.45;
  hall.connect(toHall);
  const send = (node: AudioNode, wet: number) => {
    node.connect(dry);
    const g = ac.createGain();
    g.gain.value = wet;
    node.connect(g).connect(hall);
  };
  const noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
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
  const decay = (t: number, peak: number, tau: number, attack = 0.003) => {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(0.0001, t + attack, tau);
    return g;
  };

  /** Bangu: the hardwood clapper that leads the band, a dry "da". */
  const clap = (at: number, gain: number) => {
    const t = now + at;
    send(noise(t, 0.06).connect(filter("bandpass", 2600, 3)).connect(decay(t, gain, 0.012)), 0.15);
    send(osc("sine", 1850, t, 0.08).connect(decay(t, gain * 0.5, 0.015)), 0.15);
  };
  /** A gong: metal partials whose pitch glides, up for the small gong, down for the big one. */
  const gong = (at: number, base: number, glide: number, gain: number, tau: number) => {
    const t = now + at;
    [1, 1.41, 1.93, 2.48, 3.2].forEach((m, i) => {
      const o = osc("sine", base * m, t, tau * 6);
      o.frequency.setTargetAtTime(base * m * glide, t + 0.02, 0.12);
      send(o.connect(decay(t, gain / (1 + i * 0.7), tau * (1 - i * 0.12), 0.004)), 0.4);
    });
    send(noise(t, 0.3).connect(filter("bandpass", base * 4, 1.2)).connect(decay(t, gain * 0.1, 0.04)), 0.15);
  };
  const xiaoluo = (at: number, gain = 0.16) => gong(at, 690, 1.08, gain, 0.22);
  const daluo = (at: number, gain = 0.3) => gong(at, 170, 0.88, gain, 0.6);
  /** Bo: a pair of cymbals clashed, bright and short. */
  const bo = (at: number, gain: number) => {
    const t = now + at;
    const pk = filter("peaking", 7000, 1);
    pk.gain.value = 6;
    send(noise(t, 0.6).connect(filter("highpass", 4500)).connect(pk).connect(decay(t, gain, 0.1)), 0.12);
  };
  /** Dizi: a bamboo flute, breathy, with vibrato; each note can start from a grace note above. */
  const dizi = (f: number, at: number, len: number, gain: number, grace = 0) => {
    const t = now + at;
    const o = osc("sine", grace || f, t, len + 0.3);
    if (grace) o.frequency.setValueAtTime(f, t + 0.045);
    const o2 = osc("sine", (grace || f) * 2, t, len + 0.3);
    if (grace) o2.frequency.setValueAtTime(f * 2, t + 0.045);
    const vib = osc("sine", 5.8, t, len + 0.3);
    const depth = ac.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(len > 0.3 ? f * 0.014 : f * 0.004, t + Math.min(0.2, len));
    vib.connect(depth);
    depth.connect(o.frequency);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.03);
    g.gain.setValueAtTime(gain, t + len - 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.12);
    const g2 = ac.createGain();
    g2.gain.value = 0.18;
    o.connect(g);
    o2.connect(g2).connect(g);
    // The breath: a little filtered noise riding on the note.
    const breath = ac.createGain();
    breath.gain.value = 0.05;
    noise(t, len + 0.2).connect(filter("bandpass", f * 2, 2)).connect(breath).connect(g);
    send(g, 0.35);
  };
  /** Pipa: tremolo, the same note plucked over and over, very fast. */
  const pipa = (f: number, at: number, len: number, gain: number) => {
    for (let x = 0; x < len; x += 1 / 17) {
      const t = now + at + x;
      const o = osc("triangle", f, t, 0.12);
      send(o.connect(filter("lowpass", 2600)).connect(decay(t, gain * (0.8 + Math.random() * 0.2), 0.03, 0.002)), 0.3);
    }
  };

  // G gong mode: G A C D E.
  const G4 = 392, A4 = 440, C5 = 523.3, D5 = 587.3, E5 = 659.3, G5 = 784, A5 = 880, C6 = 1046.5;

  // 1. The clapper calls the band in: da, da-da.
  clap(0, 0.3);
  clap(0.13, 0.22);
  clap(0.2, 0.3);
  // 2. Small gong answers, tai, tai, then the big gong lands, kuang, with the cymbals.
  xiaoluo(0.3);
  xiaoluo(0.45, 0.12);
  daluo(0.6);
  bo(0.6, 0.045);
  // 3. The dizi's phrase, the pipa trembling under it an octave down.
  const tune: [number, number, number, number][] = [
    // [note, start, length, grace note above]
    [G5, 0.62, 0.17, A5],
    [A5, 0.8, 0.14, 0],
    [C6, 0.95, 0.22, 0],
    [A5, 1.18, 0.12, C6],
    [G5, 1.31, 0.12, 0],
    [E5, 1.44, 0.18, G5],
    [G5, 1.64, 0.7, A5],
  ];
  tune.forEach(([f, at, len, grace]) => {
    dizi(f, at, len, 0.17, grace);
    pipa(f / 2, at, len, 0.045);
  });
  // The luogu keeps time under the tune.
  [0.95, 1.31].forEach((t) => xiaoluo(t, 0.08));
  [0.8, 1.18, 1.44].forEach((t) => clap(t, 0.14));
  // 4. The big gong and cymbals close it.
  daluo(1.64, 0.34);
  bo(1.64, 0.05);
  clap(2.22, 0.2);
  daluo(2.3, 0.22);
  // A pipa sweep down to the root to end on.
  [G5, E5, D5, C5, A4, G4].forEach((f, i) => pipa(f, 2.3 + i * 0.03, 0.03, 0.05));
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
