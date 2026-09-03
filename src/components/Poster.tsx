import { useState } from "react";
import type { Movie } from "../lib/types";
import { posterUrl } from "../lib/poster";
import { PROFILE } from "../lib/profiles";

/**
 * The film's artwork, with a designed stand-in when there is none.
 *
 * The stand-in is not an error state — it is the card you get for a film whose
 * artwork we do not have, and it has to look deliberate, because it is what the
 * bundled seed shows for every film, what TMDB shows for its thinner entries,
 * and what a host that blocks remote images shows for everything.
 *
 * `size` only changes the stand-in's detailing: at guess-card width the title
 * has to drop to a legible minimum and the perforations have to thin out, or
 * the card turns to mush.
 */
export default function Poster({
  movie,
  className = "",
  size = "lg",
  eager = false,
}: {
  movie: Movie;
  className?: string;
  size?: "sm" | "lg";
  eager?: boolean;
}) {
  const src = posterUrl(movie, size === "sm" ? "w185" : "w342");
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const small = size === "sm";
  const frame =
    `relative aspect-[2/3] overflow-hidden rounded border border-[var(--color-line)] ` +
    `bg-[var(--color-card-2)] ${className}`;

  if (!src || failed) {
    const perf = small ? "w-1.5" : "w-2.5";
    const step = small
      ? "bg-[repeating-linear-gradient(180deg,transparent_0_4px,rgba(0,0,0,.55)_4px_8px)]"
      : "bg-[repeating-linear-gradient(180deg,transparent_0_6px,rgba(0,0,0,.55)_6px_12px)]";
    return (
      <div className={frame} style={{ backgroundImage: PROFILE[movie.lang].tint }} aria-hidden>
        <span className={`absolute inset-y-0 left-0 ${perf} ${step}`} />
        <span className={`absolute inset-y-0 right-0 ${perf} ${step}`} />
        <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <span className={`absolute inset-x-0 bottom-0 ${small ? "px-2 pb-1.5" : "px-3 pb-2.5"}`}>
          <span
            className={`display block leading-tight text-white/95 [text-wrap:balance] ${
              small ? "text-[10px]" : "text-[15px]"
            }`}
          >
            {movie.title}
          </span>
          {!small && (
            <span className="mt-0.5 block text-[10px] tracking-[0.16em] text-white/60 tabular-nums">
              {movie.year}
            </span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className={frame}>
      {!loaded && <span className="shimmer absolute inset-0" />}
      <img
        src={src}
        alt={`Poster for ${movie.title}`}
        width={small ? 185 : 342}
        height={small ? 278 : 513}
        decoding="async"
        loading={eager ? "eager" : "lazy"}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`absolute inset-0 size-full object-cover transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
