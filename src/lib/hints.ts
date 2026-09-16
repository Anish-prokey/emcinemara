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

/**
 * Words that turn up in TMDB character credits without being anyone's name.
 *
 * Characters are captured word by word from credits, and a credit is often a
 * description rather than a name: Sita Ramam credits "Pakistani General
 * Mohammed Musa Khan", so "Pakistani" was blacked out of its synopsis as if it
 * were a character, in a story where it is just a nationality. Ranks, jobs,
 * institutions and nationalities are dropped from the character list here;
 * the same words are still hidden if they appear in the title or the credits
 * proper, so a film actually called Major loses nothing.
 */
export const NOT_A_NAME = new Set([
  "pakistani", "indian", "british", "english", "american", "chinese", "african",
  "lankan", "bangladeshi", "nepali", "afghan", "arab", "muslim", "hindu", "christian",
  "major", "general", "brigadier", "lieutenant", "colonel", "captain", "commander",
  "sergeant", "soldier", "officer", "inspector", "constable", "commissioner",
  "superintendent", "acp", "dcp", "dsp", "ips", "ias", "cbi", "ncb", "police", "army",
  "minister", "chief", "deputy", "mla", "president", "governor", "collector", "judge",
  "advocate", "lawyer", "doctor", "nurse", "professor", "principal", "teacher",
  "college", "school", "student", "manager", "owner", "driver", "servant", "maid",
  "king", "queen", "emperor", "landlord", "priest", "master", "sir", "madam",
  // Hollywood credits describe as often as they name: Shrek credits "Princess"
  // and "Ogre", and hiding those leaves a synopsis that cannot say what kind of
  // character it is about. Real names built from such words (Spider-Man, Captain
  // America) are left alone: "spider" and "america" are not on this list.
  "prince", "princess", "agent", "detective", "sheriff", "mayor", "senator",
  "ogre", "dragon", "robot", "alien", "monster", "wizard", "witch", "vampire",
  "zombie", "ghost", "giant", "dwarf", "elf", "orc", "troll",
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
  m.characters?.filter((c) => !NOT_A_NAME.has(c.toLowerCase())).forEach(add);
  // Many synopses open in encyclopaedia voice - "X is a 2020 Kannada-language
  // film directed by..." - which hands over the release year. The board charges
  // guesses for that clue, so the hint must not give it away for free.
  out.add(String(m.year));
  return out;
}

/**
 * A spelling-insensitive form of a name, for matching only.
 *
 * Indian names reach English in several spellings, and TMDB synopses often use a
 * different one from the title or the credits — sometimes in the same sentence:
 * "Chaarulatha (also spelled as Charulatha) is a 2012 Indian horror film".
 * Exact matching blacked out the first and left the second standing, and
 * measured over the answer pool, 24 synopses leaked a name that way.
 *
 * So both sides are folded onto a key that forgets the usual romanisation
 * choices: doubled letters (aa, dd), the aspirates (th/t, dh/d, bh/b and the
 * rest), t/d (katha, kadha), sh/s, w/v, z/j, and an optional final "a"
 * (Siddhartha, Siddharth).
 *
 * It deliberately does not match on edit distance. "One letter different"
 * caught three more real variants but also blacked out "loves" (Lokesh), "hates"
 * (Ratheesh) and "changes" (Changer). The one looser rule kept is below.
 */
export function spellingKey(word: string): string {
  let s = word.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/([bdgkpt])h/g, "$1");
  s = s.replace(/d/g, "t");
  s = s.replace(/sh/g, "s").replace(/w/g, "v").replace(/z/g, "j");
  s = s.replace(/ee/g, "i").replace(/oo/g, "u");
  s = s.replace(/(.)\1+/g, "$1");
  if (s.length >= 5) s = s.replace(/a$/, "");
  return s;
}

/**
 * One interior vowel apart, and only in long names: Kasargodu and Kasaragodu.
 * Final vowels are excluded so a name like "Pakistani" does not swallow the
 * ordinary word "Pakistan", and short names are excluded outright.
 */
function oneVowelApart(a: string, b: string): boolean {
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  if (long.length !== short.length + 1 || short.length < 7) return false;
  for (let i = 1; i < long.length - 1; i++) {
    if ("aeiou".includes(long[i]) && long.slice(0, i) + long.slice(i + 1) === short) return true;
  }
  return false;
}

const LETTERS = /^\p{L}+$/u;

export type PlotPiece = { text: string; hidden: boolean };

/**
 * The synopsis with anything identifying struck out.
 *
 * Returned as pieces rather than a finished string so the blocks can be styled
 * — a redaction the player can see is part of the hint, because the shape of
 * what is missing is itself information.
 *
 * Names are matched on spelling as well as on letters (see spellingKey), because
 * a synopsis often spells a name differently from the title or the credits.
 */
// 320 used to be the limit, which cut 94 of the 749 answer-pool synopses and
// sometimes kept only a prologue: Sita Ramam's stopped after two sentences
// about Afreen and never reached Ram and Sita. 520 shows all but the longest,
// encyclopaedia-style ones in full.
export function redactPlot(overview: string, answer: Movie, maxChars = 520): PlotPiece[] {
  const secrets = secretWords(answer);

  const keys = new Set<string>();
  const longKeys: string[] = [];
  for (const w of secrets) {
    if (w.length < 4 || !LETTERS.test(w)) continue;
    const k = spellingKey(w);
    keys.add(k);
    if (k.length >= 7) longKeys.push(k);
  }

  const isSecret = (token: string): boolean => {
    if (secrets.has(token.toLowerCase())) return true;
    // Spelling-insensitive matching only for real words of five letters and
    // up. Below that, ordinary words start colliding with names: at four, the
    // t/d fold read "amid" as the composer Amit Trivedi and blacked it out.
    if (token.length < 5 || !LETTERS.test(token)) return false;
    const k = spellingKey(token);
    return keys.has(k) || longKeys.some((s) => oneVowelApart(k, s));
  };

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
    const hidden = isSecret(token);
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
