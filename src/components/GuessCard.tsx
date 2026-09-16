import type { Comparison } from "../lib/types";
import { CERT_LABEL, certClue } from "../lib/lang";
import Tile, { stateClass } from "./Tile";
import Poster from "./Poster";
import { CLUE_HELP } from "../lib/clues";
import HeatMeter from "./HeatMeter";
import type { HeatReading } from "../lib/heat";

const CAST_LABELS = ["Lead", "Cast 2", "Cast 3", "Cast 4", "Cast 5"];

const mins = (n: number) => `${Math.floor(n / 60)}h ${n % 60}m`;

export default function GuessCard({
  c,
  index,
  animate,
  latest,
  reading,
}: {
  c: Comparison;
  index: number;
  animate: boolean;
  /** The newest guess, which gets the red "now playing" spine. */
  latest: boolean;
  reading: HeatReading;
}) {
  const m = c.movie;
  const d = (n: number) => (animate ? n * 70 : 0);

  return (
    <li
      className={`nf-card fade-up relative overflow-hidden rounded border p-2.5 sm:p-3 ${
        c.correct
          ? "border-[var(--color-hit-2)]/70 bg-[var(--color-hit)]/12"
          : "border-[var(--color-line)] bg-[var(--color-card)]"
      }`}
    >
      {/* Netflix marks the episode you are on with a red spine down the left
          edge — so only the newest guess gets one. */}
      {(latest || c.correct) && (
        <span
          aria-hidden
          className={`absolute inset-y-0 left-0 w-[3px] ${
            c.correct ? "bg-[var(--color-hit-2)]" : "bg-[var(--color-brand)]"
          }`}
        />
      )}

      <div className="pl-1.5">
        <HeatMeter reading={reading} animate={animate} correct={c.correct} />
      </div>

      <div className="flex gap-2.5 pl-1.5 sm:gap-3">
        <Poster
          movie={m}
          size="sm"
          className="w-[3.25rem] shrink-0 self-start sm:w-[4.25rem]"
        />

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3
              className="truncate text-base font-bold sm:text-lg"
              title={m.title}
            >
              {m.title}
            </h3>
            <span className="shrink-0 text-[11px] font-semibold tracking-[0.2em] text-[#6d6d6d] uppercase">
              {c.correct ? "Match" : `Guess ${index + 1}`}
            </span>
          </div>

          {/* Which numeric clues exist depends on the dataset: TMDB carries
          certificates and runtimes, a Wikidata build carries neither. */}
          <div
            className={`grid gap-1.5 ${
              c.cert && c.runtime
                ? "grid-cols-2 sm:grid-cols-4"
                : c.cert || c.runtime
                  ? "grid-cols-3"
                  : "grid-cols-2"
            }`}
          >
            <Tile
              label="Year"
              value={m.year}
              state={c.year.state}
              arrow={c.year.arrow}
              delay={d(0)}
              animate={animate}
              title={CLUE_HELP.Year}
            />
            <Tile
              label="Rating"
              value={m.score.toFixed(1)}
              state={c.score.state}
              arrow={c.score.arrow}
              delay={d(1)}
              animate={animate}
              title={CLUE_HELP.Rating}
            />
            {c.cert && (
              <Tile
                label={certClue(m.lang).label}
                value={CERT_LABEL[m.cert]}
                state={c.cert.state}
                delay={d(2)}
                animate={animate}
                title={certClue(m.lang).help}
              />
            )}
            {c.runtime && m.runtime && (
              <Tile
                label="Runtime"
                value={mins(m.runtime)}
                state={c.runtime.state}
                arrow={c.runtime.arrow}
                delay={d(3)}
                animate={animate}
                title={CLUE_HELP.Runtime}
              />
            )}
          </div>

          <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            <Tile
              label="Director"
              value={m.director}
              state={c.director.state}
              delay={d(4)}
              animate={animate}
              title={`${m.director}\n\n${CLUE_HELP.Director}`}
            />
            <Tile
              label="Music"
              value={m.music}
              state={c.music.state}
              delay={d(5)}
              animate={animate}
              title={`${m.music}\n\n${CLUE_HELP.Music}`}
            />
          </div>
        </div>
      </div>

      <Strip
        help={CLUE_HELP.Cast}
        label="Cast"
        items={m.cast.map((name, i) => ({
          key: `${name}-${i}`,
          text: name,
          state: c.cast[i].state,
          hint: CAST_LABELS[i],
        }))}
        animate={animate}
        base={d(6)}
      />

      <Strip
        help={CLUE_HELP.Genres}
        label="Genres"
        items={m.genres.map((g, i) => ({
          key: `${g}-${i}`,
          text: g,
          state: c.genres[i].state,
        }))}
        animate={animate}
        base={d(6) + m.cast.length * 55}
      />
    </li>
  );
}

function Strip({
  label,
  help,
  items,
  animate,
  base,
}: {
  label: string;
  help?: string;
  items: {
    key: string;
    text: string;
    state: "hit" | "near" | "miss";
    hint?: string;
  }[];
  animate: boolean;
  base: number;
}) {
  return (
    <div className="mt-1.5">
      <div
        title={help}
        className="mb-1 inline-block text-[9px] font-semibold tracking-[0.14em] text-[var(--color-muted)] uppercase sm:text-[10px]"
      >
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <span
            key={it.key}
            title={it.hint ? `${it.hint}: ${it.text}` : it.text}
            className={`${animate ? "tile-flip" : ""} max-w-[10.5rem] truncate rounded border px-2 py-1 text-[11px] font-medium sm:text-xs ${stateClass(it.state)}`}
            style={
              animate ? { animationDelay: `${base + i * 55}ms` } : undefined
            }
          >
            {it.text}
          </span>
        ))}
      </div>
    </div>
  );
}
