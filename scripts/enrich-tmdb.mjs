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
  const haystack = new Set(
    overview.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean),
  );

  const hits = new Set();
  for (const c of (credits?.cast ?? []).slice(0, 20)) {
    const raw = String(c.character ?? "");
    // "Dr. Rao / Narrator (voice)" -> the useful parts only.
    const cleaned = raw.replace(/\([^)]*\)/g, " ").replace(/["']/g, " ");
    for (const token of cleaned.split(/[^\p{L}\p{N}]+/u)) {
      const lower = token.toLowerCase();
      if (token.length < 3 || GENERIC_ROLES.has(lower)) continue;
      if (haystack.has(lower)) hits.add(token);
    }
  }
  return hits.size ? [...hits] : undefined;
}

const data = JSON.parse(readFileSync(FILE, "utf8"));
const films = data.movies;
console.log(`enriching ${films.length} films\n`);

let withStill = 0;
let withPlot = 0;
let failed = 0;

for (let i = 0; i < films.length; i += 12) {
  const batch = films.slice(i, i + 12);
  const details = await Promise.all(batch.map((m) => detail(m.id)));

  batch.forEach((m, k) => {
    const d = details[k];
    if (!d) {
      failed++;
      return;
    }
    m.backdrop = d.backdrop_path ?? null;
    const ov = (d.overview ?? "").trim();
    if (ov) m.overview = ov;
    const chars = charactersInOverview(d.credits, ov);
    if (chars) m.characters = chars;
    else delete m.characters;
    if (m.backdrop) withStill++;
    if (m.overview) withPlot++;
  });

  if (i % 240 < 12) process.stdout.write(`  ${Math.min(i + 12, films.length)}/${films.length}\r`);
  await sleep(55);
}

const stripped = pruneUnreachable(films);
data.movies = films;
data.enrichedAt = new Date().toISOString();
writeFileSync(FILE, JSON.stringify(data, null, 0));

const pct = (n) => `${Math.round((n / films.length) * 100)}%`;
console.log(`\n\nstills   ${withStill}/${films.length} (${pct(withStill)})`);
console.log(`plots    ${withPlot}/${films.length} (${pct(withPlot)})`);
console.log(`failed   ${failed}`);
console.log(`pruned   ${stripped} films that can never be the answer`);
