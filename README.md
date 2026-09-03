# Filmi

A daily Indian-cinema guessing game, in the shape of [Spotle Movies](https://spotle.movie/).
One film a day, ten guesses, and a row of clues that tell you how close you landed.

Five industries, **each running its own daily puzzle**: Hindi, Tamil, Telugu, Malayalam and
Kannada. The Tamil film of the day is not the Hindi one, and each keeps a separate streak.
Players choose an industry on first launch and can switch from the header at any time.

## Running it

```bash
npm install
npm run dev
```

| script | what it does |
| --- | --- |
| `npm run dev` | Vite dev server on :5173 |
| `npm run build` | typecheck + production bundle into `dist/` |
| `npm run selftest` | 41 assertions over the real game modules (comparison rules, per-language schedules, search scoping) |
| `npm run browser-test` | 19 assertions in a real headless Chrome — clicks, keystrokes, persistence, theme, clue discoverability. Needs `npm run dev` running |
| `npm run fetch:tmdb` | rebuild the movie dataset from TMDB |

`dist/` is a plain static folder — drop it on Vercel, Netlify, Cloudflare Pages or GitHub Pages.
There is no backend: the daily film is derived from the date, and progress lives in
`localStorage`.

## Look and feel

The theme is Netflix: true black, `#E50914` red, Anton for the wordmark and
headings, Inter for everything else.

Deliberate choices worth knowing before you change them:

- **Red is never a clue state.** It is reserved for identity and calls to action —
  the wordmark, the progress bar, the spine on the newest guess. A red tile would
  read as "wrong" and fight the green/gold/grey scale. Green is Netflix's own
  match-score green (`#46D369`).
- **The profile screen is the industry picker.** "Who&rsquo;s watching?" with five
  tinted avatars, one per industry, complete with the white ring on hover. The
  same tints follow you into the header avatar and Settings — they live in one
  place, `src/lib/profiles.ts`.
- **Avatar type size is set per language.** Malayalam runs about three times as
  wide as Devanagari at the same font size; a single value overflows some tiles
  and looks lost in others.
- **The opener** (`src/components/Ident.tsx`) is a TUDUM-style ident: red light
  bars rack up behind the wordmark, the letters wipe in, the whole thing blows
  out. It plays **once per browser tab**, is skippable with any tap or key, and
  is suppressed entirely by `prefers-reduced-motion` or the in-app Reduce Motion
  setting. There is no audio — an autoplaying sting on a cold page is hostile.
- **Every animation** is disabled under `prefers-reduced-motion`.

## The clues

Spotle's tiles are built for Hollywood. Two are swapped here:

- **Studio → Music director.** Production houses mean little to an Indian audience; composers are
  a genuine signal, and "same music director" narrows things fast.
- **Rated (MPAA) → Certificate**, using CBFC's U / U/A / A.

Spotle also has a **Box office** tile. It is deliberately absent: TMDB's `revenue` field is empty
or wrong for most Indian releases, and a clue that lies is worse than no clue.

There is no **Language** tile, because the puzzle is language-locked — it would be green on every
guess. **Runtime** takes its place, but only once real TMDB data is loaded; the bundled seed has
no runtimes, so it ships seven clue groups and the tile appears automatically at eight when the
data supports it.

## Telling the player what the colours mean

Three layers, because a rules modal shown once is no help at the moment someone
is staring at a gold tile:

1. **A permanent legend** sits with the board — Exact / Close / No match, plus a
   visible "What the clues mean" link.
2. **Per-tile tooltips.** Every tile and chip group carries its own rule, so
   hovering Year says what gold and the arrows mean.
3. **The full explainer**, opened by that link or the header's help button, and
   once automatically on a first play.

All three read from `src/lib/clues.ts`, so they cannot drift apart.

Header controls are inline SVG (`src/components/icons.tsx`). They used to be
unicode glyphs — `? ▦ ▤ ⚙` — which render inconsistently across platforms and
are near-indistinguishable at 36px.

## Posters

Every guess card carries the film's poster, and so does the reveal card. `Movie.poster` holds
a bare TMDB path; `src/lib/poster.ts` turns it into a URL, and passes absolute
URLs and `data:` URIs through untouched, so a self-hosted mirror or a build step
that inlines the images needs no code change.

Two things to know before you expect to see artwork:

1. **The bundled seed has no posters at all** — zero of its 129 films. Only
   `npm run fetch:tmdb` fills the field in.
2. **A published Claude Artifact cannot load them.** That host's CSP blocks
   every external image, and TMDB artwork is external. Posters appear on
   localhost and on any normal host (Vercel, Netlify, Pages); on the artifact
   they fall back. To get artwork onto the artifact you would have to inline the
   posters as `data:` URIs at build time — `posterUrl` already accepts those.

`Poster` takes a `size`: `sm` for the guess cards (52px wide on a phone, 68px
from the small breakpoint) and `lg` for the reveal. Size only changes the
stand-in's detailing — at guess-card width the title drops to 10px and the
perforations thin out, or the card turns to mush. Guess posters load lazily; the
reveal poster is eager.

So `src/components/Poster.tsx` treats "no artwork" as a normal state, not an
error: it draws a title card tinted with the industry's profile colour, with
film-strip perforations and the title and year set over a gradient. The same
card covers a poster that 404s or is blocked — `onError` swaps to it, so a
broken URL never leaves a broken-image icon.

Cards borrow the Netflix episode row: the newest guess carries a red spine down
its left edge (green once you have it), and hovering lifts the card.

| Tile | Green | Gold |
| --- | --- | --- |
| Year | exact | within 5 years (▲/▼ points at the answer) |
| Rating | same to 1 d.p. | within 0.4 (▲/▼) |
| Certificate | same | one step away (U↔U/A, U/A↔A) |
| Runtime *(TMDB data only)* | same | within 10 minutes (▲/▼) |
| Director | same person | credited on the answer in another role |
| Music | same person | credited on the answer in another role |
| Cast (3–5) | same actor, same slot | actor is in the answer's cast, different slot |
| Genres (≤5) | answer has that genre | — |

## Data

`src/data/movies.json` currently holds a **hand-curated seed of 129 films** so the game is
playable out of the box. Titles, years, languages, directors, music directors, cast and genres
were researched; `score` and `votes` in the seed are approximations and only affect ordering.

The seed is **uneven across industries** — Hindi 53, Tamil 24, Malayalam 21, Telugu 17, Kannada
14 — and each industry now burns through its own pool, so Kannada answers start repeating after
14 days. Settings warns about any pool under 30. Running the fetcher is effectively required
before shipping this to real players.

Run the fetcher to replace it with real data:

```bash
TMDB_KEY=your_key_here npm run fetch:tmdb
```

A free TMDB key takes about two minutes to get at
<https://www.themoviedb.org/settings/api> — no card required. Either a v3 API key or a v4 read
token works. The script pulls the most-voted films per language, keeps only entries with a
director, a composer and five billed actors, and writes ~1,500–2,500 films. Flags:
`--pages=N` (default 15 per language), `--min-votes=N` (default 25), `--out=PATH`.

If you ship this publicly, TMDB's terms require the line: *this product uses the TMDB API but is
not endorsed or certified by TMDB*, plus their logo.

## Daily schedule

`src/lib/puzzle.ts` owns it. Puzzle #1 is `2026-01-01`; the day rolls over at **midnight IST**.

Each language gets **its own shuffled schedule**, seeded from the language code so the five
industries never march in step. Within a language the pool is the top 600 films by vote count,
shuffled once with that fixed seed, then indexed by day — so the schedule is stable, reproducible
on every client, and no film repeats until that language's pool is exhausted.

Search is scoped to the chosen industry: in the Tamil puzzle, Hindi titles do not appear in the
dropdown at all.

Progress and stats are stored per language (`filmi.v2.game.<lang>.<date>`,
`filmi.v2.stats.<lang>`), so switching industries never disturbs another streak. A `?lang=ta` in
the URL opens that industry directly, which makes shared links land in the right place.

Archive replays (`?d=2026-08-19&lang=ta`, or the ▦ button) work for the last 50 days and
deliberately do not touch your streak.

## Layout

```
src/
  lib/        types, comparison rules, per-language schedules, search index, localStorage
  data/       movies.json + typed loader
  components/ Ident, LanguagePicker, SearchBox, GuessCard, Tile, Poster, modals, EndCard
  index.css   theme tokens, keyframes, the ident animation
scripts/
  fetch-tmdb.mjs    dataset builder
  selftest.ts       logic assertions
  browser-test.mjs  real-browser assertions over CDP
```

## Things worth doing next

- Swap the seed for real TMDB data (above). This also switches the Runtime clue on, taking the
  board back to eight clue groups. Everything else is already sized for ~2,000 films.
- Inline the posters as `data:` URIs at build time, so artwork survives a host
  that blocks external images (see Posters above).
- A hint button that unlocks one tile at guess 6.
- Server-side daily answer if you ever care about people reading the bundle to cheat — today the
  whole dataset ships to the client, exactly like Wordle did.
