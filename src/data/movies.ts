import raw from "./movies.json";
import type { Movie } from "../lib/types";

const data = raw as unknown as {
  source: string;
  note?: string;
  castOrdered?: boolean;
  movies: Movie[];
};

/** "seed" = the bundled hand-curated demo list, "tmdb" / "wikidata" = generated. */
export const DATA_SOURCE = data.source;
export const DATA_NOTE = data.note ?? "";

export const ALL_MOVIES: Movie[] = data.movies;

/**
 * Whether `cast[0]` really is the lead and the rest are billed in order.
 *
 * TMDB bills its cast, so slot position is meaningful and the comparison can
 * say "right actor, wrong billing". Wikidata stores cast as an unordered set,
 * and a dataset built from it says so — matching on slot there would invent a
 * distinction that does not exist in the data.
 */
export const CAST_ORDERED: boolean = data.castOrdered ?? true;

/**
 * Whether certificates carry any information. A source with no certificate data
 * marks every film "NR", which makes the clue green on every guess — dead
 * weight, exactly like the Language tile once the puzzle became language-locked.
 */
export const HAS_CERTS: boolean =
  new Set(ALL_MOVIES.map((m) => m.cert)).size > 1;

export const BY_ID: Map<number, Movie> = new Map(ALL_MOVIES.map((m) => [m.id, m]));

export const getMovie = (id: number): Movie | undefined => BY_ID.get(id);
