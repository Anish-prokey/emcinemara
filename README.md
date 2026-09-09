# EmCinemaRa

A daily Indian-cinema guessing game. The name is Telugu for "what movie?", which is
the question: one film a day, ten guesses, and every guess flips a row of clues
telling you how close you landed.

**Live:** <https://emcinemara.netlify.app>

Five industries — Hindi, Tamil, Telugu, Malayalam, Kannada — each running **its own
puzzle** with its own answer and its own streak. Players pick one on first launch and
can switch any time.

## Running it

```bash
npm install
npm run dev
```

| script | what it does |
| --- | --- |
| `npm run dev` | dev server on :5173 |
| `npm run build` | typecheck + production bundle into `dist/` |
| `npm run selftest` | logic assertions: comparison rules, per-language schedules, search |
| `npm run browser-test` | drives a real headless Chrome — clicks, keystrokes, persistence, theme. Needs a running server; set `BASE` to test a deployed URL |
| `npm run fetch:tmdb` | rebuild the dataset from TMDB |

`dist/` is a plain static folder. There is no backend: the daily film is derived from
the date in the browser, and progress lives in `localStorage`. See
[DEPLOY.md](DEPLOY.md) for hosting.

## The clues

| Clue | Green | Gold |
| --- | --- | --- |
| Year | exact | within 5 years (▲/▼ points at the answer) |
| Rating | same to 1 d.p. | within 0.4 (▲/▼) |
| Certificate | same CBFC rating | one step away (U↔U/A, U/A↔A) |
| Runtime | same | within 10 minutes (▲/▼) |
| Director | same person | credited on the answer in another role |
| Music | same person | credited on the answer in another role |
| Cast (5) | same actor, same billing slot | in the answer's cast, different slot |
| Genres (≤5) | answer has that genre | — |

Two clues adapt to the loaded dataset: **Certificate** hides itself if the data has no
real certificates, and **Runtime** only appears when both films have one. A source
without billing order sets `castOrdered: false` and cast matching drops slot
comparison rather than invent a lead actor.

There is deliberately no Box Office clue — TMDB's revenue figures for Indian releases
are mostly empty or wrong.

## Data

`src/data/movies.json` holds **1,961 films from TMDB**: Hindi 478, Tamil 494,
Malayalam 494, Telugu 453, Kannada 42.

Kannada is thin because TMDB's own Kannada coverage is thin, so its answers recycle
every ~42 days while the others run ~150.

To refresh:

```bash
# put your key in .env first - it is gitignored, see .env.example
npm run fetch:tmdb
```

A free key takes two minutes at <https://www.themoviedb.org/settings/api>; either a v3
API key or a v4 read token works. The script keeps only films with a director, a
composer, five billed actors, genres and a runtime. Flags: `--pages=N`,
`--min-votes=N`, `--out=PATH`.

If `api.themoviedb.org` is unreachable — several Indian ISPs block it — the fetcher
falls back to `api.tmdb.org` automatically. `TMDB_HOST` overrides.

`npm run fetch:wikidata` is a keyless alternative (Wikidata + the IMDb ratings dump),
but it carries no certificates, no posters and no billing order.

> This product uses the TMDB API but is not endorsed or certified by TMDB.

## Daily schedule

`src/lib/puzzle.ts`. Puzzle #1 is `2026-01-01` and the day rolls over at **midnight
IST**.

Each language has its own shuffle, seeded from the language code so the five never
march in step. Answers come from that language's **top 150 films by vote count** —
TMDB vote counts for Indian cinema are low, so a wider pool would make a 10-vote
obscurity as likely as a classic. Every film stays searchable regardless.

Progress is stored per language (`emcinemara.v1.game.<lang>.<date>`,
`emcinemara.v1.stats.<lang>`), so switching industries never disturbs another streak.
`?lang=ta` opens an industry directly; `?d=YYYY-MM-DD` replays an archived day without
touching your streak.

## Layout

```
src/
  lib/         comparison rules, per-language schedules, search index, storage
  data/        movies.json + typed loader
  components/  Ident, LanguagePicker, SearchBox, GuessCard, Poster, modals, EndCard
  index.css    theme tokens and animation
scripts/
  fetch-tmdb.mjs     dataset builder
  fetch-wikidata.mjs keyless alternative
  selftest.ts        logic assertions
  browser-test.mjs   real-browser assertions over CDP
```
