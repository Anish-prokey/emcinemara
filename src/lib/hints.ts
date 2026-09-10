import type { Movie, GameState } from "./types";
import { MAX_GUESSES } from "./puzzle";

/**
 * Hints, for when the metadata runs out.
 *
 * Every clue the board gives is metadata — year, rating, cast, genre. Once a
 * few guesses have come back grey there is often nothing left to reason from,
 * and the game stops being a puzzle and starts being a list. Both hints work in
 * a different register: one is visual, one is prose. Neither is ever forced on
 * anyone — they are taken, and taking one is recorded on the result.
 */

/** Guesses that must be used before each hint can be taken. */
export const FRAME_AT = 4;
export const PLOT_AT = 7;

/**
 * The floor is set by the same complaint that moved it last time: an opening
 * step you cannot reason from is a wasted guess. 12 was a blur. 18 already
 * shows a figure and a palette on a poster, which is dense artwork to begin
 * with, so every step from here is worth something.
 */
const COARSEST = 18;

/**
 * The ceiling exists because the image is the poster, and posters carry the
 * title. Measured on real artwork: at 30 the title is a shape, at 34 it is
 * still unreadable blocks, and by 38 the letters start to resolve. So the scale
 * stops at 34 and the title never becomes legible while the board is live.
 */
const FINEST = 34;

/**
 * How coarse the poster is at each step, in pixels across.
 *
 * The hint used to use TMDB's backdrop - a "still from the film". Two problems.
 * It was not curated: TMDB's default backdrop is its top-voted one only 70% of
 * the time, 27% have no votes at all, and the whole population is 0-7 votes, so
 * the choice was effectively arbitrary. And it was the weaker image anyway: a
 * poster is portrait, so at the same width it carries half again as many
 * pixels, and it is drawn to be legible as a thumbnail, which is exactly the
 * problem here. Side by side at 24px the poster reads as a face or a figure
 * while the backdrop is a smear.
 *
 * The scale still has one step for the guess that unlocks it and one for every
 * guess after, so it is improving right up to the last one.
 */
export const SHARPNESS: readonly number[] = (() => {
  const steps = Math.max(2, MAX_GUESSES - FRAME_AT + 1);
  const ratio = Math.pow(FINEST / COARSEST, 1 / (steps - 1));
  return Array.from({ length: steps }, (_, i) => Math.round(COARSEST * Math.pow(ratio, i)));
})();

export type Hints = {
  /** Guesses used at the moment the frame was taken; absent if never taken. */
  frameAt?: number;
  plotAt?: number;
};

export const hintsOf = (g: GameState): Hints => g.hints ?? {};

export type HintView = {
  frameOffered: boolean;
  plotOffered: boolean;
  frameTaken: boolean;
  plotTaken: boolean;
  /** Index into SHARPNESS. Grows with every guess after the frame was taken. */
  sharpness: number;
  /** Guesses still to go before the next hint unlocks; null when one is ready. */
  untilNext: number | null;
};

export function hintView(game: GameState, answer: Movie): HintView {
  const used = game.guesses.length;
  const h = hintsOf(game);
  const over = game.status !== "playing";

  const frameTaken = h.frameAt !== undefined;
  const plotTaken = h.plotAt !== undefined;

  // The poster is the hint; a backdrop only stands in on the rare film that has
  // no poster. A film with neither simply never offers that hint, and the plot
  // steps forward rather than leaving the player with nothing.
  const hasFrame = Boolean(answer.poster || answer.backdrop);
  const hasPlot =
    Boolean(answer.overview && answer.overview.length >= 40) &&
    !plotWouldLeak(answer.overview!, answer);

  const frameOffered = !over && hasFrame && !frameTaken && used >= FRAME_AT;
  const plotOffered =
    !over && hasPlot && !plotTaken && used >= (hasFrame ? PLOT_AT : FRAME_AT);

  const sharpness = frameTaken
    ? Math.min(SHARPNESS.length - 1, Math.max(0, used - h.frameAt!))
    : 0;

  let untilNext: number | null = null;
  if (!over) {
    if (hasFrame && !frameTaken && used < FRAME_AT) untilNext = FRAME_AT - used;
    else if (hasPlot && !plotTaken && !plotOffered) {
      const at = hasFrame ? PLOT_AT : FRAME_AT;
      if (used < at) untilNext = at - used;
    }
  }

  return { frameOffered, plotOffered, frameTaken, plotTaken, sharpness, untilNext };
}

/* ---------------- plot redaction ---------------- */

export const BLOCK = "█";

/**
 * Words too ordinary to hide, but only three letters long.
 *
 * Longer words are always redacted when they belong to the title or the credits,
 * however ordinary they look: a film called "Love Mocktail" whose synopsis opened
 * "Love ████████" had given away half its own title. Three-letter words stay
 * exempt because blacking out every "the" and "and" leaves unreadable rubble,
 * and they carry almost no signal anyway.
 */
const KEEP = new Set([
  "the", "and", "for", "with", "from", "that", "this", "they", "them", "their",
  "there", "when", "then", "than", "into", "onto", "over", "after", "before",
  "who", "whom", "whose", "what", "which", "while", "will", "would", "been",
  "have", "has", "had", "was", "were", "are", "his", "her", "hers", "him",
  "she", "he", "it", "its", "but", "not", "all", "one", "two", "out", "up",
  "down", "off", "own", "new", "old", "man", "men", "boy", "day", "life",
  "love", "story", "film", "movie", "young", "family", "world", "home",
]);

/** Every word that would hand the answer over: title, cast and crew names. */
function secretWords(m: Movie): Set<string> {
  const out = new Set<string>();
  const add = (s?: string) => {
    if (!s) return;
    for (const w of s.split(/[^\p{L}\p{N}]+/u)) {
      const lower = w.toLowerCase();
      // Four letters and up: always hidden. Three: hidden unless it is a
      // stopword. Below that, never — the damage outweighs the signal.
      if (w.length >= 4 || (w.length === 3 && !KEEP.has(lower))) out.add(lower);
    }
  };
  add(m.title);
  add(m.original);
  add(m.director);
  add(m.music);
  m.cast.forEach(add);
  // Character names give the film away just as fast as the title: a synopsis
  // naming Bhavani and Vikram is a search away from the answer.
  m.characters?.forEach(add);
  // Many synopses open in encyclopaedia voice - "X is a 2020 Kannada-language
  // film directed by..." - which hands over the release year. The board charges
  // guesses for that clue, so the hint must not give it away for free.
  out.add(String(m.year));
  return out;
}

export type PlotPiece = { text: string; hidden: boolean };

/**
 * The synopsis with anything identifying struck out.
 *
 * Returned as pieces rather than a finished string so the blocks can be styled
 * — a redaction the player can see is part of the hint, because the shape of
 * what is missing is itself information.
 *
 * Character names cannot be redacted: TMDB does not say who they are. That is a
 * known hole, and it is why this hint sits behind the frame rather than first.
 */
export function redactPlot(overview: string, answer: Movie, maxChars = 320): PlotPiece[] {
  const secrets = secretWords(answer);

  let text = overview.trim();
  if (text.length > maxChars) {
    // Cut at a sentence end where possible, so the hint does not stop mid-clause.
    const cut = text.slice(0, maxChars);
    const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    text = stop > maxChars * 0.5 ? cut.slice(0, stop + 1) : `${cut.trimEnd()}…`;
  }

  const pieces: PlotPiece[] = [];
  // Split keeping the separators, so punctuation and spacing survive intact.
  for (const token of text.split(/([^\p{L}\p{N}]+)/u)) {
    if (!token) continue;
    const hidden = secrets.has(token.toLowerCase());
    pieces.push({ text: hidden ? BLOCK.repeat(token.length) : token, hidden });
  }
  return pieces;
}

/**
 * Whether the redacted synopsis would still hand over the answer.
 *
 * Two cases survive redaction. A film whose title is a word too short or too
 * common to black out — "I", "A", "Fan" — and a title that lives inside a
 * longer word the tokeniser treats as different, so "Kaala" walks out inside
 * "Kaalan". Roughly 1% of the answer pool trips one of these, and for those the
 * plot hint is simply never offered. Withholding a hint costs a little; handing
 * over the answer costs the whole puzzle.
 */
export function plotWouldLeak(overview: string, answer: Movie): boolean {
  const visible = redactPlot(overview, answer)
    .filter((p) => !p.hidden)
    .map((p) => p.text)
    .join("")
    .toLowerCase();

  for (const title of [answer.title, answer.original]) {
    if (!title) continue;
    const t = title.trim().toLowerCase();
    if (t.length >= 2 && visible.includes(t)) return true;
  }
  return false;
}

/** Whether any hint was taken — for the share line. */
export const usedAnyHint = (g: GameState) => {
  const h = hintsOf(g);
  return h.frameAt !== undefined || h.plotAt !== undefined;
};
