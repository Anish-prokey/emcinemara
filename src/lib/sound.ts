/**
 * Every sound in the game, synthesised on the fly.
 *
 * No audio files: the whole kit is a few oscillators and gain envelopes, which
 * keeps the bundle flat, needs no CDN for a host's CSP to block, and lets the
 * pitch of a cue be computed from the thing it is reporting — the verdict sweep
 * literally rises with how close you landed, so you hear the result before you
 * finish reading it.
 *
 * Nothing in here is allowed to break the game. Audio is a garnish: every entry
 * point swallows its own errors, and a browser with no Web Audio just stays
 * quiet.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.34;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
  return ctx;
}

/**
 * Browsers refuse to start audio until the user has interacted with the page,
 * and a context created before that starts life suspended. Called from the
 * first real gesture.
 */
export function unlock() {
  try {
    const c = audio();
    if (c && c.state === "suspended") void c.resume();
  } catch {
    /* stays silent */
  }
}

export function setMuted(v: boolean) {
  muted = v;
}

export const isMuted = () => muted;

type ToneOpts = {
  freq: number;
  /** Seconds. */
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  /** Seconds from now. */
  at?: number;
  /** Glide to this frequency across the note. */
  to?: number;
};

function tone({ freq, dur = 0.12, type = "sine", gain = 0.5, at = 0, to }: ToneOpts) {
  const c = audio();
  if (!c || muted) return;
  try {
    const t0 = c.currentTime + at;
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);

    // A tiny attack instead of an instant jump — square-edged gain changes
    // click audibly on most speakers.
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(env).connect(master!);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    /* stays silent */
  }
}

/** Short filtered noise — used for the physical "thunk" of locking a guess. */
function thud(gain = 0.35, at = 0) {
  const c = audio();
  if (!c || muted) return;
  try {
    const t0 = c.currentTime + at;
    const len = Math.floor(c.sampleRate * 0.14);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;

    const src = c.createBufferSource();
    src.buffer = buf;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 420;
    const env = c.createGain();
    env.gain.value = gain;
    src.connect(lp).connect(env).connect(master!);
    src.start(t0);
  } catch {
    /* stays silent */
  }
}

/* ---------------- the kit ---------------- */

/** Moving through the search results. */
export const blip = () => tone({ freq: 780, dur: 0.045, type: "square", gain: 0.1 });

/** Committing to a guess: a physical clunk, like a lever being pulled. */
export function submit() {
  thud(0.4);
  tone({ freq: 180, dur: 0.13, type: "triangle", gain: 0.3, to: 120 });
}

/** One tile turning over. Pitch carries the result, so a run of greens
 *  audibly climbs while a run of greys sits flat and low. */
export function reveal(state: "hit" | "near" | "miss", i: number, at: number) {
  const base = state === "hit" ? 660 : state === "near" ? 495 : 300;
  tone({
    freq: base + (state === "miss" ? 0 : i * 26),
    dur: state === "miss" ? 0.05 : 0.075,
    type: state === "miss" ? "sine" : "triangle",
    gain: state === "miss" ? 0.11 : 0.2,
    at,
  });
}

/**
 * The verdict sweep, played once the tiles have settled: a rise whose landing
 * pitch is the heat score. Ice cold lands under the starting note and sounds
 * like a shrug; blazing lands an octave and a half up and sounds like a
 * question about to be answered.
 */
export function verdict(heat: number, at = 0) {
  const top = 240 * Math.pow(2, (heat / 100) * 1.9);
  tone({ freq: 220, to: top, dur: 0.3, type: "sine", gain: 0.24, at });
}

/** Beating your own best — the little "warmer!" reward. */
export function warmer(at = 0) {
  tone({ freq: 880, dur: 0.09, type: "triangle", gain: 0.26, at });
  tone({ freq: 1318.5, dur: 0.13, type: "triangle", gain: 0.24, at: at + 0.075 });
}

/** Down to the last couple of guesses: a low pulse under the board. */
export function tension(at = 0) {
  tone({ freq: 98, dur: 0.5, type: "sine", gain: 0.3, at });
  tone({ freq: 147, dur: 0.4, type: "sine", gain: 0.14, at: at + 0.06 });
}

const MAJOR = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98];

/**
 * The win. `reach` (0-1) scales how far up the arpeggio runs, so a one-guess
 * solve gets the full flourish and a tenth-guess scrape gets a modest one —
 * the sound rewards the margin, not just the result.
 */
export function win(reach = 1) {
  const notes = Math.max(3, Math.round(MAJOR.length * reach));
  for (let i = 0; i < notes; i++) {
    tone({ freq: MAJOR[i], dur: 0.42, type: "triangle", gain: 0.3, at: i * 0.075 });
  }
  // A fifth under the top note, to give the chord some floor.
  tone({ freq: 261.63, dur: 0.7, type: "sine", gain: 0.22, at: notes * 0.075 });
  tone({ freq: 392, dur: 0.7, type: "sine", gain: 0.16, at: notes * 0.075 });
}

/** Out of guesses: the projector stopping. */
export function lose() {
  thud(0.4);
  tone({ freq: 320, to: 110, dur: 0.75, type: "triangle", gain: 0.28 });
  tone({ freq: 214, to: 82, dur: 0.8, type: "sine", gain: 0.2, at: 0.05 });
}

/** A streak crossing a milestone, stacked on top of the win fanfare. */
export function milestone() {
  [1046.5, 1318.51, 1567.98, 2093].forEach((f, i) =>
    tone({ freq: f, dur: 0.5, type: "sine", gain: 0.2, at: 0.5 + i * 0.09 }),
  );
}
