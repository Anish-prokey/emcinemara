import { useEffect, useState } from "react";
import type { Comparison, LangCode, Movie } from "../lib/types";
import { shareRow } from "../lib/compare";
import { MAX_GUESSES, formatCountdown, msUntilNextPuzzle } from "../lib/puzzle";
import { CERT_LABEL, LANGS } from "../lib/lang";
import Poster from "./Poster";

export default function EndCard({
  won,
  answer,
  comparisons,
  puzzleNum,
  isToday,
  lang,
  onStats,
}: {
  won: boolean;
  answer: Movie;
  comparisons: Comparison[];
  puzzleNum: number;
  isToday: boolean;
  lang: LangCode;
  onStats: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [left, setLeft] = useState(msUntilNextPuzzle());

  useEffect(() => {
    if (!isToday) return;
    const t = setInterval(() => setLeft(msUntilNextPuzzle()), 1000);
    return () => clearInterval(t);
  }, [isToday]);

  const scoreLine = won ? `${comparisons.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
  const text =
    `Filmi ${LANGS[lang].name} #${puzzleNum} ${scoreLine}\n` +
    comparisons.map(shareRow).join("\n") +
    `\n${location.origin}`;

  async function share() {
    try {
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="pop mb-4 overflow-hidden rounded border border-[var(--color-line)] bg-gradient-to-b from-[#1f1f1f] to-[var(--color-card)] p-4">
      <div className="mb-1 flex items-center gap-2">
        <span
          className={`text-[11px] font-bold tracking-[0.18em] uppercase ${
            won ? "text-[var(--color-hit-2)]" : "text-[var(--color-muted)]"
          }`}
        >
          {won ? `${Math.round((1 - (comparisons.length - 1) / MAX_GUESSES) * 100)}% Match` : "No match"}
        </span>
        {answer.cert !== "NR" && (
          <span className="rounded border border-[#5a5a5a] px-1.5 text-[10px] text-[var(--color-muted)]">
            {CERT_LABEL[answer.cert]}
          </span>
        )}
      </div>

      <div className="display text-3xl">
        {won ? "Picture perfect." : "Cut. That is a wrap."}
      </div>
      <p className="mt-1 text-sm text-[var(--color-muted)]">
        {won
          ? `Nailed it in ${comparisons.length} ${comparisons.length === 1 ? "guess" : "guesses"}.`
          : `Ten guesses gone. The film was:`}
      </p>

      {/* Poster beside the title on every size, but the credit list drops below
          it on a phone — sharing that row leaves the cast about 160px wide,
          which wraps a five-name list into five lines. */}
      <div className="mt-3 grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-2.5 rounded border border-[var(--color-line)] bg-black/50 p-3 sm:grid-cols-[8rem_1fr] sm:gap-x-4">
        <Poster movie={answer} eager className="self-start sm:row-span-2" />

        <div className="min-w-0 self-center sm:self-start">
          <div className="display text-2xl [text-wrap:balance]">{answer.title}</div>
          {answer.original && (
            <div className="text-sm text-[var(--color-muted)]">{answer.original}</div>
          )}
          <div className="mt-1 text-sm text-[var(--color-fg)]/80">
            {answer.year} · {LANGS[answer.lang].name}
            {answer.cert !== "NR" ? ` · ${CERT_LABEL[answer.cert]}` : ""} · ★{" "}
            {answer.score.toFixed(1)}
            {answer.runtime ? ` · ${Math.floor(answer.runtime / 60)}h ${answer.runtime % 60}m` : ""}
          </div>
        </div>

        <dl className="col-span-2 min-w-0 space-y-0.5 text-sm sm:col-span-1">
          <Line k="Director" v={answer.director} />
          <Line k="Music" v={answer.music} />
          <Line k="Cast" v={answer.cast.join(", ")} />
          <Line k="Genres" v={answer.genres.join(", ")} />
        </dl>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={share}
          className="rounded bg-white px-5 py-2 text-sm font-bold text-black transition hover:bg-white/85"
        >
          {copied ? "Copied!" : "Share result"}
        </button>
        <button
          onClick={onStats}
          className="rounded bg-white/15 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/25"
        >
          Stats
        </button>
      </div>

      {isToday && (
        <p className="mt-3 text-xs tracking-[0.12em] text-[var(--color-muted)] uppercase">
          Next film in {formatCountdown(left)}
        </p>
      )}
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-16 shrink-0 text-[10px] tracking-[0.14em] text-[var(--color-muted)] uppercase">
        {k}
      </dt>
      <dd className="min-w-0 flex-1">{v}</dd>
    </div>
  );
}
