#!/usr/bin/env node
/**
 * Build a movie dataset with no API key at all.
 *
 *   node scripts/fetch-wikidata.mjs [--out=PATH] [--min-votes=N] [--limit=N]
 *
 * Two public sources, joined on the IMDb id that Wikidata already stores:
 *
 *   Wikidata SPARQL   title, year, language, director, music director, cast,
 *                     genres, runtime, IMDb/TMDB ids.  CC0, no key, no signup.
 *   IMDb ratings dump averageRating and numVotes for every title.
 *                     Free download, but NON-COMMERCIAL USE ONLY.
 *
 * What this cannot give you, and why it matters:
 *   - No CBFC certificate. Every film comes back "NR", so the Certificate clue
 *     goes dead and the app hides it (same rule as Runtime).
 *   - No posters.
 *   - No billing order. Wikidata lists cast as an unordered set, so "lead
 *     actor" is not recoverable; the file records castOrdered:false and the
 *     comparison drops slot matching rather than fake it.
 *
 * If you want certificates, posters and a real lead actor, use
 * scripts/fetch-tmdb.mjs instead — it needs a free key but carries everything.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
};

const OUT = resolve(process.cwd(), arg("out", "src/data/movies.wikidata.json"));
// A low floor on purpose: the answer pool is the top 600 by vote count anyway,
// so thinly-rated films stay searchable without ever becoming the answer. A
// high floor just starves the smaller industries.
const MIN_VOTES = Number(arg("min-votes", 40));
const PER_LANG = Number(arg("limit", 600));
const PAGE = Number(arg("page", 200));

const SPARQL = "https://query.wikidata.org/sparql";
const RATINGS = "https://datasets.imdbws.com/title.ratings.tsv.gz";
const UA = "Filmi/1.0 (daily Indian movie game; contact via repository)";

/** Wikidata item ids for the five industries the game ships. */
const LANGS = [
  ["hi", "Q1568"],
  ["ta", "Q5885"],
  ["te", "Q8097"],
  ["ml", "Q36236"],
  ["kn", "Q33673"],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */

async function sparql(query, attempt = 0) {
  const res = await fetch(`${SPARQL}?format=json&query=${encodeURIComponent(query)}`, {
    headers: { "User-Agent": UA, Accept: "application/sparql-results+json" },
  });
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 4) throw new Error(`Wikidata ${res.status} after 5 tries`);
    await sleep(2000 * (attempt + 1));
    return sparql(query, attempt + 1);
  }
  if (!res.ok) throw new Error(`Wikidata ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).results.bindings;
}

/**
 * Films for one language inside a year window.
 *
 * Deep OFFSET is what kept timing out: the engine has to build and sort the
 * whole result set before discarding the first N rows, so the largest industry
 * (Hindi, 4,382 films) failed hardest — exactly backwards. Slicing by year
 * keeps every query small, and the slices tile the whole range with no paging.
 */
function filmsQuery(qid, fromYear, toYear) {
  return `
SELECT ?film ?filmLabel ?year ?imdb ?tmdb ?runtime
       (GROUP_CONCAT(DISTINCT ?castLabel; separator="|") AS ?cast)
       (GROUP_CONCAT(DISTINCT ?genreLabel; separator="|") AS ?genres)
WHERE {
  ?film wdt:P31 wd:Q11424 ;
        wdt:P364 wd:${qid} ;
        wdt:P577 ?date ;
        wdt:P57 ?director ;
        wdt:P86 ?composer ;
        wdt:P161 ?castMember ;
        wdt:P345 ?imdb .
  OPTIONAL { ?film wdt:P4947 ?tmdb }
  OPTIONAL { ?film wdt:P2047 ?runtime }
  OPTIONAL { ?film wdt:P136 ?genre }
  BIND(YEAR(?date) AS ?year)
  FILTER(?year >= ${fromYear} && ?year <= ${toYear})
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en".
    ?film rdfs:label ?filmLabel .
    ?castMember rdfs:label ?castLabel .
    ?genre rdfs:label ?genreLabel .
  }
}
GROUP BY ?film ?filmLabel ?year ?imdb ?tmdb ?runtime
LIMIT 600`;
}

/**
 * The label service will not bind a variable we also aggregate on, so director
 * and composer come back in a second pass keyed by film. Cheaper than it looks:
 * one query per language, not one per film.
 */
function creditsQuery(qid) {
  return `
SELECT ?film (SAMPLE(?directorLabel) AS ?dir) (SAMPLE(?composerLabel) AS ?mus) WHERE {
  ?film wdt:P31 wd:Q11424 ; wdt:P364 wd:${qid} ; wdt:P57 ?director ; wdt:P86 ?composer .
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en".
    ?director rdfs:label ?directorLabel .
    ?composer rdfs:label ?composerLabel .
  }
}
GROUP BY ?film`;
}

/* ------------------------------------------------------------------ */

async function imdbRatings() {
  process.stdout.write("downloading IMDb ratings ... ");
  const res = await fetch(RATINGS, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`IMDb datasets ${res.status}`);
  const text = gunzipSync(Buffer.from(await res.arrayBuffer())).toString("utf8");
  const map = new Map();
  let first = true;
  for (const line of text.split("\n")) {
    if (first) { first = false; continue; }
    const i = line.indexOf("\t");
    if (i < 0) continue;
    const j = line.indexOf("\t", i + 1);
    map.set(line.slice(0, i), {
      score: Number(line.slice(i + 1, j)),
      votes: Number(line.slice(j + 1)),
    });
  }
  console.log(`${map.size.toLocaleString()} titles`);
  return map;
}

const clean = (s) => (s ?? "").trim();
/** Wikidata falls back to the Q-id when a label is missing in English. */
const isQid = (s) => /^Q\d+$/.test(s);

async function main() {
  const ratings = await imdbRatings();
  const movies = [];
  const skipped = { noRating: 0, thinVotes: 0, noCast: 0, noLabel: 0, noCredits: 0 };

  for (const [lang, qid] of LANGS) {
    process.stdout.write(`${lang}: credits ... `);
    const credits = new Map();
    for (const r of await sparql(creditsQuery(qid))) {
      credits.set(r.film.value, { dir: clean(r.dir?.value), mus: clean(r.mus?.value) });
    }
    process.stdout.write(`${credits.size} films; pulling details `);

    const seen = new Set();
    let kept = 0;
    let failed = 0;
    const thisYear = new Date().getFullYear();
    const windows = [];
    for (let y = thisYear; y >= 1931; y -= 4) windows.push([Math.max(1931, y - 3), y]);

    for (const [from, to] of windows) {
      if (kept >= PER_LANG) break;
      let rows;
      try {
        rows = await sparql(filmsQuery(qid, from, to));
      } catch {
        failed++;
        process.stdout.write("x");
        await sleep(1500);
        continue;
      }
      if (!rows.length) { process.stdout.write("-"); continue; }

      for (const r of rows) {
        const uri = r.film.value;
        if (seen.has(uri)) continue;
        seen.add(uri);

        const title = clean(r.filmLabel?.value);
        if (!title || isQid(title)) { skipped.noLabel++; continue; }

        const c = credits.get(uri);
        if (!c || !c.dir || !c.mus || isQid(c.dir) || isQid(c.mus)) { skipped.noCredits++; continue; }

        const cast = clean(r.cast?.value).split("|").map(clean).filter((n) => n && !isQid(n)).slice(0, 5);
        if (cast.length < 3) { skipped.noCast++; continue; }

        const rating = ratings.get(clean(r.imdb?.value));
        if (!rating || !Number.isFinite(rating.score)) { skipped.noRating++; continue; }
        if (rating.votes < MIN_VOTES) { skipped.thinVotes++; continue; }

        const genres = clean(r.genres?.value)
          .split("|").map(clean).filter((g) => g && !isQid(g))
          .map((g) => g.replace(/\s*film$/i, "").replace(/^\w/, (m) => m.toUpperCase()))
          .slice(0, 5);

        movies.push({
          id: Number(uri.split("/").pop().slice(1)), // Q123456 -> 123456
          title,
          year: Number(r.year.value),
          lang,
          genres: genres.length ? genres : ["Drama"],
          director: c.dir,
          music: c.mus,
          cert: "NR",
          score: Math.round(rating.score * 10) / 10,
          votes: rating.votes,
          cast,
          runtime: r.runtime ? Math.round(Number(r.runtime.value)) : undefined,
          poster: null,
          imdb: clean(r.imdb?.value) || undefined,
          tmdb: r.tmdb ? Number(r.tmdb.value) : undefined,
        });
        kept++;
        if (kept >= PER_LANG) break;
      }
      process.stdout.write(".");
      await sleep(300);
    }
    console.log(` ${kept} kept${failed ? ` (${failed} windows failed)` : ""}`);
  }

  movies.sort((a, b) => a.lang.localeCompare(b.lang) || b.votes - a.votes);

  const payload = {
    source: "wikidata",
    generatedAt: new Date().toISOString(),
    // The comparison reads this: without billing order, "lead actor" is not a
    // thing, so cast matching must not pretend slots mean anything.
    castOrdered: false,
    note:
      "Built by scripts/fetch-wikidata.mjs. Film data from Wikidata (CC0); " +
      "ratings and vote counts from the IMDb datasets, which are licensed for " +
      "NON-COMMERCIAL use only. No certificates, no posters, and cast is " +
      "unordered. Use scripts/fetch-tmdb.mjs for a commercially usable set.",
    movies,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 0).replace(/},{/g, "},\n{"), "utf8");

  const by = {};
  for (const m of movies) by[m.lang] = (by[m.lang] ?? 0) + 1;
  console.log(`\nwrote ${movies.length} films to ${OUT}`);
  console.log("by language:", by);
  console.log("skipped:", skipped);
  console.log(`with runtime: ${movies.filter((m) => m.runtime).length}`);
}

main().catch((e) => {
  console.error("\n" + e.message);
  process.exit(1);
});
