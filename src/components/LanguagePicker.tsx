import type { LangCode } from "../lib/types";
import { LANGS, PLAYABLE } from "../lib/lang";
import { PROFILE } from "../lib/profiles";
import Wordmark from "./Wordmark";

export default function LanguagePicker({
  current,
  onPick,
  onCancel,
}: {
  current: LangCode | null;
  onPick: (l: LangCode) => void;
  /** Only offered when the player already has a language — first run is a hard gate. */
  onCancel?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black">
      <div className="mx-auto flex min-h-full max-w-4xl flex-col justify-center px-4 py-12">
        <div className="fade-up mb-10 text-center">
          <Wordmark className="text-3xl leading-none sm:text-5xl" />
          <p className="mt-2 text-[11px] tracking-[0.18em] text-[#6d6d6d] uppercase">
            what movie?
          </p>
          <h1 className="mt-8 text-3xl font-normal text-white sm:text-5xl">
            Who&rsquo;s watching?
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-[var(--color-muted)]">
            Every industry runs its own puzzle — a different film each day, its own streak. Switch
            profiles any time.
          </p>
        </div>

        {/* Sized so all five sit on one row from the small breakpoint up,
            the way Netflix lays profiles out. */}
        <ul className="flex flex-wrap justify-center gap-4 sm:gap-6">
          {PLAYABLE.map((code, i) => {
            const l = LANGS[code];
            const isCurrent = code === current;
            return (
              <li key={code} className="fade-up" style={{ animationDelay: `${120 + i * 70}ms` }}>
                <button
                  onClick={() => onPick(code)}
                  aria-current={isCurrent || undefined}
                  className="nf-tile block w-[6.5rem] text-center sm:w-[8.5rem]"
                >
                  <span
                    className="nf-avatar grid aspect-square w-full place-items-center rounded-md"
                    style={{
                      backgroundImage: PROFILE[code].tint,
                      boxShadow: isCurrent ? "inset 0 0 0 3px #fff" : undefined,
                    }}
                  >
                    <span
                      aria-hidden
                      className="px-1.5 text-center leading-tight font-semibold text-white/95"
                      style={{ fontSize: PROFILE[code].size }}
                    >
                      {l.native}
                    </span>
                  </span>
                  <span className="nf-label mt-3 block text-[15px] text-[var(--color-muted)] transition-colors sm:text-base">
                    {l.name}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[#6d6d6d]">
                    {l.industry}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {onCancel && (
          <button
            onClick={onCancel}
            className="fade-up mx-auto mt-12 border border-[#5a5a5a] px-6 py-2 text-sm tracking-[0.16em] text-[var(--color-muted)] uppercase transition hover:border-white hover:text-white"
            style={{ animationDelay: "500ms" }}
          >
            Back
          </button>
        )}

        <p className="mt-10 text-center text-xs text-[#6d6d6d]">
          Progress is kept separately for each profile — switching never wipes a streak.
        </p>
      </div>
    </div>
  );
}
