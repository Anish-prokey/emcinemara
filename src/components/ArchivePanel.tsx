import type { LangCode } from "../lib/types";
import { archiveDays, dateKey } from "../lib/puzzle";
import { loadGame } from "../lib/storage";
import { LANGS } from "../lib/lang";

export default function ArchivePanel({
  onPlay,
  current,
  lang,
}: {
  onPlay: (key: string) => void;
  current: string;
  lang: LangCode;
}) {
  const today = dateKey();
  const days = archiveDays();

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-muted)]">
        Replay any of the last {days.length} {LANGS[lang].name} puzzles. These don't affect your
        streak.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {days.map(({ key, num }) => {
          const g = loadGame(lang, key);
          const done = g.status !== "playing";
          const won = g.status === "won";
          return (
            <button
              key={key}
              onClick={() => onPlay(key)}
              className={`nf-card rounded border px-3 py-2 text-left ${
                key === current
                  ? "border-[var(--color-brand)] bg-[var(--color-brand)]/12"
                  : "border-[var(--color-line)] bg-[var(--color-card)]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="display text-lg">#{num}</span>
                <span className="text-sm">{done ? (won ? "✅" : "❌") : g.guesses.length ? "⋯" : ""}</span>
              </div>
              <div className="text-[11px] text-[var(--color-muted)]">
                {key === today ? "Today" : key}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
