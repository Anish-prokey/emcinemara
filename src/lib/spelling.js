/**
 * Matching Indian names across the spellings they reach English in.
 *
 * Plain JavaScript on purpose. This rule has to be applied in two places — by
 * the app when it redacts a synopsis, and by the build scripts when they decide
 * which character names are worth storing — and those are a TypeScript module
 * and a pair of Node .mjs scripts. Keeping one copy that both can import is the
 * whole point of this file.
 *
 * The bug that forced it: TMDB credits Baahubali's hero as "Mahendra 'Sivudu'
 * Bāhubali" while its own synopsis calls him Shivudu. The build script matched
 * names exactly, so it decided "Sivudu" did not appear in the synopsis and
 * dropped it; the app's matcher, which folds sh→s, would have caught it had the
 * name ever reached it. A filter stricter than its consumer throws away exactly
 * the cases the consumer exists to handle.
 */

const VOWELS = "aeiou";

/**
 * A spelling-insensitive form of a word, for matching only.
 *
 * Indian names reach English in several spellings, and TMDB synopses often use
 * a different one from the title or the credits — sometimes in the same
 * sentence: "Chaarulatha (also spelled as Charulatha) is a 2012 Indian horror
 * film". Exact matching blacked out the first and left the second standing, and
 * measured over the answer pool, 24 synopses leaked a name that way.
 *
 * So both sides are folded onto a key that forgets the usual romanisation
 * choices: doubled letters (aa, dd), the aspirates (th/t, dh/d, bh/b and the
 * rest), t/d (katha, kadha), sh/s, w/v, z/j, and an optional final "a"
 * (Siddhartha, Siddharth).
 *
 * It deliberately does not match on edit distance. "One letter different"
 * caught three more real variants but also blacked out "loves" (Lokesh),
 * "hates" (Ratheesh) and "changes" (Changer). The two looser rules kept are
 * below, and both are narrow enough to measure.
 *
 * @param {string} word
 * @returns {string}
 */
export function spellingKey(word) {
  let s = word.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
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
 *
 * @param {string} a
 * @param {string} b
 */
export function oneVowelApart(a, b) {
  const [long, short] = a.length > b.length ? [a, b] : [b, a];
  if (long.length !== short.length + 1 || short.length < 7) return false;
  for (let i = 1; i < long.length - 1; i++) {
    if (VOWELS.includes(long[i]) && long.slice(0, i) + long.slice(i + 1) === short) return true;
  }
  return false;
}

/**
 * One interior vowel swapped for another: Shivudu and Shividu.
 *
 * Which is not a romanisation choice but a plain typo — TMDB's Baahubali
 * synopsis contains both spellings, two sentences apart. A misspelt name is
 * still a name, and still one search away from the answer.
 *
 * The rule is kept deliberately tight: identical length, exactly one position
 * different, both characters vowels, and never the first or last letter. Over
 * the 21,517 synopsis words in the answer pool it blacked out nothing it was
 * not already blacking out, so it costs no prose.
 *
 * @param {string} a
 * @param {string} b
 */
export function oneVowelSwapped(a, b) {
  if (a.length !== b.length || a.length < 5) return false;
  let diff = -1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    if (diff !== -1) return false;
    diff = i;
  }
  // No difference at all is not a swap; the caller tests exact equality first.
  if (diff <= 0 || diff === a.length - 1) return false;
  return VOWELS.includes(a[diff]) && VOWELS.includes(b[diff]);
}

/**
 * A matcher over the spellings of `words`.
 *
 * Returns a predicate taking a spellingKey(). Callers apply their own
 * minimum-length rule to the raw word before asking — the app will not fold
 * anything under five letters, because at four the t/d fold reads "amid" as the
 * composer Amit Trivedi.
 *
 * @param {Iterable<string>} words
 * @returns {(key: string) => boolean}
 */
export function spellingMatcher(words) {
  const exact = new Set();
  /** Long enough for an inserted vowel to be a spelling variant rather than a coincidence. */
  const insertions = [];
  const swaps = [];
  for (const w of words) {
    if (w.length < 4) continue;
    const k = spellingKey(w);
    exact.add(k);
    if (k.length >= 7) insertions.push(k);
    if (k.length >= 5) swaps.push(k);
  }
  return (key) =>
    exact.has(key) ||
    insertions.some((s) => oneVowelApart(key, s)) ||
    swaps.some((s) => oneVowelSwapped(key, s));
}
