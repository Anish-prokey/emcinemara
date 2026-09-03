/**
 * A permanent one-line key to the colours, sitting with the board.
 *
 * The explainer modal is shown once and then has to be hunted for, which is no
 * use at the moment a player is actually staring at a gold tile wondering what
 * it means. This keeps the answer in view and offers the full rules one tap away.
 */
export default function ClueLegend({ onOpenHelp }: { onOpenHelp: () => void }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-[var(--color-muted)]">
      <Swatch className="bg-[var(--color-hit)] border-[var(--color-hit-2)]">Exact</Swatch>
      <Swatch className="bg-[var(--color-near)] border-[var(--color-near-2)]">Close</Swatch>
      <Swatch className="bg-[var(--color-miss)] border-[var(--color-line)]">No match</Swatch>

      <button
        onClick={onOpenHelp}
        className="ml-auto rounded text-[11px] font-medium text-white/80 underline decoration-[var(--color-brand)] decoration-2 underline-offset-4 transition hover:text-white"
      >
        What the clues mean
      </button>
    </div>
  );
}

function Swatch({ className, children }: { className: string; children: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block size-3 rounded-[3px] border ${className}`} aria-hidden />
      {children}
    </span>
  );
}
