import { useEffect, useMemo, useRef, useState } from "react";
import type { LangCode, Movie } from "../lib/types";
import { searchMovies } from "../lib/search";
import { LANGS } from "../lib/lang";

export default function SearchBox({
  onPick,
  disabled,
  exclude,
  lang,
  remaining,
}: {
  onPick: (m: Movie) => void;
  disabled: boolean;
  exclude: Set<number>;
  lang: LangCode;
  remaining: number;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [shake, setShake] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchMovies(q, lang, 8, exclude), [q, lang, exclude]);

  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(m: Movie) {
    onPick(m);
    setQ("");
    setOpen(false);
    inputRef.current?.focus();
  }

  function reject() {
    setShake(true);
    setTimeout(() => setShake(false), 350);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && results[active]) pick(results[active]);
      else reject();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className={`relative ${shake ? "shake" : ""}`}>
      <div className="flex items-center gap-2 rounded border border-[#4a4a4a] bg-black/70 px-3 py-2.5 transition-colors focus-within:border-white">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" className="shrink-0 opacity-50">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          value={q}
          disabled={disabled}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={
            disabled ? "Puzzle complete" : `Guess ${/^[aeiou]/i.test(LANGS[lang].name) ? "an" : "a"} ${LANGS[lang].name} film — ${remaining} left`
          }
          aria-label="Search for a movie"
          aria-autocomplete="list"
          aria-expanded={open && results.length > 0}
          className="w-full bg-transparent text-[15px] outline-none placeholder:text-[var(--color-muted)] disabled:opacity-50"
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="Clear" className="shrink-0 text-[var(--color-muted)] hover:text-[var(--color-fg)]">
            ✕
          </button>
        )}
      </div>

      {open && q.trim() !== "" && (
        <ul
          role="listbox"
          className="pop absolute z-30 mt-1.5 max-h-80 w-full overflow-y-auto rounded border border-[var(--color-line)] bg-[var(--color-bg-2)] py-1 shadow-2xl shadow-black/80"
        >
          {results.length === 0 && (
            <li className="px-3 py-3 text-sm text-[var(--color-muted)]">
              No {LANGS[lang].name} film matches that. Try another spelling — only{" "}
              {LANGS[lang].name} titles are guessable in this puzzle.
            </li>
          )}
          {results.map((m, i) => (
            <li key={m.id} role="option" aria-selected={i === active}>
              <button
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(m)}
                className={`flex w-full items-center justify-between gap-3 border-l-[3px] px-3 py-2 text-left transition-colors ${
                  i === active
                    ? "border-[var(--color-brand)] bg-white/[0.07]"
                    : "border-transparent"
                }`}
              >
                <span className="truncate text-sm font-medium">{m.title}</span>
                <span className="shrink-0 text-xs text-[var(--color-muted)]">{m.year}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
