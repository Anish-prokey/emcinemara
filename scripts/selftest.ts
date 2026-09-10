/* Sanity checks over the real game modules. Run with `npm run selftest`. */
import { compare, shareRow } from "../src/lib/compare";
import {
  answerFor,
  dayIndex,
  keyForDayIndex,
  dateKey,
  poolSize,
  MAX_GUESSES,
} from "../src/lib/puzzle";
import { searchMovies } from "../src/lib/search";
import { heatOf, readings, bandFor } from "../src/lib/heat";
import { gradeFor, isMilestone, nextMilestone } from "../src/lib/grade";
import {
  hintView, redactPlot, plotWouldLeak, usedAnyHint,
  FRAME_AT, PLOT_AT, SHARPNESS,
} from "../src/lib/hints";
import type { GameState } from "../src/lib/types";
import { ALL_MOVIES, HAS_CERTS } from "../src/data/movies";
import { CERT_LABEL, LANGS, PLAYABLE } from "../src/lib/lang";
import type { LangCode } from "../src/lib/types";

let failures = 0;
function check(name: string, cond: boolean, extra = "") {
  if (!cond) {
    failures++;
    console.log(`  FAIL  ${name} ${extra}`);
  } else {
    console.log(`  ok    ${name}`);
  }
}

const byLang: Record<string, number> = {};
for (const m of ALL_MOVIES) byLang[m.lang] = (byLang[m.lang] ?? 0) + 1;
console.log(`\ndataset: ${ALL_MOVIES.length} films`, byLang, "\n");

/* ---- data integrity ---- */
const ids = new Set<number>();
let dataOk = true;
for (const m of ALL_MOVIES) {
  if (ids.has(m.id)) { dataOk = false; console.log("  dup id", m.id); }
  ids.add(m.id);
  if (m.cast.length < 3 || m.cast.length > 5) { dataOk = false; console.log("  cast size:", m.title); }
  if (!m.genres.length || m.genres.length > 5) { dataOk = false; console.log("  genres:", m.title); }
  if (!LANGS[m.lang]) { dataOk = false; console.log("  unknown lang:", m.title, m.lang); }
  if (!CERT_LABEL[m.cert]) { dataOk = false; console.log("  unknown cert:", m.title, m.cert); }
  if (m.score < 0 || m.score > 10) { dataOk = false; console.log("  score range:", m.title); }
}
check("every film is well-formed", dataOk);
check("only the five shipped industries are present", Object.keys(byLang).every((l) => PLAYABLE.includes(l as LangCode)));
check("every industry has films", PLAYABLE.every((l) => poolSize(l) > 0), JSON.stringify(byLang));

/* ---- a film compared against itself is all green ---- */
const self = compare(ALL_MOVIES[0], ALL_MOVIES[0]);
check(
  "self-comparison is a win",
  self.correct &&
    [self.year, self.score, self.cert, self.director, self.music].every((t) => t.state === "hit") &&
    self.cast.every((t) => t.state === "hit") &&
    self.genres.every((t) => t.state === "hit"),
);
check("self-comparison share row is all green", /^🟩+$/u.test(shareRow(self)));
check("the language tile is gone", !("lang" in self));

/* ---- arrows point the right way ---- */
const sholay = byTitle("Sholay");        // 1975
const rrr = byTitle("RRR");              // 2022
check("year arrow points up toward a later answer", compare(sholay, rrr).year.arrow === "up");
check("year arrow points down toward an earlier answer", compare(rrr, sholay).year.arrow === "down");

/* ---- near rules ---- */
const dangal = byTitle("Dangal");        // 2016, UA
check("same year is green", compare(byTitle("Masaan"), byTitle("Piku")).year.state === "hit");
check("4 years apart is gold", compare(byTitle("Piku"), byTitle("Gully Boy")).year.state === "near");
check("40 years apart is grey", compare(sholay, byTitle("RRR")).year.state === "miss");
// Pick real examples out of whatever dataset is loaded rather than assuming a
// particular film carries a particular certificate.
const withCert = (c: string) => ALL_MOVIES.find((m) => m.cert === c);
const certU = withCert("U"), certUA = withCert("UA"), certA = withCert("A");
if (certU && certUA) check("U vs U/A is gold", compare(certU, certUA).cert?.state === "near");
if (certU && certA) check("U vs A is grey", compare(certU, certA).cert?.state === "miss");
if (!certU || !certUA) check("dataset carries real certificates", false, "no U/UA pair found");

/* ---- runtime: driven by whether the loaded dataset actually has runtimes ---- */
const stripRuntime = (m: typeof sholay) => ({ ...m, runtime: undefined });
check(
  "no runtime tile when either film lacks a runtime",
  compare(stripRuntime(sholay), stripRuntime(dangal)).runtime === undefined,
);

const withRuntime = (m: typeof sholay, mins: number) => ({ ...m, runtime: mins });
const rtExact = compare(withRuntime(sholay, 150), withRuntime(dangal, 150));
const rtNear = compare(withRuntime(sholay, 150), withRuntime(dangal, 158));
const rtFar = compare(withRuntime(sholay, 150), withRuntime(dangal, 190));
check("runtime tile appears when both films have one", rtExact.runtime?.state === "hit");
check("runtime within 10 minutes is gold", rtNear.runtime?.state === "near");
check("runtime arrow points at a longer answer", rtNear.runtime?.arrow === "up");
check("runtime 40 minutes off is grey", rtFar.runtime?.state === "miss");
check("runtime adds an eighth square to the share row", [...shareRow(rtExact)].length === 8);
check(
  "one-sided runtime data still hides the tile",
  compare(withRuntime(sholay, 150), stripRuntime(dangal)).runtime === undefined,
);

/* ---- cross-credit gold ---- */
const haider = byTitle("Haider");        // dir + music: Vishal Bhardwaj
const maqbool = byTitle("Maqbool");      // dir + music: Vishal Bhardwaj
check("same director is green", compare(haider, maqbool).director.state === "hit");
const satya = byTitle("Satya");          // music by Vishal Bhardwaj, dir Ram Gopal Varma
check("director credited elsewhere on the answer is gold", compare(haider, satya).director.state === "near");

const drishyamHi = ALL_MOVIES.find((m) => m.title === "Drishyam" && m.lang === "hi")!;
check("same actor in the same slot is green", compare(drishyamHi, haider).cast[1].state === "hit");

/* ---- genres ---- */
check("shared genres go green", compare(byTitle("Kaithi"), byTitle("Master")).genres.every((t) => t.state === "hit"));

/* ---- per-language daily schedule ---- */
const todayKey = dateKey();
const todays = PLAYABLE.map((l) => answerFor(l, todayKey));
check("every industry resolves to a film today", todays.every((m) => Boolean(m?.title)));
check(
  "each industry's answer is in that industry",
  PLAYABLE.every((l) => answerFor(l, todayKey).lang === l),
);
check(
  "the five industries give five different films today",
  new Set(todays.map((m) => m.id)).size === PLAYABLE.length,
  todays.map((m) => m.title).join(" / "),
);

let sameDayCollisions = 0;
for (let i = 0; i < 60; i++) {
  const k = keyForDayIndex(dayIndex(todayKey) + i);
  const set = new Set(PLAYABLE.map((l) => answerFor(l, k).id));
  if (set.size !== PLAYABLE.length) sameDayCollisions++;
}
check("industries never collide on any of the next 60 days", sameDayCollisions === 0);

let repeat: string | null = null;
for (const l of PLAYABLE) {
  const seen = new Map<number, string>();
  for (let i = 0; i < poolSize(l); i++) {
    const k = keyForDayIndex(i);
    const a = answerFor(l, k);
    if (seen.has(a.id)) repeat = `${l}: ${a.title} on ${k} and ${seen.get(a.id)}`;
    seen.set(a.id, k);
  }
}
check("no film repeats inside one language's cycle", repeat === null, repeat ?? "");
check("the schedule is stable across calls", answerFor("ta", "2026-03-11").id === answerFor("ta", "2026-03-11").id);
check("puzzle numbering starts at 1", dayIndex("2026-01-01") + 1 === 1);

/* ---- search is scoped to the chosen industry ---- */
check("exact title ranks first", searchMovies("sholay", "hi")[0].title === "Sholay");
check("punctuation is ignored", searchMovies("barfi", "hi")[0].title === "Barfi!");
check("numeric titles work", searchMovies("96", "ta")[0].title === "96");
check("a Hindi film is invisible in the Tamil puzzle", searchMovies("sholay", "ta").length === 0);
check("a Tamil film is invisible in the Hindi puzzle", searchMovies("kaithi", "hi").length === 0);
check("already-guessed films are excluded", searchMovies("sholay", "hi", 8, new Set([sholay.id])).length === 0);
check("empty query returns nothing", searchMovies("", "hi").length === 0);

/* ---- a full losing game still renders ---- */
const answer = answerFor("ml", todayKey);
const wrong = ALL_MOVIES.filter((m) => m.lang === "ml" && m.id !== answer.id).slice(0, MAX_GUESSES);
const rows = wrong.map((w) => shareRow(compare(w, answer)));
const width = [...rows[0]].length;
check("share grid rows are all the same width", rows.every((r) => [...r].length === width), `width ${width}`);

// Year, rating, director, music, cast and genres are always in play;
// certificate and runtime only when the loaded dataset carries them.
const sample = compare(wrong[0], answer);
const expectedSquares = 6 + (sample.cert ? 1 : 0) + (sample.runtime ? 1 : 0);
check(
  `share row has ${expectedSquares} clue squares for this dataset`,
  width === expectedSquares,
  `got ${width}`,
);
check(
  "every film can produce a full-width row",
  ALL_MOVIES.every((m) => Boolean(m.runtime)) || !HAS_CERTS,
  `${ALL_MOVIES.filter((m) => !m.runtime).length} film(s) lack a runtime`,
);

function byTitle(t: string) {
  const m = ALL_MOVIES.find((x) => x.title === t);
  if (!m) throw new Error(`seed is missing "${t}"`);
  return m;
}


/* ---- heat: the "am I getting warmer" score ---- */
{
  const lang = PLAYABLE[0] as LangCode;
  const target = answerFor(lang, dateKey());
  const others = ALL_MOVIES.filter((m) => m.lang === lang && m.id !== target.id);

  check("a correct guess is exactly 100", heatOf(compare(target, target)) === 100);

  const scores = others.map((m) => heatOf(compare(m, target)));
  check(
    "every heat score stays inside 0-100",
    scores.every((v) => v >= 0 && v <= 100 && Number.isInteger(v)),
    `min ${Math.min(...scores)} max ${Math.max(...scores)}`,
  );
  check(
    "a wrong guess never reaches 100",
    scores.every((v) => v < 100),
    `${scores.filter((v) => v === 100).length} wrong guess(es) scored 100`,
  );
  // The meter is worthless if every guess lands in the same band.
  const bands = new Set(scores.map((v) => bandFor(v).key));
  check("wrong guesses spread across several bands", bands.size >= 3, `${bands.size} band(s)`);

  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  check("a typical wrong guess reads cool, not warm", mean < 40, `mean ${mean.toFixed(1)}`);

  // Heat must be a pure function of the tiles, so it can never leak more than
  // the board already shows.
  const twice = others.slice(0, 40).every((m) => heatOf(compare(m, target)) === heatOf(compare(m, target)));
  check("heat is deterministic", twice);
}

/* ---- readings: deltas and the "closest yet" flag ---- */
{
  const lang = PLAYABLE[0] as LangCode;
  const target = answerFor(lang, dateKey());
  const picks = ALL_MOVIES.filter((m) => m.lang === lang && m.id !== target.id).slice(0, 6);
  const rs = readings([...picks.map((m) => compare(m, target)), compare(target, target)]);

  check("the first guess has no delta to report", rs[0].delta === null);
  check("the first guess is always the closest so far", rs[0].best === true);
  check("the winning guess is the closest of the run", rs[rs.length - 1].best === true);
  check(
    "a guess is flagged best only when it beats every earlier one",
    rs.every((r, i) => r.best === (r.heat > Math.max(-1, ...rs.slice(0, i).map((x) => x.heat)))),
  );
  check(
    "a positive delta always accompanies a new best",
    rs.every((r) => r.delta === null || r.delta <= 0 || r.best),
  );
}

/* ---- grades ---- */
{
  const all = Array.from({ length: MAX_GUESSES }, (_, i) => gradeFor(i + 1));
  check("every guess count has a grade", all.every((g) => g.title.length > 0));
  check(
    "reach falls as the solve gets slower",
    all.every((g, i) => i === 0 || g.reach <= all[i - 1].reach),
  );
  check("reach stays inside 0-1", all.every((g) => g.reach > 0 && g.reach <= 1));
  check("a one-guess solve outranks a ten-guess one", all[0].reach > all[all.length - 1].reach);
  check("milestones are recognised", isMilestone(7) && !isMilestone(8));
  check("the next milestone is always ahead", (nextMilestone(7) ?? 0) > 7);
  check("a long streak eventually runs out of milestones", nextMilestone(100000) === null);
}


/* ---- hints: the plot must never hand over the answer ---- */
{
  const pools = PLAYABLE.flatMap((lang) =>
    ALL_MOVIES.filter((m) => m.lang === lang)
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 150),
  );

  const offered = pools.filter(
    (m) => m.overview && m.overview.length >= 40 && !plotWouldLeak(m.overview, m),
  );

  // Titles of one or two characters are excluded: "I" appears inside any
  // English sentence, so a substring test on them means nothing either way.
  const leaked = offered.filter((m) => {
    if (m.title.trim().length < 3) return false;
    const visible = redactPlot(m.overview!, m)
      .filter((p) => !p.hidden)
      .map((p) => p.text)
      .join("");
    return new RegExp(`\b${m.title.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\b`, "i").test(visible);
  });
  check("no offered synopsis leaves its title readable", leaked.length === 0,
    leaked.slice(0, 5).map((m) => m.title).join(", "));

  // A title only has to leak in part to be worth guessing from: "Love ████████"
  // tells you the first word and the length of the second.
  const partial = offered.filter((m) => {
    const visible = redactPlot(m.overview!, m)
      .filter((p) => !p.hidden)
      .map((p) => p.text)
      .join(" ")
      .toLowerCase();
    const words = visible.split(/[^a-z0-9]+/).filter(Boolean);
    return m.title
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length >= 4)
      .some((w) => words.includes(w.toLowerCase()));
  });
  check("no offered synopsis leaves even one title word standing",
    partial.length === 0,
    partial.slice(0, 5).map((m) => m.title).join(", "));

  // Encyclopaedia-voice synopses state the release year, which the board
  // otherwise charges guesses to learn.
  const yearLeak = offered.filter((m) =>
    redactPlot(m.overview!, m)
      .filter((p) => !p.hidden)
      .map((p) => p.text)
      .join(" ")
      .includes(String(m.year)),
  );
  check("no offered synopsis states the release year",
    yearLeak.length === 0,
    yearLeak.slice(0, 5).map((m) => `${m.title} (${m.year})`).join(", "));

  // Character names give a film away as fast as its title: a synopsis naming
  // Simran and Raj is one search from the answer.
  const withChars = offered.filter((m) => m.characters && m.characters.length);
  const charLeak = withChars.filter((m) => {
    const visible = redactPlot(m.overview!, m)
      .filter((p) => !p.hidden)
      .map((p) => p.text)
      .join(" ")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    return m.characters!.some((c) => visible.includes(c.toLowerCase()));
  });
  check("no offered synopsis names its characters",
    charLeak.length === 0,
    charLeak.slice(0, 5).map((m) => `${m.title}: ${m.characters!.join("/")}`).join(", "));
  check("character names were actually captured for a fair share of films",
    withChars.length >= 40,
    `${withChars.length} of ${offered.length} offered films name a character`);

  check("almost every answer-pool film can offer a plot",
    offered.length >= pools.length * 0.97,
    `${offered.length}/${pools.length}`);

  // Over-redaction is the other failure: a wall of blocks is not a hint.
  const worst = Math.max(...offered.slice(0, 400).map((m) => {
    const p = redactPlot(m.overview!, m);
    return p.filter((x) => x.hidden).length / p.length;
  }));
  check("redaction never eats most of the synopsis", worst < 0.35, `worst ${(worst * 100).toFixed(0)}%`);

  const sample = offered[0];
  check("redaction preserves the surrounding prose",
    redactPlot(sample.overview!, sample).some((p) => !p.hidden && p.text.trim().length > 3));
}

/* ---- hints: when they unlock ---- */
{
  const lang = PLAYABLE[0] as LangCode;
  const withFrame = ALL_MOVIES.find((m) => m.lang === lang && m.backdrop && m.overview)!;
  const noFrame = ALL_MOVIES.find((m) => m.lang === lang && !m.backdrop && m.overview);

  const board = (used: number, hints?: GameState["hints"]): GameState => ({
    day: "2026-01-01", lang, status: "playing",
    guesses: Array.from({ length: used }, (_, i) => i + 1), hints,
  });

  check("no frame before the gate", hintView(board(FRAME_AT - 1), withFrame).frameOffered === false);
  check("a frame is offered on the gate", hintView(board(FRAME_AT), withFrame).frameOffered === true);
  check("the wait is counted down", hintView(board(FRAME_AT - 2), withFrame).untilNext === 2);
  check("no plot until its own gate",
    hintView(board(PLOT_AT - 1, { frameAt: FRAME_AT }), withFrame).plotOffered === false);
  check("the plot follows the frame",
    hintView(board(PLOT_AT, { frameAt: FRAME_AT }), withFrame).plotOffered === true);
  check("a taken hint stops being offered",
    hintView(board(FRAME_AT + 1, { frameAt: FRAME_AT }), withFrame).frameOffered === false);
  check("a finished board offers nothing", (() => {
    const g = { ...board(FRAME_AT + 2), status: "won" as const };
    const v = hintView(g, withFrame);
    return !v.frameOffered && !v.plotOffered;
  })());

  // The still sharpens with the guesses that follow it, then stops.
  const sharp = (used: number) => hintView(board(used, { frameAt: FRAME_AT }), withFrame).sharpness;
  check("the frame starts at its coarsest", sharp(FRAME_AT) === 0);
  check("the frame sharpens as guesses pass", sharp(FRAME_AT + 2) === 2);
  check("sharpening stops at the last step",
    sharp(FRAME_AT + 50) === SHARPNESS.length - 1, String(sharp(FRAME_AT + 50)));
  check("every sharpness step is coarser than the next",
    SHARPNESS.every((v, i) => i === 0 || v > SHARPNESS[i - 1]));

  // The scale has to reach the end of the board. A fixed-length one went clear
  // partway through and then told the player nothing for the rest of the game.
  // The hint is the poster, and posters carry the title. Measured on real
  // artwork: unreadable at 34 pixels across, legible by 38. If this ceiling
  // ever rises, the hint starts printing the answer.
  check("the sharpest step keeps the title unreadable",
    SHARPNESS[SHARPNESS.length - 1] <= 34,
    `sharpest step is ${SHARPNESS[SHARPNESS.length - 1]}px across`);

  check("the scale has a step for every guess after the unlock",
    SHARPNESS.length === MAX_GUESSES - FRAME_AT + 1,
    `${SHARPNESS.length} steps for ${MAX_GUESSES - FRAME_AT + 1} guesses`);
  check("taking it at the first opportunity still improves on the last guess",
    sharp(MAX_GUESSES) === SHARPNESS.length - 1 && sharp(MAX_GUESSES - 1) < SHARPNESS.length - 1,
    `second-last ${sharp(MAX_GUESSES - 1)}, last ${sharp(MAX_GUESSES)}`);
  check("taken late, it still sharpens at least once",
    hintView(board(MAX_GUESSES, { frameAt: MAX_GUESSES - 1 }), withFrame).sharpness >= 1);

  if (noFrame) {
    check("a film with no still offers its plot early",
      hintView(board(FRAME_AT), noFrame).plotOffered === true);
  }

  check("an untouched board reports no hints", usedAnyHint(board(3)) === false);
  check("a hinted board says so", usedAnyHint(board(5, { frameAt: 4 })) === true);
  check("a board saved before hints existed still loads",
    hintView({ day: "2026-01-01", lang, guesses: [], status: "playing" }, withFrame).frameTaken === false);
}


/* ---- a hint must survive the guesses that follow it ---- */
{
  const lang = PLAYABLE[0] as LangCode;
  const film = ALL_MOVIES.find((m) => m.lang === lang && m.backdrop && m.overview)!;

  // Mirrors what submit() does: build the next board from the current one.
  const before: GameState = {
    day: "2026-01-01", lang, guesses: [1, 2, 3, 4], status: "playing",
    hints: { frameAt: 4 },
  };
  const after: GameState = { ...before, guesses: [...before.guesses, 5] };

  check("guessing does not discard a taken hint", hintView(after, film).frameTaken === true);
  check("the hint keeps sharpening afterwards", hintView(after, film).sharpness === 1);
  check("a taken hint still shows on a finished board",
    hintView({ ...after, status: "won" }, film).frameTaken === true);
}


/* ---- hint data must cover every film that can actually be an answer ----

   The synopsis and still are stored only for the most-voted films in each
   language, because shipping them for all 1,961 costs every visitor 300KB they
   can never use. That prune is keyed to a separate constant in the enrich
   script, so this walks a full cycle of every language's schedule and checks
   nothing fell through the gap. */
{
  const missingPlot: string[] = [];
  const missingStill: string[] = [];
  let totalAnswers = 0;

  for (const lang of PLAYABLE) {
    const n = poolSize(lang);
    for (let i = 0; i < n; i++) {
      const a = answerFor(lang, keyForDayIndex(i));
      totalAnswers++;
      if (!a.overview) missingPlot.push(`${lang}:${a.title}`);
      if (!a.backdrop) missingStill.push(`${lang}:${a.title}`);
    }
  }

  // The invariant that actually matters: nobody gets a puzzle they cannot ask
  // for help on. Either source alone is enough, and the panel offers the plot
  // early when there is no still to offer first.
  const helpless = missingPlot.filter((t) => missingStill.includes(t));
  check("no possible answer is left with no hint at all", helpless.length === 0,
    `${helpless.length}: ${helpless.slice(0, 5).join(", ")}`);

  check("nearly every possible answer carries a synopsis",
    missingPlot.length <= 4,
    `${missingPlot.length} missing, e.g. ${missingPlot.slice(0, 3).join(", ")}`);
  // Some films genuinely have no still on TMDB; those fall back to the plot.
  check("most possible answers carry a still",
    missingStill.length <= Math.round(totalAnswers * 0.06),
    `${missingStill.length} of ${totalAnswers} missing`);
}

console.log(failures === 0 ? "\nall checks passed\n" : `\n${failures} check(s) failed\n`);
process.exit(failures === 0 ? 0 : 1);
