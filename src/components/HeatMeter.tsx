import { useEffect, useState } from "react";
import type { HeatReading } from "../lib/heat";

/**
 * The "am I getting warmer" strip at the top of every guess.
 *
 * This is the piece that gives the nine losing guesses something to pay out.
 * Before it, a guess that moved you from hopeless to nearly-there looked
 * identical to one that told you nothing — you had to diff eight clue groups
 * in your head to notice.
 */
export default function HeatMeter({
  reading,
  animate,
  correct,
}: {
  reading: HeatReading;
  animate: boolean;
  correct: boolean;
}) {
  const { heat, band, delta, best } = reading;

  // Fill from empty on arrival so the bar visibly travels to its mark. Older
  // cards and reduce-motion get the final width directly, with no journey.
  const [armed, setArmed] = useState(!animate);
  useEffect(() => {
    if (!animate) return;
    const t = setTimeout(() => setArmed(true), 60);
    return () => clearTimeout(t);
  }, [animate]);
  const shown = armed || !animate ? heat : 0;

  const colour = correct ? "var(--color-hit-2)" : band.color;

  return (
    <div className="mb-2.5">
      <div className="mb-1 flex items-center gap-2">
        <span
          className="text-[11px] font-bold tracking-[0.18em] uppercase"
          style={{ color: colour }}
        >
          {correct ? "Match" : band.label}
        </span>

        <span className="text-[11px] font-semibold tabular-nums text-[var(--color-muted)]">
          {heat}
        </span>

        {/* Only ever shown when it is good news. A "colder" chip on a guess you
            already know was bad is a kick, not information. */}
        {!correct && delta !== null && delta > 0 && (
          <span
            className={`rounded-full px-1.5 py-px text-[10px] font-bold tabular-nums ${
              animate ? "pop" : ""
            }`}
            style={{ background: `${colour}22`, color: colour }}
          >
            ▲ {delta} warmer
          </span>
        )}

        {!correct && best && delta !== null && (
          <span className="text-[10px] font-semibold tracking-[0.12em] text-white/70 uppercase">
            Closest yet
          </span>
        )}
      </div>

      <div className="h-[5px] overflow-hidden rounded-full bg-[#2a2a2a]">
        <div
          className={`h-full rounded-full ${animate ? "transition-[width] duration-[900ms] ease-out" : ""} ${
            heat >= 75 && !correct ? "heat-glow" : ""
          }`}
          style={{
            width: `${Math.max(shown, 2)}%`,
            background: correct
              ? "var(--color-hit-2)"
              : `linear-gradient(90deg, ${band.color}88, ${band.color})`,
          }}
        />
      </div>
    </div>
  );
}
