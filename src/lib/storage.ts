import type { GameState, Stats, LangCode } from "./types";
import { isPlayable } from "./lang";

const NS = "filmi.v2";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode / quota — the game still works, it just won't resume */
  }
}

/* ---------------- per-language, per-day game state ---------------- */

const gameKey = (lang: LangCode, day: string) => `${NS}.game.${lang}.${day}`;

export function loadGame(lang: LangCode, day: string): GameState {
  return read<GameState>(gameKey(lang, day), { day, lang, guesses: [], status: "playing" });
}

export function saveGame(state: GameState) {
  write(gameKey(state.lang, state.day), state);
}

/* ---------------- stats, tracked per language ---------------- */

export const EMPTY_STATS: Stats = {
  played: 0,
  wins: 0,
  streak: 0,
  best: 0,
  lastDay: null,
  dist: {},
};

const statsKey = (lang: LangCode) => `${NS}.stats.${lang}`;

export const loadStats = (lang: LangCode) => read<Stats>(statsKey(lang), EMPTY_STATS);
export const saveStats = (lang: LangCode, s: Stats) => write(statsKey(lang), s);

/** Only today's puzzle should move the streak — archive replays don't count. */
export function recordResult(
  lang: LangCode,
  day: string,
  won: boolean,
  guessesUsed: number,
): Stats {
  const s = loadStats(lang);
  if (s.lastDay === day) return s; // already recorded

  const consecutive = s.lastDay ? isPreviousDay(s.lastDay, day) : false;

  const next: Stats = {
    played: s.played + 1,
    wins: s.wins + (won ? 1 : 0),
    streak: won ? (consecutive ? s.streak + 1 : 1) : 0,
    best: s.best,
    lastDay: day,
    dist: { ...s.dist },
  };
  next.best = Math.max(next.best, next.streak);
  if (won) next.dist[guessesUsed] = (next.dist[guessesUsed] ?? 0) + 1;

  saveStats(lang, next);
  return next;
}

function isPreviousDay(a: string, b: string): boolean {
  const d = (k: string) => {
    const [y, m, day] = k.split("-").map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return d(b) - d(a) === 86_400_000;
}

/* ---------------- settings ---------------- */

export type Settings = {
  /** null until the player has picked an industry. */
  lang: LangCode | null;
  reduceMotion: boolean;
};

export const DEFAULT_SETTINGS: Settings = { lang: null, reduceMotion: false };

export function loadSettings(): Settings {
  const s = read<Settings>(`${NS}.settings`, DEFAULT_SETTINGS);
  // guard against a hand-edited or stale value
  return { ...s, lang: s.lang && isPlayable(s.lang) ? s.lang : null };
}

export const saveSettings = (s: Settings) => write(`${NS}.settings`, s);

/* ---------------- first-run ---------------- */

export const hasSeenHowTo = () => read<boolean>(`${NS}.seenHowTo`, false);
export const markSeenHowTo = () => write(`${NS}.seenHowTo`, true);
