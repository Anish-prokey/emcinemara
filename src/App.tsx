import { useEffect, useMemo, useState } from "react";
import type { Comparison, GameState, LangCode, Movie, Stats } from "./lib/types";
import { compare } from "./lib/compare";
import { answerFor, dateKey, dayIndex, prettyDate, MAX_GUESSES } from "./lib/puzzle";
import { LANGS, isPlayable } from "./lib/lang";
import { getMovie } from "./data/movies";
import {
  loadGame,
  saveGame,
  loadStats,
  loadSettings,
  saveSettings,
  recordResult,
  hasSeenHowTo,
  markSeenHowTo,
  EMPTY_STATS,
  type Settings,
} from "./lib/storage";

import SearchBox from "./components/SearchBox";
import GuessCard from "./components/GuessCard";
import Modal from "./components/Modal";
import HowToPlay from "./components/HowToPlay";
import StatsPanel from "./components/StatsPanel";
import ArchivePanel from "./components/ArchivePanel";
import SettingsPanel from "./components/SettingsPanel";
import EndCard from "./components/EndCard";
import LanguagePicker from "./components/LanguagePicker";
import Ident from "./components/Ident";
import { shouldPlayIdent } from "./lib/ident";
import { PROFILE } from "./lib/profiles";
import ClueLegend from "./components/ClueLegend";
import Confetti from "./components/Confetti";
import HintPanel, { HintBar } from "./components/HintPanel";
import { usedAnyHint } from "./lib/hints";
import Wordmark from "./components/Wordmark";
import InstallPrompt from "./components/InstallPrompt";
import {
  HelpIcon,
  ArchiveIcon,
  StatsIcon,
  SettingsIcon,
  SoundOnIcon,
  SoundOffIcon,
  FlameIcon,
} from "./components/icons";
import { readings, type HeatReading } from "./lib/heat";
import { gradeFor, isMilestone } from "./lib/grade";
import * as sfx from "./lib/sound";

type ModalId = "how" | "stats" | "archive" | "settings" | "hints" | null;

function initialDay(): string {
  const p = new URLSearchParams(location.search).get("d");
  return p && /^\d{4}-\d{2}-\d{2}$/.test(p) ? p : dateKey();
}

/** A ?lang= in the URL wins, so a shared link opens the right industry. */
function initialLang(stored: LangCode | null): LangCode | null {
  const p = new URLSearchParams(location.search).get("lang");
  return p && isPlayable(p) ? p : stored;
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => {
    const s = loadSettings();
    return { ...s, lang: initialLang(s.lang) };
  });
  const [day, setDay] = useState(initialDay);
  const [picking, setPicking] = useState(false);
  const [modal, setModal] = useState<ModalId>(null);
  const [flash, setFlash] = useState<number | null>(null);
  /** Set only for a milestone crossed by the win that just happened. */
  const [milestone, setMilestone] = useState<number | null>(null);
  // `settings` is resolved above, so the saved reduce-motion choice suppresses
  // the opener too — not just the tile flips.
  const [ident, setIdent] = useState(() => shouldPlayIdent(loadSettings().reduceMotion));

  const lang = settings.lang;
  const today = dateKey();
  const isToday = day === today;

  const [game, setGame] = useState<GameState | null>(() =>
    settings.lang ? loadGame(settings.lang, initialDay()) : null,
  );
  const [stats, setStats] = useState<Stats>(() =>
    settings.lang ? loadStats(settings.lang) : EMPTY_STATS,
  );

  useEffect(() => {
    sfx.setMuted(!settings.sound);
  }, [settings.sound]);

  /* One switch for every animation, rather than each component deciding for
     itself — the looping ones were the easiest to forget. */
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", settings.reduceMotion);
  }, [settings.reduceMotion]);

  /* Browsers refuse to make a sound until the page has been interacted with,
     so the audio engine is started by the first gesture, whatever it is. */
  useEffect(() => {
    const go = () => sfx.unlock();
    window.addEventListener("pointerdown", go, { once: true });
    window.addEventListener("keydown", go, { once: true });
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
    };
  }, []);

  /* Reload the board whenever the language or the day changes. */
  useEffect(() => {
    if (!lang) return;
    setGame(loadGame(lang, day));
    setStats(loadStats(lang));
    setFlash(null);
    setMilestone(null);
  }, [lang, day]);

  /* Show the rules once, after the opener and the profile pick have cleared. */
  useEffect(() => {
    if (lang && !ident && !hasSeenHowTo()) setModal("how");
  }, [lang, ident]);

  useEffect(() => {
    try {
      const url = new URL(location.href);
      if (isToday) url.searchParams.delete("d");
      else url.searchParams.set("d", day);
      if (lang) url.searchParams.set("lang", lang);
      history.replaceState(null, "", url);
    } catch {
      // Some sandboxed hosts refuse history writes. The URL is a convenience
      // for sharing, so losing it must never take the board down with it.
    }
  }, [day, isToday, lang]);

  const answer = useMemo(() => (lang ? answerFor(lang, day) : null), [lang, day]);
  const guesses = useMemo(
    () => (game?.guesses ?? []).map(getMovie).filter((m): m is Movie => Boolean(m)),
    [game],
  );
  const comparisons = useMemo(
    () => (answer ? guesses.map((g) => compare(g, answer)) : []),
    [guesses, answer],
  );
  const heat = useMemo(() => readings(comparisons), [comparisons]);
  const guessedIds = useMemo(() => new Set(game?.guesses ?? []), [game]);

  if (!lang || !game || !answer) {
    return (
      <>
        {ident && <Ident onDone={() => setIdent(false)} />}
        <LanguagePicker
          current={null}
          onPick={(l) => {
            const next = { ...settings, lang: l };
            setSettings(next);
            saveSettings(next);
          }}
        />
      </>
    );
  }

  const over = game.status !== "playing";
  const remaining = MAX_GUESSES - game.guesses.length;
  const puzzleNum = dayIndex(day) + 1;

  function submit(m: Movie) {
    if (!lang || !game || !answer || over || guessedIds.has(m.id)) return;

    const nextGuesses = [...game.guesses, m.id];
    const won = m.id === answer.id;
    const lost = !won && nextGuesses.length >= MAX_GUESSES;
    const next: GameState = {
      ...game,
      day,
      lang,
      guesses: nextGuesses,
      status: won ? "won" : lost ? "lost" : "playing",
    };

    setGame(next);
    saveGame(next);
    setFlash(m.id);

    // Read the new guess before React re-renders, so the cues can be scheduled
    // against the same clock the tiles animate on.
    const c = compare(m, answer);
    const all = readings([...comparisons, c]);
    playGuess(c, all[all.length - 1], won, lost, MAX_GUESSES - nextGuesses.length);

    if ((won || lost) && isToday) {
      const s = recordResult(lang, day, won, nextGuesses.length);
      setStats(s);
      if (won && isMilestone(s.streak)) {
        setMilestone(s.streak);
        sfx.milestone();
      }
    }
  }

  /**
   * The audio for one guess, scheduled in a single pass.
   *
   * The cues are laid over the tile flips deliberately: ticks track the squares
   * as they turn, then a sweep whose landing pitch *is* the heat score, so the
   * result arrives in the ear a beat before it is read off the meter.
   */
  function playGuess(
    c: Comparison,
    r: HeatReading,
    won: boolean,
    lost: boolean,
    remainingAfter: number,
  ) {
    sfx.submit();

    const stagger = settings.reduceMotion ? 0 : 0.07;
    const ticks = revealOrder(c);
    ticks.forEach((state, i) => sfx.reveal(state, i, i * stagger));

    const settled = ticks.length * stagger + 0.12;
    sfx.verdict(r.heat, settled);

    if (!won && r.delta !== null && r.delta > 0) sfx.warmer(settled + 0.34);

    if (won) setTimeout(() => sfx.win(gradeFor(comparisons.length + 1).reach), (settled + 0.3) * 1000);
    else if (lost) setTimeout(() => sfx.lose(), (settled + 0.3) * 1000);
    else if (remainingAfter <= 2) sfx.tension(settled + 0.55);
  }

  /** Hints are part of the board: saved, restored on reload, shown on the result. */
  function takeHint(which: "frame" | "plot") {
    if (!game || over) return;
    const at = game.guesses.length;
    const next: GameState = {
      ...game,
      hints: {
        ...(game.hints ?? {}),
        ...(which === "frame" ? { frameAt: at } : { plotAt: at }),
      },
    };
    setGame(next);
    saveGame(next);
    sfx.hint();
  }

  function switchLanguage(l: LangCode) {
    const next = { ...settings, lang: l };
    setSettings(next);
    saveSettings(next);
    setPicking(false);
    setModal(null);
  }

  function updateSettings(s: Settings) {
    setSettings(s);
    saveSettings(s);
  }

  function closeModal() {
    if (modal === "how") markSeenHowTo();
    setModal(null);
  }

  const animate = !settings.reduceMotion;

  return (
    <div className="vignette min-h-full">
      {ident && <Ident onDone={() => setIdent(false)} />}

      {/* Padded clear of the status bar where the app is drawn edge to edge; the
          gradient behind it covers the bar itself. */}
      <header className="sticky top-0 z-20 pt-[var(--safe-top)] bg-gradient-to-b from-black via-black/92 to-transparent backdrop-blur-[2px]">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-2 py-3 sm:gap-3 sm:px-4">
          <button
            onClick={() => setDay(today)}
            title="Back to today"
            className="min-w-0 shrink text-left transition-transform hover:scale-[1.04]"
          >
            <Wordmark className="text-lg leading-none sm:text-3xl" />
          </button>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPicking(true)}
              title="Switch profile"
              className="nf-tile flex items-center gap-2 rounded px-1 py-0.5"
            >
              <span
                aria-hidden
                className="nf-avatar grid size-8 place-items-center rounded text-[13px] font-semibold text-white/95"
                style={{ backgroundImage: PROFILE[lang].tint }}
              >
                {LANGS[lang].native.slice(0, 2)}
              </span>
              <span className="hidden text-sm text-[var(--color-muted)] sm:inline">
                {LANGS[lang].name}
              </span>
              <span className="hidden text-[10px] text-[var(--color-muted)] sm:inline">▼</span>
            </button>

            {stats.streak > 0 && (
              <button
                onClick={() => setModal("stats")}
                title={`${stats.streak}-day ${LANGS[lang].name} streak — best ${stats.best}`}
                className="flex shrink-0 items-center gap-0.5 rounded-full border border-[var(--color-brand)]/40 bg-[var(--color-brand)]/12 px-1.5 py-1 text-[var(--color-brand-glow)] transition hover:bg-[var(--color-brand)]/25 sm:gap-1 sm:px-2"
              >
                <span className={animate ? "flame" : ""}>
                  <FlameIcon />
                </span>
                <span className="text-xs font-bold tabular-nums">{stats.streak}</span>
              </button>
            )}

            <nav className="flex items-center gap-0.5">
              <IconBtn
                label={settings.sound ? "Mute" : "Unmute"}
                onClick={() => {
                  sfx.unlock();
                  updateSettings({ ...settings, sound: !settings.sound });
                }}
              >
                {settings.sound ? <SoundOnIcon /> : <SoundOffIcon />}
              </IconBtn>
              <IconBtn label="How to play" onClick={() => setModal("how")}>
                <HelpIcon />
              </IconBtn>
              <IconBtn label="Archive" onClick={() => setModal("archive")}>
                <ArchiveIcon />
              </IconBtn>
              <IconBtn label="Stats" onClick={() => setModal("stats")}>
                <StatsIcon />
              </IconBtn>
              <IconBtn label="Settings" onClick={() => setModal("settings")}>
                <SettingsIcon />
              </IconBtn>
            </nav>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-2xl px-3 pt-3 pb-[calc(6rem_+_var(--safe-bottom))] sm:px-4">
        <div className="fade-up mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.3em] text-[var(--color-brand)] uppercase">
              {isToday ? "Today" : "Rewatch"}
            </span>
            <span className="rule-red h-[2px] w-14 rounded-full" />
            <span className="text-[10px] tracking-[0.2em] text-[var(--color-muted)] uppercase">
              {LANGS[lang].name} · Episode {puzzleNum}
            </span>
          </div>

          <h1 className="display mt-1.5 text-3xl leading-none sm:text-4xl">Guess the film</h1>
          <p className="mt-1 text-xs text-[var(--color-muted)]">{prettyDate(day)}</p>

          <Progress
            used={game.guesses.length}
            total={MAX_GUESSES}
            status={game.status}
            urgent={!over && remaining <= 2 && animate}
          />
        </div>

        <div className="mb-4">
          <SearchBox
            onPick={submit}
            disabled={over}
            exclude={guessedIds}
            lang={lang}
            remaining={remaining}
          />
        </div>

        <ClueLegend onOpenHelp={() => setModal("how")} />

        {/* Only once they have actually played a little — nobody should be
            asked to install a game they have not tried. */}
        <InstallPrompt ready={game.guesses.length >= 3} />

        <HintBar
          game={game}
          answer={answer}
          onTake={takeHint}
          onZoom={() => setModal("hints")}
          animate={animate}
        />

        {/* Only for a win that just happened: reloading a finished board must
            not re-throw confetti at a puzzle solved days ago. Rendered outside
            EndCard, whose entry animation would otherwise clip it. */}
        {game.status === "won" && flash !== null && (
          <Confetti
            reduceMotion={settings.reduceMotion}
            intensity={gradeFor(comparisons.length).reach}
          />
        )}

        {over && (
          <EndCard
            won={game.status === "won"}
            answer={answer}
            comparisons={comparisons}
            puzzleNum={puzzleNum}
            isToday={isToday}
            lang={lang}
            onStats={() => setModal("stats")}
            streak={isToday ? stats.streak : 0}
            milestone={milestone}
            usedHint={usedAnyHint(game)}
            animate={animate && flash !== null}
          />
        )}

        {comparisons.length === 0 ? (
          <EmptyState lang={lang} onHow={() => setModal("how")} />
        ) : (
          <ul className="space-y-3">
            {comparisons
              .map((c, i) => ({ c, i }))
              .reverse()
              .map(({ c, i }) => (
                <GuessCard
                  key={`${c.movie.id}-${i}`}
                  c={c}
                  index={i}
                  latest={i === comparisons.length - 1}
                  animate={animate && c.movie.id === flash}
                  reading={heat[i]}
                />
              ))}
          </ul>
        )}
      </main>

      {picking && (
        <LanguagePicker current={lang} onPick={switchLanguage} onCancel={() => setPicking(false)} />
      )}

      {modal === "how" && (
        <Modal title="How to play" onClose={closeModal}>
          <HowToPlay lang={lang} />
        </Modal>
      )}
      {modal === "stats" && (
        <Modal title="Statistics" onClose={closeModal}>
          <StatsPanel stats={stats} lang={lang} />
        </Modal>
      )}
      {modal === "archive" && (
        <Modal title="Rewatch" onClose={closeModal}>
          <ArchivePanel
            current={day}
            lang={lang}
            onPlay={(k) => {
              setDay(k);
              setModal(null);
            }}
          />
        </Modal>
      )}
      {modal === "hints" && (
        <Modal title="Your hints" onClose={closeModal}>
          <HintPanel game={game} answer={answer} />
        </Modal>
      )}
      {modal === "settings" && (
        <Modal title="Settings" onClose={closeModal}>
          <SettingsPanel
            settings={settings}
            lang={lang}
            onChange={updateSettings}
            onSwitchLanguage={() => {
              setModal(null);
              setPicking(true);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

/**
 * The squares a tick is played for, in the order the eye meets them.
 *
 * Cast and genres collapse to one tick each rather than ten: the full set fired
 * as a burst reads as a rattle, not as feedback. The group tick reports the
 * best square in the group, which is the one that matters.
 */
function revealOrder(c: Comparison): ("hit" | "near" | "miss")[] {
  const best = (tiles: { state: "hit" | "near" | "miss" }[]) =>
    tiles.some((t) => t.state === "hit")
      ? "hit"
      : tiles.some((t) => t.state === "near")
        ? "near"
        : "miss";

  const out: ("hit" | "near" | "miss")[] = [c.year.state, c.score.state];
  if (c.cert) out.push(c.cert.state);
  if (c.runtime) out.push(c.runtime.state);
  out.push(c.director.state, c.music.state, best(c.cast), best(c.genres));
  return out;
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-7 shrink-0 place-items-center rounded text-base text-[var(--color-muted)] transition hover:scale-110 hover:text-white sm:size-9"
    >
      {children}
    </button>
  );
}

/** The scrub bar under a Netflix title card: red fill on a grey track. */
function Progress({
  used,
  total,
  status,
  urgent,
}: {
  used: number;
  total: number;
  status: string;
  /** Down to the last couple of guesses — the bar starts breathing. */
  urgent?: boolean;
}) {
  const fill =
    status === "won"
      ? "var(--color-hit-2)"
      : status === "lost"
        ? "#6d6d6d"
        : "var(--color-brand)";
  return (
    <div className="mt-3 flex items-center gap-3">
      <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-[#404040]">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ease-out ${urgent ? "tension" : ""}`}
          style={{ width: `${(used / total) * 100}%`, background: fill }}
        />
      </div>
      <span
        className={`text-[11px] tabular-nums ${
          urgent ? "font-bold text-[var(--color-brand-glow)]" : "text-[var(--color-muted)]"
        }`}
      >
        {urgent ? `${total - used} left` : `${used} of ${total}`}
      </span>
    </div>
  );
}

function EmptyState({ lang, onHow }: { lang: LangCode; onHow: () => void }) {
  return (
    <div className="fade-up rounded border border-dashed border-[var(--color-line)] bg-[var(--color-card)]/40 px-4 py-12 text-center">
      <p className="display text-3xl text-white/90">Start watching.</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--color-muted)]">
        Type any {LANGS[lang].name} film above. The clues will tell you how close you landed —
        year, rating, certificate, director, music, cast and genre.
      </p>
      <button
        onClick={onHow}
        className="mt-4 rounded bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-white/85"
      >
        ▶  How it works
      </button>
    </div>
  );
}
