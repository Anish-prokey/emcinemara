#!/usr/bin/env node
/**
 * Build src/data/movies.json from TMDB.
 *
 *   TMDB_KEY=xxxxxxxx node scripts/fetch-tmdb.mjs
 *
 * Accepts either a v3 API key (32 hex chars) or a v4 read access token (a JWT).
 * Get one free at https://www.themoviedb.org/settings/api — no card needed.
 *
 * Flags:
 *   --pages=N     discover pages per language (20 films/page). Default 15 (~300/lang).
 *   --min-votes=N drop films with fewer TMDB votes than this. Default 25.
 *   --out=PATH    output file. Default src/data/movies.json
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const KEY = process.env.TMDB_KEY || process.env.TMDB_API_KEY;
if (!KEY) {
  console.error("Set TMDB_KEY first.  e.g.  TMDB_KEY=abc123 node scripts/fetch-tmdb.mjs");
  process.exit(1);
}
const IS_TOKEN = KEY.split(".").length === 3;

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=")[1] : fallback;
};

const PAGES = Number(arg("pages", 15));
const MIN_VOTES = Number(arg("min-votes", 25));
const OUT = resolve(process.cwd(), arg("out", "src/data/movies.json"));

/** The five industries the game ships. Adding one here also needs a matching
 *  entry in src/lib/lang.ts and src/lib/types.ts LangCode. */
const LANGS = ["hi", "ta", "te", "ml", "kn"];
const BASE = "https://api.themoviedb.org/3";

/* ------------------------------------------------------------------ */

let calls = 0;
async function tmdb(path, params = {}) {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  if (!IS_TOKEN) url.searchParams.set("api_key", KEY);

  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, {
      headers: IS_TOKEN ? { Authorization: `Bearer ${KEY}`, accept: "application/json" } : {},
    });
    calls++;

    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after") ?? 2) * 1000 + 500;
      await sleep(wait);
      continue;
    }
    if (res.status === 401) throw new Error("TMDB rejected the key (401). Check TMDB_KEY.");
    if (!res.ok) {
      if (attempt === 4) throw new Error(`${res.status} on ${path}`);
      await sleep(600 * (attempt + 1));
      continue;
    }
    return res.json();
  }
  throw new Error(`gave up on ${path}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------------ */

/** CBFC certificate, normalised to the three the game uses. */
function certOf(detail) {
  const india = detail.release_dates?.results?.find((r) => r.iso_3166_1 === "IN");
  const raw = india?.release_dates?.map((d) => d.certification).find(Boolean) ?? "";
  const c = raw.toUpperCase().replace(/\s+/g, "");
  if (c === "U") return "U";
  if (c === "UA" || c.startsWith("U/A") || c.startsWith("UA")) return "UA";
  if (c === "A" || c === "S") return "A";
  return "NR";
}

function composerOf(detail) {
  const crew = detail.credits?.crew ?? [];
  const jobs = ["Original Music Composer", "Music", "Songs", "Music Director"];
  for (const job of jobs) {
    const hit = crew.find((c) => c.job === job);
    if (hit) return hit.name;
  }
  const dept = crew.find((c) => c.department === "Sound" && /music/i.test(c.job ?? ""));
  return dept?.name ?? "";
}

function directorOf(detail) {
  const crew = detail.credits?.crew ?? [];
  return crew.find((c) => c.job === "Director")?.name ?? "";
}

function castOf(detail) {
  return (detail.credits?.cast ?? [])
    .filter((c) => c.name)
    .slice(0, 5)
    .map((c) => c.name);
}

/* ------------------------------------------------------------------ */

async function discover(lang) {
  const ids = new Set();
  for (let page = 1; page <= PAGES; page++) {
    const data = await tmdb("/discover/movie", {
      with_original_language: lang,
      sort_by: "vote_count.desc",
      "vote_count.gte": MIN_VOTES,
      include_adult: false,
      page,
    });
    for (const m of data.results ?? []) ids.add(m.id);
    if (page >= (data.total_pages ?? 1)) break;
    await sleep(40);
  }
  return [...ids];
}

async function main() {
  const idsByLang = {};
  for (const lang of LANGS) {
    process.stdout.write(`discover ${lang} ... `);
    idsByLang[lang] = await discover(lang);
    console.log(`${idsByLang[lang].length} ids`);
  }

  const allIds = [...new Set(Object.values(idsByLang).flat())];
  console.log(`\nfetching details for ${allIds.length} films (this takes a few minutes)\n`);

  const movies = [];
  const skipped = { noDirector: 0, noCast: 0, noMusic: 0, notIndian: 0 };
  let done = 0;

  for (const batch of chunk(allIds, 12)) {
    const details = await Promise.all(
      batch.map((id) =>
        tmdb(`/movie/${id}`, { append_to_response: "credits,release_dates" }).catch(() => null),
      ),
    );

    for (const d of details) {
      done++;
      if (!d) continue;
      if (!LANGS.includes(d.original_language)) {
        skipped.notIndian++;
        continue;
      }

      const director = directorOf(d);
      const music = composerOf(d);
      const cast = castOf(d);
      const year = Number((d.release_date ?? "").slice(0, 4));

      if (!director) { skipped.noDirector++; continue; }
      if (cast.length < 5) { skipped.noCast++; continue; }
      if (!music) { skipped.noMusic++; continue; }
      if (!year || !d.title) continue;

      movies.push({
        id: d.id,
        title: d.title,
        original: d.original_title !== d.title ? d.original_title : undefined,
        year,
        lang: d.original_language,
        genres: (d.genres ?? []).slice(0, 5).map((g) => g.name),
        director,
        music,
        cert: certOf(d),
        score: Math.round((d.vote_average ?? 0) * 10) / 10,
        votes: d.vote_count ?? 0,
        cast,
        runtime: d.runtime || undefined,
        poster: d.poster_path ?? null,
        popularity: Math.round((d.popularity ?? 0) * 10) / 10,
      });
    }

    if (done % 240 < 12) process.stdout.write(`  ${done}/${allIds.length}\r`);
    await sleep(60);
  }

  movies.sort((a, b) => b.votes - a.votes);

  const payload = {
    source: "tmdb",
    generatedAt: new Date().toISOString(),
    note: "Generated by scripts/fetch-tmdb.mjs. This product uses the TMDB API but is not endorsed or certified by TMDB.",
    movies,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 0).replace(/},{/g, "},\n{"), "utf8");

  const byLang = {};
  for (const m of movies) byLang[m.lang] = (byLang[m.lang] ?? 0) + 1;

  console.log(`\n\nwrote ${movies.length} films to ${OUT}`);
  console.log("by language:", byLang);
  console.log("skipped:", skipped);
  console.log(`${calls} TMDB calls`);
}

function* chunk(arr, n) {
  for (let i = 0; i < arr.length; i += n) yield arr.slice(i, i + n);
}

main().catch((e) => {
  console.error("\n" + e.message);
  process.exit(1);
});
