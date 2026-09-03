import type { LangCode, Movie } from "./types";
import { ALL_MOVIES } from "../data/movies";

/**
 * Strip diacritics and punctuation so "Barfi!" matches "barfi" and
 * "Anbe Sivam" matches "anbesivam".
 *
 * The Unicode ranges are written as \u escapes on purpose. Spelling them with
 * literal characters makes the regex depend on the file being decoded as UTF-8,
 * and it throws "Range out of order in character class" the moment anything
 * serves or bundles it as Latin-1 — which takes the whole app down, since this
 * runs at module load.
 */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // combining diacritical marks
    .toLowerCase()
    // latin alphanumerics plus the Indic blocks (Devanagari .. Malayalam)
    .replace(/[^a-z0-9\u0900-\u0d7f ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type Indexed = { movie: Movie; folded: string; squashed: string; original: string };

const build = (movies: Movie[]): Indexed[] =>
  movies.map((m) => {
    const folded = fold(m.title);
    return {
      movie: m,
      folded,
      squashed: folded.replace(/ /g, ""),
      original: m.original ? fold(m.original) : "",
    };
  });

/** One index per language — you only ever guess within the industry you picked. */
const INDEX_BY_LANG = new Map<LangCode, Indexed[]>();
for (const m of ALL_MOVIES) {
  if (!INDEX_BY_LANG.has(m.lang)) INDEX_BY_LANG.set(m.lang, []);
}
for (const [lang] of INDEX_BY_LANG) {
  INDEX_BY_LANG.set(lang, build(ALL_MOVIES.filter((m) => m.lang === lang)));
}

export function searchMovies(
  query: string,
  lang: LangCode,
  limit = 8,
  exclude: Set<number> = new Set(),
): Movie[] {
  const q = fold(query);
  if (!q) return [];
  const qs = q.replace(/ /g, "");

  const scored: { m: Movie; rank: number }[] = [];

  for (const it of INDEX_BY_LANG.get(lang) ?? []) {
    if (exclude.has(it.movie.id)) continue;

    let rank = -1;
    if (it.folded === q) rank = 0;
    else if (it.folded.startsWith(q)) rank = 1;
    else if (new RegExp(`\\b${escapeRe(q)}`).test(it.folded)) rank = 2;
    else if (it.squashed.includes(qs)) rank = 3;
    else if (it.original && it.original.includes(q)) rank = 3;
    else if (it.folded.includes(q)) rank = 4;

    if (rank >= 0) scored.push({ m: it.movie, rank });
  }

  scored.sort(
    (a, b) => a.rank - b.rank || b.m.votes - a.m.votes || a.m.title.localeCompare(b.m.title),
  );
  return scored.slice(0, limit).map((s) => s.m);
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
