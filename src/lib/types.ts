export type Movie = {
  id: number;
  title: string;
  original?: string;      // original-script / original-language title
  year: number;
  lang: LangCode;
  genres: string[];       // up to 5
  director: string;
  music: string;          // music director / composer
  cert: Cert;             // CBFC certificate
  score: number;          // TMDB vote average, 0-10
  votes: number;
  cast: string[];         // [lead, ...up to 4 supporting]
  runtime?: number;       // minutes; only present once TMDB data is loaded
  poster?: string | null;
  /** A still from the film, for the frame hint. TMDB path, same shape as poster. */
  backdrop?: string | null;
  /** Raw plot summary. Never shown as-is — see redactPlot(). */
  overview?: string;
  /** Character names that appear in `overview`, so they can be redacted too. */
  characters?: string[];
};

/** The five industries the game ships. Each one runs its own daily puzzle. */
export type LangCode = "hi" | "ta" | "te" | "ml" | "kn";

export type Cert = "U" | "UA" | "A" | "NR";

export type TileState = "hit" | "near" | "miss";
export type Arrow = "up" | "down" | null;

export type Tile = {
  state: TileState;
  arrow?: Arrow;
};

export type Comparison = {
  movie: Movie;
  correct: boolean;
  year: Tile;
  runtime?: Tile;   // omitted when either film has no runtime on record
  score: Tile;
  cert?: Tile;      // omitted when the dataset carries no real certificates
  director: Tile;
  music: Tile;
  cast: Tile[];      // 5 slots, aligned with movie.cast
  genres: Tile[];    // aligned with movie.genres
};

export type GameStatus = "playing" | "won" | "lost";

export type GameState = {
  day: string;          // ISO date of the puzzle, e.g. "2026-08-25"
  lang: LangCode;
  guesses: number[];    // movie ids in order
  status: GameStatus;
  /** Which hints were taken, and after how many guesses. Absent on older saves. */
  hints?: { frameAt?: number; plotAt?: number };
};

export type Stats = {
  played: number;
  wins: number;
  streak: number;
  best: number;
  lastDay: string | null;
  dist: Record<number, number>;   // guesses used -> count
};
