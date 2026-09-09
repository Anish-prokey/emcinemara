import type { Comparison, Tile, TileState } from "./types";

/**
 * How close a guess landed, 0-100.
 *
 * This is a *summary of tiles already on screen*, not new information: every
 * input is a square the player can already see, so a patient player with a
 * notepad could derive the same number. It exists because reading eight clue
 * groups and deciding "was that closer than guess 3?" is work, and doing that
 * work in your head is not the fun part of the game.
 *
 * Weights are not uniform because the clues are not equally telling. Sharing a
 * director with the answer narrows the field to a handful of films; sharing the
 * Drama genre narrows it to about half the library. So the weights are roughly
 * "how much would knowing this shrink the search", not "how many pixels the
 * tile occupies".
 */
const W = {
  year: 1.0,
  score: 0.7,
  cert: 0.5,
  runtime: 0.7,
  director: 2.0,
  music: 1.6,
  cast: 2.4,
  genres: 1.1,
} as const;

/** A gold square is worth just under half a green one. */
const NEAR = 0.45;

/**
 * The raw weighted fraction is honest but unreadable: measured against the real
 * library, the median wrong guess scores 11 and the 90th percentile scores 18,
 * so almost every guess would sit at the bottom of the bar and the meter would
 * never appear to move. That is because the three heavyweight clues — director,
 * music, cast — are all-or-nothing for a stranger's film, and they carry 60% of
 * the weight between them.
 *
 * So the displayed number is the raw fraction on a curve. This is a scale
 * change, not a fudge: the curve is strictly increasing, so "warmer" still
 * means genuinely warmer and the ordering of any two guesses is untouched. It
 * only decides how much bar a given amount of progress buys, the same way a
 * decibel scale does.
 */
const CURVE = 0.7;

const value = (s: TileState) => (s === "hit" ? 1 : s === "near" ? NEAR : 0);

/** Averaged over the slots the guess actually has, so a four-name cast and a
 *  five-name cast are scored on the same scale. */
function groupValue(tiles: Tile[]): number {
  if (!tiles.length) return 0;
  return tiles.reduce((sum, t) => sum + value(t.state), 0) / tiles.length;
}

export type Band = {
  key: "frozen" | "cold" | "tepid" | "warm" | "hot" | "burning" | "blazing";
  label: string;
  /** Drives the meter fill and glow. */
  color: string;
};

const BANDS: { min: number; band: Band }[] = [
  { min: 90, band: { key: "blazing", label: "Blazing", color: "#ff3b1f" } },
  { min: 75, band: { key: "burning", label: "Burning", color: "#ff6b1f" } },
  { min: 60, band: { key: "hot", label: "Hot", color: "#ff9d0a" } },
  { min: 45, band: { key: "warm", label: "Warm", color: "#e8b923" } },
  { min: 30, band: { key: "tepid", label: "Lukewarm", color: "#9fb46a" } },
  { min: 15, band: { key: "cold", label: "Cold", color: "#5c9ec7" } },
  { min: 0, band: { key: "frozen", label: "Ice cold", color: "#4a7fa5" } },
];

export function bandFor(heat: number): Band {
  return (BANDS.find((b) => heat >= b.min) ?? BANDS[BANDS.length - 1]).band;
}

/** 0-100. A correct guess is every tile green, so it scores exactly 100. */
export function heatOf(c: Comparison): number {
  let earned = 0;
  let possible = 0;

  const add = (w: number, v: number) => {
    possible += w;
    earned += w * v;
  };

  add(W.year, value(c.year.state));
  add(W.score, value(c.score.state));
  // Certificates and runtimes only exist in some datasets. Leaving them out of
  // the denominator keeps the scale comparable across builds.
  if (c.cert) add(W.cert, value(c.cert.state));
  if (c.runtime) add(W.runtime, value(c.runtime.state));
  add(W.director, value(c.director.state));
  add(W.music, value(c.music.state));
  add(W.cast, groupValue(c.cast));
  add(W.genres, groupValue(c.genres));

  if (possible === 0) return 0;
  // 0 stays 0 and a perfect match stays exactly 100; everything between gets
  // stretched into the range the bar can actually show.
  return Math.round(Math.pow(earned / possible, CURVE) * 100);
}

export type HeatReading = {
  heat: number;
  band: Band;
  /** Points above the best guess *before* this one; null for the first guess. */
  delta: number | null;
  /** True when this guess is the closest the player has been so far. */
  best: boolean;
};

/**
 * Reading for each guess in order. The delta is measured against the best
 * earlier guess rather than the immediately previous one — "warmer than you
 * have ever been" is the signal worth celebrating, and it stops a deliberate
 * throwaway guess from making the next mediocre one look like progress.
 */
export function readings(comparisons: Comparison[]): HeatReading[] {
  let bestSoFar = -1;
  return comparisons.map((c) => {
    const heat = heatOf(c);
    const delta = bestSoFar < 0 ? null : heat - bestSoFar;
    const best = heat > bestSoFar;
    if (best) bestSoFar = heat;
    return { heat, band: bandFor(heat), delta, best };
  });
}
