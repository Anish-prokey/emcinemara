import type { LangCode, Movie } from "./types";
import { ALL_MOVIES } from "../data/movies";
import { PLAYABLE } from "./lang";

/** Puzzle #1 was this date. Days roll over at midnight IST. */
export const EPOCH = "2026-01-01";
export const TZ = "Asia/Kolkata";
export const MAX_GUESSES = 10;
export const ARCHIVE_DAYS = 50;

/**
 * Only reasonably well-known films become answers; every film stays searchable.
 *
 * Sized against real TMDB vote counts, which run low for Indian cinema - the
 * most-voted Tamil film has a few hundred votes, not tens of thousands. A pool
 * of 600 therefore swallowed entire language sets and made a 10-vote obscurity
 * exactly as likely as 3 Idiots. 150 keeps five months of non-repeating puzzles
 * while holding answers to films people have plausibly seen.
 */
const ANSWER_POOL_SIZE = 150;
const SHUFFLE_SEED = 0x5f14b1;

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "2026-08-25" for the given instant, in IST. */
export function dateKey(d: Date = new Date()): string {
  return fmt.format(d);
}

function toUTCDays(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** 0-based day index since EPOCH. Puzzle number is this + 1. */
export function dayIndex(key: string = dateKey()): number {
  return toUTCDays(key) - toUTCDays(EPOCH);
}

export function keyForDayIndex(i: number): string {
  const ms = (toUTCDays(EPOCH) + i) * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Distinct seed per language, so Tamil and Hindi don't march in step. */
function seedFor(lang: LangCode): number {
  let h = SHUFFLE_SEED;
  for (const ch of lang) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return h;
}

/**
 * One fixed shuffle per language, so every device derives the same schedule
 * and no film repeats until that language's pool is exhausted.
 */
const SCHEDULES: Record<LangCode, Movie[]> = Object.fromEntries(
  PLAYABLE.map((lang) => {
    const pool = ALL_MOVIES.filter((m) => m.lang === lang)
      .sort((a, b) => b.votes - a.votes)
      .slice(0, ANSWER_POOL_SIZE);
    const rnd = mulberry32(seedFor(lang));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return [lang, pool];
  }),
) as Record<LangCode, Movie[]>;

export const poolSize = (lang: LangCode) => SCHEDULES[lang].length;

export function answerFor(lang: LangCode, key: string = dateKey()): Movie {
  const pool = SCHEDULES[lang];
  const i = dayIndex(key);
  const n = pool.length;
  return pool[((i % n) + n) % n];
}

/** Today plus the previous ARCHIVE_DAYS - 1 days, newest first. */
export function archiveDays(): { key: string; num: number }[] {
  const today = dayIndex();
  const out: { key: string; num: number }[] = [];
  for (let i = today; i > today - ARCHIVE_DAYS && i >= 0; i--) {
    out.push({ key: keyForDayIndex(i), num: i + 1 });
  }
  return out;
}

export function msUntilNextPuzzle(): number {
  const now = new Date();
  const [y, m, d] = dateKey(now).split("-").map(Number);
  // IST is UTC+5:30, so the next IST midnight is 18:30 UTC on the current IST date.
  const nextMidnightUTC = Date.UTC(y, m - 1, d, 18, 30);
  const ms = nextMidnightUTC - now.getTime();
  return ms > 0 ? ms : ms + 86_400_000;
}

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function prettyDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
