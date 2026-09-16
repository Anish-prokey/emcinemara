import type { Movie, Comparison, Tile, Arrow } from "./types";
import { CERT_SCALES } from "./lang";
import { CAST_ORDERED, HAS_CERTS } from "../data/movies";

const norm = (s: string) => s.trim().toLowerCase();

const YEAR_NEAR = 5;       // within this many years -> gold
const SCORE_NEAR = 0.4;    // within this rating delta -> gold
const RUNTIME_NEAR = 10;   // within this many minutes -> gold

/** What the loaded dataset can actually support. Overridable so both shapes
 *  stay testable regardless of which dataset is bundled. */
export type CompareOptions = {
  castOrdered?: boolean;
  certs?: boolean;
};

function numeric(guess: number, answer: number, near: number): Tile {
  if (guess === answer) return { state: "hit", arrow: null };
  const arrow: Arrow = answer > guess ? "up" : "down";
  return { state: Math.abs(answer - guess) <= near ? "near" : "miss", arrow };
}

/** Everyone credited on a film — used to award gold when a name shows up
 *  somewhere else on the answer's crew/cast sheet. */
function credits(m: Movie): Set<string> {
  return new Set([m.director, m.music, ...m.cast].map(norm));
}

function person(name: string, slotAnswer: string | undefined, answer: Movie): Tile {
  const n = norm(name);
  if (slotAnswer && n === norm(slotAnswer)) return { state: "hit" };
  return { state: credits(answer).has(n) ? "near" : "miss" };
}

export function compare(guess: Movie, answer: Movie, opts: CompareOptions = {}): Comparison {
  const castOrdered = opts.castOrdered ?? CAST_ORDERED;
  const certs = opts.certs ?? HAS_CERTS;

  // Adjacency only counts within the answer's own scale (CBFC or US).
  const scale = CERT_SCALES.find((s) => s.includes(answer.cert)) ?? [];
  const gi = scale.indexOf(guess.cert);
  const ai = scale.indexOf(answer.cert);
  const certTile: Tile =
    guess.cert === answer.cert
      ? { state: "hit" }
      : { state: gi >= 0 && ai >= 0 && Math.abs(gi - ai) === 1 ? "near" : "miss" };

  const answerCast = new Set(answer.cast.map(norm));

  const r1 = (n: number) => Math.round(n * 10) / 10;

  return {
    movie: guess,
    correct: guess.id === answer.id,
    year: numeric(guess.year, answer.year, YEAR_NEAR),
    score: numeric(r1(guess.score), r1(answer.score), SCORE_NEAR),
    runtime:
      guess.runtime && answer.runtime
        ? numeric(guess.runtime, answer.runtime, RUNTIME_NEAR)
        : undefined,
    cert: certs ? certTile : undefined,
    director: person(guess.director, answer.director, answer),
    music: person(guess.music, answer.music, answer),
    cast: guess.cast.map((name, i) =>
      castOrdered
        ? person(name, answer.cast[i], answer)
        : // No billing order in the data, so the only honest question is
          // whether this person is in the film at all.
          { state: answerCast.has(norm(name)) ? "hit" : "miss" },
    ),
    genres: guess.genres.map((g) => ({
      state: answer.genres.some((x) => norm(x) === norm(g)) ? "hit" : "miss",
    })),
  };
}

/** One line of the share grid: one square per clue group that is in play. */
export function shareRow(c: Comparison): string {
  const box = (t: Tile) => (t.state === "hit" ? "🟩" : t.state === "near" ? "🟨" : "⬛");
  const group = (tiles: Tile[]) => {
    if (tiles.some((t) => t.state === "hit")) {
      return tiles.every((t) => t.state === "hit") ? "🟩" : "🟨";
    }
    return tiles.some((t) => t.state === "near") ? "🟨" : "⬛";
  };

  const out = [box(c.year), box(c.score)];
  if (c.cert) out.push(box(c.cert));
  if (c.runtime) out.push(box(c.runtime));
  out.push(box(c.director), box(c.music), group(c.cast), group(c.genres));
  return out.join("");
}
