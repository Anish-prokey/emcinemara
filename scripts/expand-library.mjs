/**
 * Grow the film library without ever shrinking it.
 *
 * The lesson from re-running fetch-tmdb.mjs: TMDB's discovery endpoints do not
 * return a stable set, and a straight refetch turned 1,961 films into 975. So
 * this script is strictly additive. It reads the existing dataset, looks only
 * for films it does not already have, and appends. Nothing already in the file
 * is modified or removed, whatever TMDB says today.
 *
 * Two things widen the net compared to the original fetch:
 *
 *   1. Pagination. The old run stopped at 15 pages - 300 films per language -
 *      while Hindi alone has over a thousand above the vote threshold. Most of
 *      what was "missing" was simply never asked for.
 *
 *   2. Wikidata. The commonest reason a real film gets dropped is that TMDB
 *      credits no music director, which is a hard requirement here because it
 *      is one of the eight clues. Wikidata knows the composer for about half of
 *      those, joined exactly on the TMDB id it stores as property P4947.
 *
 *   npm run expand
 *   npm run expand -- --dry-run     # report what it would add, change nothing
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = resolve(HERE, "../src/data/movies.json");
const KEY = process.env.TMDB_KEY || process.env.TMDB_API_KEY;
const DRY = process.argv.includes("--dry-run");

if (!KEY) {
  console.error("Set TMDB_KEY in .env first.");
  process.exit(1);
}

/**
 * How deep to go per language.
 *
 * Kannada is why this is per-language rather than one number: it has only a few
 * dozen films above the old threshold, which left its puzzle repeating every 42
 * days. Its bar has to be lower for the rotation to be a rotation at all. The
 * others are gated on quality rather than scarcity.
 */
const PLAN = {
  hi: { minVotes: 12, pages: 60 },
  ta: { minVotes: 8, pages: 50 },
  te: { minVotes: 8, pages: 50 },
  ml: { minVotes: 8, pages: 50 },
  kn: { minVotes: 2, pages: 40 },
};

const MUSIC_JOBS = ["Original Music Composer", "Music", "Composer", "Songs"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJSON(url, opts, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, opts);
      if (r.status === 429) {
        await sleep(1200 * (i + 1));
        continue;
      }
      if (r.ok) return await r.json();
    } catch {
      /* retried below */
    }
    await sleep(500 * (i + 1));
  }
  return null;
}

const tmdb = (path, params = {}) => {
  const u = new URL("https://api.themoviedb.org/3" + path);
  u.searchParams.set("api_key", KEY);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  return getJSON(u.toString());
};

/* ---------------- discovery ---------------- */

async function discover(lang, plan) {
  const ids = new Set();
  for (let page = 1; page <= plan.pages; page++) {
    const d = await tmdb("/discover/movie", {
      with_original_language: lang,
      sort_by: "vote_count.desc",
      "vote_count.gte": plan.minVotes,
      include_adult: false,
      page,
    });
    if (!d) break;
    for (const m of d.results ?? []) ids.add(m.id);
    if (page >= (d.total_pages ?? 1)) break;
    await sleep(45);
  }
  return [...ids];
}

/* ---------------- wikidata backfill ---------------- */

/** Composers for the TMDB ids TMDB itself has no music credit for. */
async function composersFromWikidata(ids) {
  const out = new Map();
  // The query travels in a URL, so the id list has to stay well short of a limit.
  for (let i = 0; i < ids.length; i += 120) {
    const values = ids
      .slice(i, i + 120)
      .map((id) => JSON.stringify(String(id)))
      .join(" ");

    const q = [
      "SELECT ?tmdb ?composerLabel WHERE {",
      "  VALUES ?tmdb { " + values + " }",
      "  ?film wdt:P4947 ?tmdb .",
      "  ?film wdt:P86 ?composer .",
      "  SERVICE wikibase:label { bd:serviceParam wikibase:language " +
        JSON.stringify("en") +
        ". }",
      "}",
    ].join(" ");

    const j = await getJSON(
      "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q),
      {
        headers: {
          "User-Agent": "emcinemara/1.0 (daily film puzzle; local build script)",
          Accept: "application/sparql-results+json",
        },
      },
    );

    for (const b of j?.results?.bindings ?? []) {
      const name = b.composerLabel?.value;
      // An unresolved label comes back as the bare Q-id, which is not a name.
      if (!name || /^Q[0-9]+$/.test(name)) continue;
      if (!out.has(b.tmdb.value)) out.set(b.tmdb.value, name);
    }
    // Wikidata's public endpoint is shared and rate-limited; be a good citizen.
    await sleep(900);
  }
  return out;
}

/* ---------------- shaping ---------------- */

function certOf(d) {
  const rel = d.release_dates?.results?.find((r) => r.iso_3166_1 === "IN");
  for (const c of rel?.release_dates ?? []) {
    const t = (c.certification ?? "").trim().toUpperCase().replace(/\s+/g, "");
    if (t === "U") return "U";
    if (t === "UA" || t === "U/A" || t.startsWith("UA")) return "UA";
    if (t === "A") return "A";
  }
  return "NR";
}

const nameOf = (p) => (p?.name ?? "").trim();

function shape(d, fallbackMusic) {
  const crew = d.credits?.crew ?? [];
  const director = nameOf(crew.find((c) => c.job === "Director"));
  const music = nameOf(crew.find((c) => MUSIC_JOBS.includes(c.job))) || (fallbackMusic ?? "");
  const cast = (d.credits?.cast ?? []).slice(0, 5).map(nameOf).filter(Boolean);
  const genres = (d.genres ?? []).slice(0, 5).map((g) => g.name);
  const year = Number((d.release_date ?? "").slice(0, 4));

  if (!director || !music || !genres.length || !d.runtime || !year || !d.title) return null;
  // Three is the documented floor for the cast clue. The original fetch demanded
  // five, which threw away a great many otherwise complete films.
  if (cast.length < 3) return null;

  return {
    id: d.id,
    title: d.title,
    original: d.original_title !== d.title ? d.original_title : undefined,
    year,
    lang: d.original_language,
    genres,
    director,
    music,
    cert: certOf(d),
    score: Math.round((d.vote_average ?? 0) * 10) / 10,
    votes: d.vote_count ?? 0,
    cast,
    runtime: d.runtime || undefined,
    poster: d.poster_path ?? null,
  };
}

/* ---------------- run ---------------- */

const data = JSON.parse(readFileSync(FILE, "utf8"));
const before = data.movies.length;
const known = new Set(data.movies.map((m) => m.id));

const beforeByLang = {};
for (const m of data.movies) beforeByLang[m.lang] = (beforeByLang[m.lang] ?? 0) + 1;

const candidates = [];
for (const lang of Object.keys(PLAN)) {
  const plan = PLAN[lang];
  process.stdout.write(`discover ${lang} (votes>=${plan.minVotes}) ... `);
  const ids = await discover(lang, plan);
  const fresh = ids.filter((id) => !known.has(id));
  console.log(`${ids.length} found, ${fresh.length} new`);
  candidates.push(...fresh);
}

const unique = [...new Set(candidates)];
console.log("");
console.log(`${unique.length} new films to inspect`);
if (DRY) {
  console.log("(dry run - nothing written)");
  process.exit(0);
}

const details = [];
for (let i = 0; i < unique.length; i += 12) {
  const got = await Promise.all(
    unique
      .slice(i, i + 12)
      .map((id) => tmdb(`/movie/${id}`, { append_to_response: "credits,release_dates" })),
  );
  for (const d of got) if (d) details.push(d);
  if (i % 240 < 12) process.stdout.write(`  ${Math.min(i + 12, unique.length)}/${unique.length}\r`);
  await sleep(60);
}
console.log("");
console.log(`fetched ${details.length} detail records`);

// Anything complete except the composer gets one more chance, from Wikidata.
const needMusic = details
  .filter((d) => {
    const crew = d.credits?.crew ?? [];
    return crew.some((c) => c.job === "Director") && !crew.some((c) => MUSIC_JOBS.includes(c.job));
  })
  .map((d) => d.id);

console.log(`${needMusic.length} of them have no composer on TMDB - asking Wikidata`);
const wd = needMusic.length ? await composersFromWikidata(needMusic) : new Map();
console.log(`Wikidata supplied ${wd.size}`);

const added = [];
let rejected = 0;
for (const d of details) {
  if (!Object.keys(PLAN).includes(d.original_language)) continue;
  const m = shape(d, wd.get(String(d.id)));
  if (!m) {
    rejected++;
    continue;
  }
  added.push(m);
}

const rescued = added.filter((m) => wd.has(String(m.id))).length;

data.movies = [...data.movies, ...added];
data.movies.sort((a, b) => b.votes - a.votes);
data.expandedAt = new Date().toISOString();
writeFileSync(FILE, JSON.stringify(data, null, 0));

const afterByLang = {};
for (const m of data.movies) afterByLang[m.lang] = (afterByLang[m.lang] ?? 0) + 1;

console.log("");
console.log(`added ${added.length}, rejected ${rejected} for incomplete data`);
console.log(`library ${before} -> ${data.movies.length}`);
console.log("");
for (const lang of Object.keys(PLAN)) {
  const b = beforeByLang[lang] ?? 0;
  const a = afterByLang[lang] ?? 0;
  console.log(`  ${lang}  ${String(b).padStart(4)} -> ${String(a).padStart(4)}  (+${a - b})`);
}
console.log("");
console.log(`${rescued} of the additions exist only because Wikidata knew the composer.`);
