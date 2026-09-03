# Hosting Filmi

`dist/` is a plain static folder. No server, no database, no environment
variables, no build step on the host if you upload it pre-built. Any static
host works.

Rebuild it any time with:

```bash
npm install
npm run build
```

## Fastest: drag and drop (about 60 seconds, no CLI)

1. Open <https://app.netlify.com/drop>
2. Drag the **`dist`** folder onto the page (or upload `dist/filmi-site.zip`)
3. You get a public URL immediately, e.g. `https://swift-tiger-123.netlify.app`

Sign in afterwards to keep the site and rename it. Cloudflare Pages offers the
same thing under "Direct Upload".

## Single file, if you want the simplest possible thing

`dist/filmi-standalone.html` is the entire game in one file — CSS and JS
inlined. Rename it `index.html`, drop it on any host, email it, or open it
straight from disk. Nothing else needs to come with it.

## From this git repo (auto-deploys on every push)

The repo is already initialised and committed. Push it to GitHub, then:

**Vercel** — <https://vercel.com/new>, import the repo. It detects Vite.
**Netlify** — <https://app.netlify.com/start>, import the repo.

Either way the settings are:

| setting | value |
| --- | --- |
| build command | `npm run build` |
| publish directory | `dist` |
| node version | 20 or newer |

**GitHub Pages** needs one extra step, because Pages serves from a
subdirectory. Set the base path first, or the CSS and JS will 404:

```bash
npm run build -- --base=/YOUR-REPO-NAME/
```

Then publish `dist/` to the `gh-pages` branch.

## What changes once it is on a real host

Posters start working. The published Claude Artifact blocks all external
images by policy, so every film falls back to its title card there. On a normal
host, TMDB artwork loads — once the dataset actually has poster paths, which
means running `npm run fetch:tmdb` (see README).

## Custom domain

Every host above takes one for free: add the domain in their dashboard, then
point a CNAME at the host. TLS is issued automatically.

## What this costs

Nothing, on every host listed. The game is ~90 kB gzipped and static, so it sits
inside every free tier with room to spare. There is no per-player cost because
there is no backend — the daily film is derived from the date in the browser.
