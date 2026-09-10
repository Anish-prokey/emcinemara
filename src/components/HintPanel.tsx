import { useEffect, useRef, useState } from "react";
import type { GameState, Movie } from "../lib/types";
import { backdropUrl, posterUrl } from "../lib/poster";
import { hintView, redactPlot, SHARPNESS, FRAME_AT } from "../lib/hints";

/**
 * The hints.
 *
 * Three arrangements were tried and the first two were both wrong. Rendered
 * full size on the board, the poster alone ran to most of a phone screen and
 * pushed the guesses below the fold for the rest of the game. Moved wholesale
 * into a dialog, it stopped costing space but started costing clicks: the
 * poster sharpens on every guess, so checking it meant opening and closing a
 * window each turn to look at something that had changed by one step.
 *
 * So it stays on the board, small. A thumbnail is enough to see it change, and
 * the plot is only a few lines. The dialog is still there, but only as a way to
 * look closer — never something you have to open to know where you stand.
 */
export function HintBar({
  game,
  answer,
  onTake,
  onZoom,
  animate,
}: {
  game: GameState;
  answer: Movie;
  onTake: (which: "frame" | "plot") => void;
  onZoom: () => void;
  animate: boolean;
}) {
  const v = hintView(game, answer);
  const over = game.status !== "playing";
  const taken = v.frameTaken || v.plotTaken;
  const offered = v.frameOffered || v.plotOffered;

  if (!taken && !offered && v.untilNext === null) return null;

  // Nothing to take yet and nothing held: just say when it opens up.
  if (!taken && !offered) {
    return (
      <p className="mb-4 text-xs text-[var(--color-muted)]">
        A hint unlocks in {v.untilNext} guess{v.untilNext === 1 ? "" : "es"}.
      </p>
    );
  }

  return (
    <div
      className={`mb-4 rounded border border-[var(--color-line)] bg-[var(--color-card)]/60 p-2.5 ${
        animate ? "fade-up" : ""
      }`}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[10px] font-bold tracking-[0.28em] text-[var(--color-muted)] uppercase">
          Hints
        </span>
        {v.frameTaken && (
          <span className="text-[11px] tabular-nums text-[var(--color-muted)]">
            {over
              ? "Revealed"
              : v.sharpness >= SHARPNESS.length - 1
                ? "As clear as it gets"
                : `Poster ${v.sharpness + 1}/${SHARPNESS.length}`}
          </span>
        )}
      </div>

      <div className="flex gap-3">
        {v.frameTaken && (
          <button
            onClick={onZoom}
            title="See it bigger"
            className="group relative shrink-0 overflow-hidden rounded border border-[var(--color-line)] bg-black transition hover:border-[var(--color-brand)]/70"
          >
            <Poster answer={answer} sharpness={v.sharpness} reveal={over} width={208} />
            <span className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-[9px] tracking-[0.12em] text-white/70 uppercase opacity-0 transition group-hover:opacity-100">
              Enlarge
            </span>
          </button>
        )}

        <div className="min-w-0 flex-1 space-y-2">
          {v.plotTaken && <Plot answer={answer} />}

          {(v.frameOffered || v.plotOffered) && (
            <div className="flex flex-wrap gap-2">
              {v.frameOffered && (
                <TakeButton
                  onClick={() => onTake("frame")}
                  title="Show me the poster"
                  sub="Heavily pixelated, sharpens each guess"
                />
              )}
              {v.plotOffered && (
                <TakeButton
                  onClick={() => onTake("plot")}
                  title={v.frameTaken ? "Show the plot too" : "Show me the plot"}
                  sub="Synopsis, with the giveaways blacked out"
                />
              )}
            </div>
          )}

          {!v.frameOffered && !v.plotOffered && v.untilNext !== null && (
            <p className="text-[11px] text-[var(--color-muted)]">
              Another hint unlocks in {v.untilNext} guess{v.untilNext === 1 ? "" : "es"}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/** The dialog: the same poster, big enough to study. */
export default function HintPanel({ game, answer }: { game: GameState; answer: Movie }) {
  const v = hintView(game, answer);
  const over = game.status !== "playing";

  return (
    <div className="space-y-3">
      {v.frameTaken && (
        <figure className="overflow-hidden rounded border border-[var(--color-line)] bg-black">
          <Poster
            answer={answer}
            sharpness={v.sharpness}
            reveal={over}
            width={600}
            className="mx-auto block w-full max-w-[16rem] py-2"
          />
          <figcaption className="flex items-center justify-between gap-2 border-t border-[var(--color-line)] px-3 py-1.5 text-[11px] text-[var(--color-muted)]">
            <span>{over ? "The poster you were given" : "The film's poster"}</span>
            <span className="tabular-nums">
              {over
                ? "Revealed"
                : v.sharpness >= SHARPNESS.length - 1
                  ? "As clear as it gets"
                  : `Sharpens with each guess · ${v.sharpness + 1}/${SHARPNESS.length}`}
            </span>
          </figcaption>
        </figure>
      )}

      {v.plotTaken && <Plot answer={answer} />}

      {!v.frameTaken && !v.plotTaken && (
        <p className="text-sm text-[var(--color-muted)]">
          You have not taken a hint yet.
        </p>
      )}
    </div>
  );
}

function TakeButton({ onClick, title, sub }: { onClick: () => void; title: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className="nf-card group rounded border border-dashed border-[var(--color-line)] bg-[var(--color-card)] px-3 py-1.5 text-left transition hover:border-[var(--color-brand)]/60"
    >
      <span className="block text-sm font-semibold text-white/90 group-hover:text-white">
        {title}
      </span>
      <span className="block text-[11px] text-[var(--color-muted)]">{sub}</span>
    </button>
  );
}

/**
 * The poster, drawn through a tiny offscreen canvas so it pixelates in blocks
 * rather than blurring. `width` is the drawing buffer, not the layout size.
 */
function Poster({
  answer,
  sharpness,
  reveal,
  width,
  className,
}: {
  answer: Movie;
  sharpness: number;
  /** Draw it clean: the game is over. */
  reveal: boolean;
  width: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  // The poster is the hint. A backdrop only stands in for the rare film that
  // has no poster at all.
  const src = posterUrl(answer, "w500") ?? backdropUrl(answer, "w780");

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !src) return;

    let cancelled = false;
    const img = new Image();
    // No crossOrigin: the image is only ever drawn, never read back, so the
    // canvas may taint freely — and asking for CORS would fail the load
    // outright on a host that does not send the header.
    img.onload = () => {
      if (cancelled) return;

      // A poster is portrait, so the buffer is sized off the artwork rather
      // than assuming a landscape frame.
      canvas.width = width;
      canvas.height = Math.round((width * img.height) / img.width);

      if (reveal) {
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return;
      }

      const cols = SHARPNESS[Math.min(sharpness, SHARPNESS.length - 1)];
      const rows = Math.max(1, Math.round((cols * img.height) / img.width));

      const small = document.createElement("canvas");
      small.width = cols;
      small.height = rows;
      const sctx = small.getContext("2d");
      if (!sctx) return;
      sctx.drawImage(img, 0, 0, cols, rows);

      // Blown back up with smoothing off, which is what turns it into squares.
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
    };
    img.onerror = () => !cancelled && setFailed(true);
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src, sharpness, reveal, width]);

  if (!src || failed) return null;

  return <canvas ref={ref} aria-hidden className={className ?? "block w-[6.5rem]"} />;
}

function Plot({ answer }: { answer: Movie }) {
  if (!answer.overview) return null;
  const pieces = redactPlot(answer.overview, answer);

  return (
    <div>
      <p className="text-[13px] leading-relaxed text-[var(--color-fg)]/90">
        {pieces.map((p, i) =>
          p.hidden ? (
            <span
              key={i}
              // Blocks are readable as blocks: same width as the word they hide,
              // so their shape stays part of the clue.
              className="rounded-[2px] bg-[#3a3a3a] text-transparent select-none"
              aria-label="redacted"
            >
              {p.text}
            </span>
          ) : (
            <span key={i}>{p.text}</span>
          ),
        )}
      </p>
      <p className="mt-1 text-[10px] text-[var(--color-muted)]">
        Title, cast, crew and character names redacted.
      </p>
    </div>
  );
}

export { FRAME_AT };
