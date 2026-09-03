import type { LangCode } from "../lib/types";
import { LANGS } from "../lib/lang";
import type { Settings } from "../lib/storage";
import { ALL_MOVIES, DATA_SOURCE } from "../data/movies";
import { poolSize } from "../lib/puzzle";
import { PROFILE } from "../lib/profiles";

export default function SettingsPanel({
  settings,
  lang,
  onChange,
  onSwitchLanguage,
}: {
  settings: Settings;
  lang: LangCode;
  onChange: (s: Settings) => void;
  onSwitchLanguage: () => void;
}) {
  const n = poolSize(lang);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="display mb-1 text-lg">Industry</h3>
        <p className="mb-3 text-sm text-[var(--color-muted)]">
          You are playing the {LANGS[lang].name} puzzle. Every industry has its own film of the
          day and its own streak.
        </p>
        <button
          onClick={onSwitchLanguage}
          className="nf-card flex w-full items-center gap-4 rounded border border-[var(--color-line)] bg-[var(--color-card)] px-4 py-3 text-left"
        >
          <span
            aria-hidden
            className="grid size-12 shrink-0 place-items-center rounded text-sm font-semibold text-white/95"
            style={{ backgroundImage: PROFILE[lang].tint }}
          >
            {LANGS[lang].native.slice(0, 2)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="display block text-lg leading-tight">{LANGS[lang].name}</span>
            <span className="text-xs text-[var(--color-muted)]">
              {LANGS[lang].industry} · {n} film{n === 1 ? "" : "s"} in rotation
            </span>
          </span>
          <span className="shrink-0 rounded bg-white/15 px-3 py-1 text-xs font-semibold tracking-[0.1em] text-white uppercase">
            Switch
          </span>
        </button>
        {n < 30 && (
          <p className="mt-2 text-xs text-[var(--color-near-2)]">
            Only {n} films in this pool, so answers start repeating after {n} days. Loading the
            full TMDB dataset fixes that.
          </p>
        )}
      </div>

      <div>
        <h3 className="display mb-1 text-lg">Motion</h3>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.reduceMotion}
            onChange={(e) => onChange({ ...settings, reduceMotion: e.target.checked })}
            className="size-4 accent-[var(--color-brand)]"
          />
          Reduce motion — skip the opener and the tile flips
        </label>
      </div>

      <div className="border-t border-[var(--color-line)] pt-4 text-xs text-[var(--color-muted)]">
        {ALL_MOVIES.length} films loaded across five industries ·{" "}
        {DATA_SOURCE === "tmdb" ? (
          <>data from TMDB</>
        ) : (
          <>
            bundled demo set — run{" "}
            <code className="text-[var(--color-fg)]">npm run fetch:tmdb</code> for the full
            library
          </>
        )}
      </div>
    </div>
  );
}
