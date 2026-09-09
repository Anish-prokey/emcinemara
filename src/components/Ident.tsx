import { useEffect } from "react";
import { markIdentShown } from "../lib/ident";

/**
 * The opener: red light-bars rack up behind the wordmark, the letters wipe in,
 * then the whole thing blows out. Purely visual — no audio, since an autoplaying
 * sting is hostile on a page you land on cold.
 *
 * Plays once per browser tab, and never when the visitor asks for reduced motion
 * (see lib/ident.ts for that gate).
 *
 * Bar offsets from centre, in rem. Mirrored pairs share a delay so the rack-up
 * reads as symmetric rather than sweeping in from the left.
 */
const BARS = [-13, -9.5, -6.5, -4, 4, 6.5, 9.5, 13];
const RANK = [...new Set(BARS.map(Math.abs))].sort((a, b) => b - a);
const delayFor = (offset: number) => RANK.indexOf(Math.abs(offset)) * 90;

export default function Ident({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    markIdentShown();
    const t = setTimeout(onDone, 2100);
    const skip = () => {
      clearTimeout(t);
      onDone();
    };
    window.addEventListener("keydown", skip);
    window.addEventListener("pointerdown", skip);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", skip);
      window.removeEventListener("pointerdown", skip);
    };
  }, [onDone]);

  return (
    <div
      className="ident-shell fixed inset-0 z-[100] grid place-items-center overflow-hidden bg-black"
      role="presentation"
      aria-hidden
    >
      {/* light bars racking up behind the word */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        {BARS.map((offset) => (
          <span
            key={offset}
            className="ident-bar absolute h-[60vh] w-[3px] rounded-full bg-[var(--color-brand)]"
            style={{
              left: `calc(50% + ${offset}rem)`,
              animationDelay: `${delayFor(offset)}ms`,
              opacity: 0.55,
              boxShadow: "0 0 26px 5px rgba(229,9,20,.55)",
            }}
          />
        ))}
      </div>

      {/* the blowout flash at the moment the letters land */}
      <div className="ident-flash pointer-events-none absolute inset-0 bg-[radial-gradient(50%_40%_at_50%_50%,rgba(255,60,70,.9),transparent_70%)]" />

      <h1 className="ident-word wordmark relative z-10 text-[clamp(1.6rem,8vw,6rem)] leading-none">
        EMCINEMARA
      </h1>

      <p className="absolute bottom-10 text-[11px] tracking-[0.35em] text-[var(--color-muted)] uppercase">
        Tap to skip
      </p>
    </div>
  );
}
