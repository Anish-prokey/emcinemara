import type { LangCode } from "../lib/types";
import { MAX_GUESSES } from "../lib/puzzle";
import { LANGS } from "../lib/lang";
import { DATA_SOURCE } from "../data/movies";
import { FRAME_AT } from "../lib/hints";

function Swatch({ cls, children }: { cls: string; children: string }) {
  return (
    <span className={`mr-2 inline-block rounded border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {children}
    </span>
  );
}

export default function HowToPlay({ lang }: { lang: LangCode }) {
  const hasRuntime = DATA_SOURCE === "tmdb";

  return (
    <div className="space-y-5 text-sm leading-relaxed text-[var(--color-fg)]/85">
      <p>
        One {LANGS[lang].name} film a day. You get <strong>{MAX_GUESSES} guesses</strong>, and
        every guess flips a row of clues showing how close you are.
      </p>

      <div className="space-y-2">
        <h3 className="display text-lg text-[var(--color-fg)]">The colours</h3>
        <p>
          <Swatch cls="bg-[var(--color-hit)] border-[var(--color-hit-2)] text-white">Green</Swatch>
          exact match.
        </p>
        <p>
          <Swatch cls="bg-[var(--color-near)] border-[var(--color-near-2)] text-[#1b1403]">Gold</Swatch>
          close — right neighbourhood, wrong answer.
        </p>
        <p>
          <Swatch cls="bg-[var(--color-miss)] border-[var(--color-line)]">Grey</Swatch>
          no match.
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="display text-lg text-[var(--color-fg)]">What each clue means</h3>
        <ul className="space-y-1.5">
          <Row k="Year">Release year. ▲ means the answer is later, ▼ earlier. Gold = within 5 years.</Row>
          <Row k="Rating">TMDB user rating out of 10. ▲/▼ point toward the answer. Gold = within 0.4.</Row>
          <Row k="Certificate">CBFC certificate: U, U/A or A. Gold = one step away.</Row>
          {hasRuntime && <Row k="Runtime">How long the film runs. ▲/▼ point toward the answer. Gold = within 10 minutes.</Row>}
          <Row k="Director">Gold if that person is credited on the answer in some other role.</Row>
          <Row k="Music">The music director. Same gold rule as above.</Row>
          <Row k="Cast">
            Lead plus supporting actors. Green = same person in the same slot, gold = they are in
            the answer's cast, just somewhere else.
          </Row>
          <Row k="Genres">Up to five. Each genre lights up green if the answer has it too.</Row>
        </ul>
      </div>

      <div className="space-y-2">
        <h3 className="display text-lg text-[var(--color-fg)]">If you get stuck</h3>
        <p>
          After <strong>{FRAME_AT} guesses</strong> you can ask for a still from the film. It
          arrives heavily pixelated and sharpens with every guess you make after that. Three guesses later you can also ask for the plot, with the title, cast and crew
          blacked out.
        </p>
        <p className="text-[var(--color-muted)]">
          Neither is forced on you and neither costs a guess — but a result solved with help says
          so when you share it.
        </p>
      </div>

      <p className="text-[var(--color-muted)]">
        Every industry runs its own puzzle, so the {LANGS[lang].name} film of the day is different
        from the Tamil or Hindi one, and each keeps a separate streak. A new film unlocks at
        midnight IST. Archive replays are free practice and never touch your streak.
      </p>
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-0.5 w-[5.5rem] shrink-0 text-[10px] font-semibold tracking-[0.14em] text-[var(--color-brand)] uppercase">
        {k}
      </span>
      <span>{children}</span>
    </li>
  );
}
