import type { Movie } from "./types";

export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

/** TMDB poster widths. w342 is the sweet spot for a card this size. */
export type PosterSize = "w185" | "w342" | "w500";

/**
 * Resolve a film's poster to something an <img> can load.
 *
 * `poster` normally holds a bare TMDB path ("/abc.jpg"), but absolute URLs and
 * data: URIs pass through untouched — so a self-hosted mirror, or a build step
 * that inlines the images, needs no change here.
 *
 * Returns null when the film has no artwork on record, which is every film in
 * the bundled seed. Callers must handle that.
 */
export function posterUrl(m: Movie, size: PosterSize = "w342"): string | null {
  const p = m.poster;
  if (!p) return null;
  if (p.startsWith("data:") || /^https?:\/\//.test(p)) return p;
  return `${TMDB_IMAGE_BASE}/${size}${p.startsWith("/") ? "" : "/"}${p}`;
}
