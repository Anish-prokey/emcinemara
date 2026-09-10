import { useEffect, useRef, useState } from "react";
import type { GameState, Movie } from "../lib/types";
import { backdropUrl, posterUrl } from "../lib/poster";
import { hintView, hintsOf, redactPlot, SHARPNESS, FRAME_AT } from "../lib/hints";

/**
 * The two hints, and the offers to take them.
 *
 * Nothing here appears until the board has actually stopped helping, and
 * nothing reveals itself without being asked for.
 */
export default function HintPanel({
  game,
  answer,
  onTake,
  animate,
}: {
  game: GameState;
  answer: Movie;
  onTake: (which: "frame" | "plot") => void;
  animate: boolean;
}) {
  const v = hintView(game, answer);
  const h = hintsOf(game);
  const nothingToShow =
    !v.frameOffered && !v.plotOffered && !v.frameTaken && !v.plotTaken && v.untilNext === null;
  if (nothingToShow) return null;

  return (
    <div className={`mb-4 ${animate ? "fade-up" : ""}`}>
      {(v.frameTaken || v.plotTaken) && (
        <div className="mb-1.5 text-[10px] font-bold tracking-[0.28em] text-[var(--color-muted)] uppercase">
          Hints
        </div>
      )}

      {v.frameTaken && (
        <FrameHint
          answer={answer}
          sharpness={v.sharpness}
          atMax={v.sharpness >= SHARPNESS.length - 1}
          // Once the board is finished the blocks have no job left to do, so
          // the still resolves. Winning on the guess right after taking the
          // hint used to leave it frozen at its coarsest, which meant never
          // getting to see what you had been squinting at.
          reveal={game.status !== "playing"}
        />
      )}

      {v.plotTaken && <PlotHint answer={answer} />}

      <div className="flex flex-wrap items-center gap-2">
        {v.frameOffered && (
          <HintButton
            onClick={() => onTake("frame")}
            title="Show me the poster"
            sub="The film's poster, heavily pixelated"
          />
        )}
        {v.plotOffered && (
          <HintButton
            onClick={() => onTake("plot")}
            title={v.frameTaken ? "Show the plot too" : "Show me the plot"}
            sub="The synopsis, with the giveaways blacked out"
          />
        )}
        {!v.frameOffered && !v.plotOffered && v.untilNext !== null && (
          <p className="text-xs text-[var(--color-muted)]">
            {h.frameAt !== undefined ? "Another hint" : "A hint"} unlocks in {v.untilNext} guess
            {v.untilNext === 1 ? "" : "es"}.
          </p>
        )}
      </div>
    </div>
  );
}

function HintButton({ onClick, title, sub }: { onClick: () => void; title: string; sub: string }) {
  return (
    <button
      onClick={onClick}
      className="nf-card group rounded border border-dashed border-[var(--color-line)] bg-[var(--color-card)]/60 px-3 py-2 text-left transition hover:border-[var(--color-brand)]/60 hover:bg-[var(--color-card)]"
    >
      <span className="block text-sm font-semibold text-white/90 group-hover:text-white">
        {title}
      </span>
      <span className="block text-[11px] text-[var(--color-muted)]">{sub}</span>
    </button>
  );
}

/** The poster, drawn through a tiny offscreen canvas so it pixelates in blocks. */
function FrameHint({
  answer,
  sharpness,
  atMax,
  reveal,
}: {
  answer: Movie;
  sharpness: number;
  atMax: boolean;
  /** Draw it clean: the game is over. */
  reveal: boolean;
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

      // A poster is portrait, so the drawing buffer is sized off the artwork
      // rather than assuming a landscape frame.
      canvas.width = 600;
      canvas.height = Math.round((600 * img.height) / img.width);

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

      // Blow the thumbnail back up with smoothing off, which is what turns it
      // into squares rather than a blur.
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
    };
    img.onerror = () => !cancelled && setFailed(true);
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src, sharpness, reveal]);

  if (!src || failed) return null;

  return (
    <figure className="mb-2.5 overflow-hidden rounded border border-[var(--color-line)] bg-black">
      {/* Constrained and centred: a full-width portrait poster would be taller
          than the screen and push the board out of sight. */}
      <canvas ref={ref} aria-hidden className="mx-auto block w-full max-w-[15rem] py-2" />
      <figcaption className="flex items-center justify-between gap-2 px-3 py-1.5 text-[11px] text-[var(--color-muted)]">
        <span>{reveal ? "The poster you were given" : "The film's poster"}</span>
        <span className="tabular-nums">
          {reveal
            ? "Revealed"
            : atMax
              ? "As clear as it gets"
              : `Sharpens with each guess · ${sharpness + 1}/${SHARPNESS.length}`}
        </span>
      </figcaption>
    </figure>
  );
}

function PlotHint({ answer }: { answer: Movie }) {
  if (!answer.overview) return null;
  const pieces = redactPlot(answer.overview, answer);

  return (
    <div className="mb-2.5 rounded border border-[var(--color-line)] bg-[var(--color-card)] px-3 py-2.5">
      <p className="text-sm leading-relaxed text-[var(--color-fg)]/90">
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
      <p className="mt-1.5 text-[11px] text-[var(--color-muted)]">
        Title, cast, crew and character names redacted.
      </p>
    </div>
  );
}

export { FRAME_AT };
