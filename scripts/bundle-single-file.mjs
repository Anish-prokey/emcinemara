#!/usr/bin/env node
/**
 * Fold dist/ into one self-contained HTML file.
 *
 *   npm run build && node scripts/bundle-single-file.mjs [out.html]
 *
 * Emits page content only — no <!doctype>, <html>, <head> or <body> wrapper —
 * so it can be dropped straight into a host that supplies its own skeleton
 * (Claude Artifacts), and still opens fine on its own in a browser.
 *
 * Google Fonts stay as a <link>; everything else is inlined.
 * Pass --title=... to override the page title (the hosted copy wants the bare
 * product name; the self-hosted copy keeps the descriptive one for search).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";

const DIST = resolve("dist");
const OUT = resolve(process.argv[2] || "dist/filmi-standalone.html");

const html = readFileSync(join(DIST, "index.html"), "utf8");

const cssHref = html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/)?.[1];
const jsSrc = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/)?.[1];
if (!cssHref || !jsSrc) throw new Error("could not find the built css/js in dist/index.html");

const read = (p) => readFileSync(join(DIST, p.replace(/^\//, "")), "utf8");
const css = read(cssHref);
const js = read(jsSrc);
const favicon = readFileSync(join(DIST, "favicon.svg"), "utf8");

const titleFlag = process.argv.find((a) => a.startsWith("--title="));
const title = titleFlag
  ? titleFlag.slice("--title=".length)
  : (html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "Filmi");
const fontLink =
  html.match(/<link href="https:\/\/fonts\.googleapis\.com[^>]*>/)?.[0] ?? "";

// `</script>` inside the bundle would close our inline tag early.
const safeJs = js.replace(/<\/script>/gi, "<\\/script>");

// Declared up front so the page still decodes correctly when a host serves it
// without a charset header. The bundle carries five Indic scripts.
const out = `<meta charset="utf-8" />
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
${fontLink}
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${Buffer.from(favicon).toString("base64")}" />
<meta name="theme-color" content="#000000" />
<style>${css}</style>
<div id="root"></div>
<script type="module">${safeJs}</script>
`;

writeFileSync(OUT, out, "utf8");

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;
console.log(`wrote ${OUT}`);
console.log(`  css ${kb(css.length)} + js ${kb(js.length)} -> ${kb(out.length)} single file`);
if (/https?:\/\/(?!fonts\.(googleapis|gstatic)\.com)/.test(out.replace(/https?:\/\/[^"']*themoviedb[^"']*/g, ""))) {
  console.log("  note: the page references an external host other than Google Fonts");
}
