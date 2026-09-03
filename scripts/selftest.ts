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
import { ALL_MOVIES } from "../src/data/movies";
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
check("U vs U/A is gold", compare(sholay, dangal).cert.state === "near");
check("U vs A is grey", compare(sholay, byTitle("Tumbbad")).cert.state === "miss");

/* ---- runtime: absent on the seed, active once TMDB data supplies it ---- */
check("no runtime tile when the data lacks runtimes", compare(sholay, dangal).runtime === undefined);

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
  compare(withRuntime(sholay, 150), dangal).runtime === undefined,
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
check("seed share row has 7 clue squares", width === 7);

function byTitle(t: string) {
  const m = ALL_MOVIES.find((x) => x.title === t);
  if (!m) throw new Error(`seed is missing "${t}"`);
  return m;
}

console.log(failures === 0 ? "\nall checks passed\n" : `\n${failures} check(s) failed\n`);
process.exit(failures === 0 ? 0 : 1);
