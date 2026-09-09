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

console.log(failures === 0 ? "\nall checks passed\n" : `\n${failures} check(s) failed\n`);
process.exit(failures === 0 ? 0 : 1);
