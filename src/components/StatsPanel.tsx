import type { LangCode, Stats } from "../lib/types";
import { MAX_GUESSES } from "../lib/puzzle";
import { LANGS } from "../lib/lang";

export default function StatsPanel({ stats, lang }: { stats: Stats; lang: LangCode }) {
  const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const max = Math.max(1, ...Object.values(stats.dist));

  return (
    <div className="space-y-6">
      <p className="text-sm text-[var(--color-muted)]">
        Your {LANGS[lang].name} record. Each industry is scored separately.
      </p>

      <div className="grid grid-cols-4 gap-2 text-center">
        <Stat n={stats.played} label="Played" />
        <Stat n={`${winPct}%`} label="Win rate" />
        <Stat n={stats.streak} label="Streak" />
        <Stat n={stats.best} label="Best" />
      </div>

      <div>
        <h3 className="display mb-2 text-lg">Guess distribution</h3>
        {stats.wins === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No wins logged yet.</p>
        ) : (
          <div className="space-y-1">
            {Array.from({ length: MAX_GUESSES }, (_, i) => i + 1).map((n) => {
              const v = stats.dist[n] ?? 0;
              return (
                <div key={n} className="flex items-center gap-2 text-xs">
                  <span className="w-4 text-right text-[var(--color-muted)]">{n}</span>
                  <div className="h-5 flex-1 rounded-sm bg-[#2a2a2a]">
                    <div
                      className="flex h-5 items-center justify-end rounded-sm bg-[var(--color-brand)] px-1.5 font-semibold text-white transition-[width] duration-500"
                      style={{ width: `${Math.max(v ? 8 : 0, (v / max) * 100)}%` }}
                    >
                      {v > 0 && v}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="rounded border border-[var(--color-line)] bg-[var(--color-card)] py-2">
      <div className="display text-2xl text-white">{n}</div>
      <div className="text-[10px] tracking-[0.12em] text-[var(--color-muted)] uppercase">{label}</div>
    </div>
  );
}
