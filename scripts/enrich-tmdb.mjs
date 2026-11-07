/**
 * Add the hint fields to the existing dataset, in place.
 *
 * Deliberately NOT part of fetch-tmdb.mjs. A full refetch re-runs TMDB's
 * discovery endpoints, and those do not return a stable set — rerunning it
 * returned 975 films where the bundled dataset has 1961, and would have
 * silently halved the library. This script never discovers anything: it walks
 * the films already in movies.json and fills in `backdrop` and `overview`,
 * leaving every other field exactly as it was.
 *
 *   npm run enrich:tmdb
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
// The same file the app redacts with, imported rather than reimplemented.
import { spellingKey, spellingMatcher } from "../src/lib/spelling.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(HERE, "../src/data/movies.json");
const KEY = process.env.TMDB_KEY || process.env.TMDB_API_KEY;
if (!KEY) {
  console.error("Set TMDB_KEY in .env first.");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function detail(id, attempt = 0) {
  try {
    const r = await fetch(
      `https://api.themoviedb.org/3/movie/${id}?api_key=${KEY}&append_to_response=credits`,
    );
    if (r.status === 429 && attempt < 4) {
      await sleep(1000 * (attempt + 1));
      return detail(id, attempt + 1);
    }
    if (!r.ok) return null;
    return await r.json();
  } catch {
    if (attempt < 3) {
      await sleep(500 * (attempt + 1));
      return detail(id, attempt + 1);
    }
    return null;
  }
}

/**
 * Hints are only ever shown for the answer, and answers are drawn from the
 * most-voted films in each language (ANSWER_POOL_SIZE in puzzle.ts, currently
 * 150). Carrying a synopsis for the other 1,100 films costs every visitor a
 * download they can never use, so the text is kept only for the pool plus a
 * margin. Raising ANSWER_POOL_SIZE past this number means re-running this
 * script, or the new entries quietly lose their hints.
 */
const KEEP_HINTS_PER_LANG = 200;

function pruneUnreachable(films) {
  const keep = new Set();
  const byLang = {};
  for (const m of films) (byLang[m.lang] ??= []).push(m);
  for (const list of Object.values(byLang)) {
    list.sort((a, b) => b.votes - a.votes);
    for (const m of list.slice(0, KEEP_HINTS_PER_LANG)) keep.add(m.id);
  }
  let stripped = 0;
  for (const m of films) {
    if (keep.has(m.id)) continue;
    if (m.overview !== undefined || m.backdrop !== undefined) stripped++;
    delete m.overview;
    delete m.backdrop;
    delete m.characters;
  }
  return stripped;
}

/**
 * Character names, kept only where they actually appear in the synopsis.
 *
 * A plot that says "Vikram must stop Bhavani" gives the game away as surely as
 * printing the title, and TMDB does know who the characters are - it is in the
 * credits, on the same call. Storing all of them would cost every visitor a
 * list they will never see, so this keeps only the words the synopsis actually
 * uses, which is usually one or two.
 */
const GENERIC_ROLES = new Set([
  // Roles rather than names.
  "self", "himself", "herself", "narrator", "voice", "young", "old", "man",
  "woman", "boy", "girl", "doctor", "police", "inspector", "father", "mother",
  "son", "daughter", "brother", "sister", "friend", "uncle", "aunt", "guest",
  "special", "appearance", "cameo", "child", "student", "teacher", "villain",
  "hero", "heroine", "wife", "husband", "boss", "driver", "singer", "dancer",
  "item", "number", "extra", "unknown", "unnamed", "various", "chief", "sir",
  "madam", "junior", "senior", "little", "baby", "elder",
  // Ordinary words that fall out of credits like "Voice for the King". These
  // are never redacted at display time, so storing them only pollutes the list.
  "the", "and", "for", "with", "from", "his", "her", "its", "who", "she", "him",
  "they", "them", "that", "this", "than", "then", "into", "onto", "over", "out",
  "off", "own", "new", "all", "one", "two", "but", "not", "was", "are", "has",
  "had", "have", "been", "life", "love", "story", "film", "movie", "family",
  "world", "home", "day", "men",
]);

function charactersInOverview(credits, overview) {
  if (!overview) return undefined;
  const words = overview.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const haystack = new Set(words.map((w) => w.toLowerCase()));
  /*
   * The app matches names on spelling rather than on letters, so this filter
   * has to as well, or it throws away the very cases that matcher exists for.
   *
   * It did: TMDB credits Baahubali's hero as "Mahendra 'Sivudu' Bāhubali"
   * while its own synopsis calls him Shivudu. Matching exactly, this decided
   * the name did not appear and dropped it, so the app never knew to hide it
   * and the plot hint printed the hero's name. Both spellings fold to the same
   * key, so with the same matcher on both sides the name is kept and hidden.
   */
  const matchesOverview = spellingMatcher(words.filter((w) => w.length >= 5));

  const hits = new Set();
  for (const c of (credits?.cast ?? []).slice(0, 20)) {
    const raw = String(c.character ?? "");
    // "Dr. Rao / Narrator (voice)" -> the useful parts only.
    const cleaned = raw.replace(/\([^)]*\)/g, " ").replace(/["']/g, " ");
    for (const token of cleaned.split(/[^\p{L}\p{N}]+/u)) {
      const lower = token.toLowerCase();
      if (token.length < 3 || GENERIC_ROLES.has(lower)) continue;
      // Five letters is the app's own floor for spelling-insensitive matching;
      // below it, ordinary words start colliding with names.
      const spelled = token.length >= 5 && matchesOverview(spellingKey(token));
      if (haystack.has(lower) || spelled) hits.add(token);
    }
  }
  return hits.size ? [...hits] : undefined;
}

const data = JSON.parse(readFileSync(FILE, "utf8"));
const films = data.movies;
// `npm run enrich:tmdb -- --lang=en` refreshes one industry instead of
// refetching every film in the library. The prune below still covers all.
const langArg = process.argv.find((a) => a.startsWith("--lang="))?.slice(7);
/*
 * `--characters-only` recomputes nothing but the character lists, against the
 * synopsis already stored rather than whatever TMDB serves today.
 *
 * It exists so a fix to the name matcher can be applied to the data without a
 * full re-enrich: refetching every synopsis to repair one derived field would
 * churn 2,000 records and silently adopt whatever TMDB has rewritten since,
 * for no benefit. In this mode only films that already carry a synopsis are
 * fetched, since they are the only ones a plot hint can ever be shown for.
 */
const CHARS_ONLY = process.argv.includes("--characters-only");
let targets = langArg ? films.filter((m) => m.lang === langArg) : films;
if (CHARS_ONLY) targets = targets.filter((m) => m.overview);
console.log(
  `${CHARS_ONLY ? "recomputing characters for" : "enriching"} ${targets.length} films` +
    `${langArg ? ` (${langArg} only)` : ""}\n`,
);

let charsAdded = 0;
const charExamples = [];

let withStill = 0;
let withPlot = 0;
let failed = 0;

for (let i = 0; i < targets.length; i += 12) {
  const batch = targets.slice(i, i + 12);
  const details = await Promise.all(batch.map((m) => detail(m.id)));

  batch.forEach((m, k) => {
    const d = details[k];
    if (!d) {
      failed++;
      return;
    }
    if (!CHARS_ONLY) {
      m.backdrop = d.backdrop_path ?? null;
      const ov = (d.overview ?? "").trim();
      if (ov) m.overview = ov;
    }
    // Always against the synopsis that will actually be redacted.
    const before = new Set(m.characters ?? []);
    const found = charactersInOverview(d.credits, m.overview ?? "") ?? [];
    /*
     * A union, not a replacement. TMDB rewrites its own credits: it used to
     * call O Kadhal Kanmani's hero "Aadi", which is the name its synopsis
     * still uses, and now calls him "Aditya 'Adi' Varadarajan" - so a plain
     * re-derive dropped a name that is sitting in the first word of the text
     * we redact. A stale name costs a word of prose at worst; a missing one
     * prints the answer. Re-filtered through GENERIC_ROLES so that list still
     * has the final say, and pruneUnreachable keeps it from growing forever.
     */
    const merged = [...new Set([...before, ...found])].filter(
      (c) => !GENERIC_ROLES.has(c.toLowerCase()),
    );
    if (merged.length) m.characters = merged;
    else delete m.characters;
    const gained = merged.filter((c) => !before.has(c));
    if (gained.length) {
      charsAdded += gained.length;
      if (charExamples.length < 25) charExamples.push(`${m.title}: ${gained.join(", ")}`);
    }
    if (m.backdrop) withStill++;
    if (m.overview) withPlot++;
  });

  if (i % 240 < 12) process.stdout.write(`  ${Math.min(i + 12, targets.length)}/${targets.length}\r`);
  await sleep(55);
}

const stripped = pruneUnreachable(films);
data.movies = films;
data.enrichedAt = new Date().toISOString();
writeFileSync(FILE, JSON.stringify(data, null, 0));

const pct = (n) => `${Math.round((n / targets.length) * 100)}%`;
console.log("");
if (!CHARS_ONLY) {
  console.log(`\nstills   ${withStill}/${targets.length} (${pct(withStill)})`);
  console.log(`plots    ${withPlot}/${targets.length} (${pct(withPlot)})`);
}
console.log(`failed   ${failed}`);
console.log(`names    ${charsAdded} character names newly hidden`);
for (const e of charExamples) console.log(`           ${e}`);
if (!CHARS_ONLY) console.log(`pruned   ${stripped} films that can never be the answer`);
