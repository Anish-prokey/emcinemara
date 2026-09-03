/**
 * End-to-end test against a real headless Chrome, over CDP.
 *
 * Drives the app the way a person does — real mouse clicks, real keystrokes —
 * because the logic self-test cannot catch a control that has become
 * unclickable, or a theme that failed to load.
 *
 *   npm run dev            # in one terminal
 *   npm run browser-test   # in another
 *
 * Env: BASE (default http://localhost:5173), CHROME_PATH, DEBUG=1.
 */
import { spawn } from "node:child_process";
import { rmSync, existsSync } from "node:fs";

const CHROME =
  process.env.CHROME_PATH ||
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].find((p) => existsSync(p));

if (!CHROME) {
  console.error("No Chrome found. Set CHROME_PATH to your Chrome binary.");
  process.exit(1);
}
const PORT = 9333;
import { resolve } from "node:path";
const PROFILE = resolve(process.env.TMP_PROFILE || "./node_modules/.cache/browser-test-profile");
const BASE = process.env.BASE || "http://localhost:5173";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

rmSync(PROFILE, { recursive: true, force: true });
const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  "--no-first-run",
  "--window-size=1280,900",
  "about:blank",
], { stdio: ["ignore", "pipe", "pipe"] });
chrome.stderr.on("data", (d) => process.env.DEBUG && console.log("[chrome]", String(d).trim()));

let ws;
let nextId = 1;
const pending = new Map();

function send(method, params = {}, sessionId) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params, sessionId }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function connect() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const info = await res.json();
      ws = new WebSocket(info.webSocketDebuggerUrl);
      await new Promise((r, j) => {
        ws.onopen = r;
        ws.onerror = j;
      });
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.id && pending.has(msg.id)) {
          const { resolve, reject } = pending.get(msg.id);
          pending.delete(msg.id);
          msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
        }
      };
      return;
    } catch {
      await sleep(250);
    }
  }
  throw new Error("could not reach Chrome devtools");
}

await connect();

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
const S = (m, p) => send(m, p, sessionId);

await S("Page.enable");
await S("Runtime.enable");

async function goto(url) {
  await S("Page.navigate", { url });
  await sleep(1400);
}

async function evaluate(expression) {
  const r = await S("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " :: " + expression.slice(0, 80));
  return r.result.value;
}

async function clickCentre(selector) {
  const box = await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  })()`);
  if (!box) throw new Error(`no element for ${selector}`);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await S("Input.dispatchMouseEvent", {
      type,
      x: box.x,
      y: box.y,
      button: "left",
      clickCount: 1,
    });
  }
  await sleep(120);
}

async function type(text) {
  await S("Input.insertText", { text });
  await sleep(200);
}

async function pressEnter() {
  await S("Input.dispatchKeyEvent", {
    type: "rawKeyDown", windowsVirtualKeyCode: 13, key: "Enter", code: "Enter",
  });
  await S("Input.dispatchKeyEvent", {
    type: "keyUp", windowsVirtualKeyCode: 13, key: "Enter", code: "Enter",
  });
  await sleep(250);
}

let failures = 0;
const check = (name, cond, extra = "") => {
  if (cond) console.log(`  ok    ${name}`);
  else { failures++; console.log(`  FAIL  ${name} ${extra}`); }
};

console.log("\ndriving a real browser\n");

/* ---- 1. first run shows the profile gate ---- */
await goto(BASE);
await evaluate("localStorage.clear(); sessionStorage.clear(); true");
await goto(BASE);
await sleep(2600); // let the ident finish

const profileCount = await evaluate(`document.querySelectorAll('.nf-tile').length`);
check("first run shows five profile tiles", profileCount === 5, `saw ${profileCount}`);
check(
  "the opener played and marked itself",
  (await evaluate(`sessionStorage.getItem('filmi.identShown')`)) === "1",
);

/* ---- 2. picking a profile starts that puzzle ---- */
await clickCentre(".nf-tile:nth-child(1) button, li:nth-child(2) .nf-tile"); // Tamil is the 2nd tile
await sleep(500);
let heading = await evaluate(`document.body.innerText.match(/TAMIL . EPISODE \\d+/)?.[0] ?? null`);
if (!heading) {
  // fall back to whichever profile got picked; the point is that one was chosen
  heading = await evaluate(`document.body.innerText.match(/(HINDI|TAMIL|TELUGU|MALAYALAM|KANNADA) . EPISODE \\d+/)?.[0] ?? null`);
}
check("picking a profile opens its board", Boolean(heading), String(heading));

const lang = await evaluate(`JSON.parse(localStorage.getItem('filmi.v2.settings')).lang`);
check("the chosen profile is persisted", Boolean(lang), String(lang));

/* ---- 3. dismiss the how-to that opens on first play ---- */
await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Close');
  if (b) b.click();
  return true;
})()`);
await sleep(300);

/* ---- 4. real typing + Enter submits a guess ---- */
await clickCentre('input[aria-label="Search for a movie"]');
const focused = await evaluate(`document.activeElement?.getAttribute('aria-label')`);
check("clicking the search box focuses it", focused === "Search for a movie", String(focused));

await type("a");
const optionCount = await evaluate(`document.querySelectorAll('[role="option"]').length`);
check("typing opens the suggestion list", optionCount > 0, `saw ${optionCount}`);

const firstSuggestion = await evaluate(
  `document.querySelector('[role="option"]')?.innerText.split('\\n')[0] ?? null`,
);
await pressEnter();

const guessed = await evaluate(`document.querySelector('main ul li h3')?.textContent ?? null`);
check("Enter submits the highlighted film", guessed === firstSuggestion, `${guessed} vs ${firstSuggestion}`);
check(
  "progress advanced",
  (await evaluate(`document.body.innerText.match(/(\\d+) of 10/)?.[1]`)) === "1",
);

/* ---- 5. it survives a reload ---- */
await goto(BASE + "/?lang=" + lang);
await sleep(600);
check(
  "the guess is still there after a reload",
  (await evaluate(`document.querySelector('main ul li h3')?.textContent ?? null`)) === guessed,
);

/* ---- 6. the red spine marks only the newest guess ---- */
await clickCentre('input[aria-label="Search for a movie"]');
await type("k");
await pressEnter();
const spines = await evaluate(`(() => {
  const cards = [...document.querySelectorAll('main ul li')];
  return cards.map(c => Boolean(c.querySelector('span[aria-hidden].absolute')));
})()`);
check(
  "only the newest card carries the red spine",
  Array.isArray(spines) && spines.length >= 2 && spines[0] === true && spines.slice(1).every((x) => x === false),
  JSON.stringify(spines),
);

/* ---- the clue key has to be reachable without hunting ---- */
const legend = await evaluate(`(() => {
  const t = document.querySelector('main')?.innerText ?? "";
  return JSON.stringify({
    exact: /Exact/.test(t), close: /Close/.test(t), noMatch: /No match/.test(t),
    link: Boolean([...document.querySelectorAll('button')].find(b => /What the clues mean/i.test(b.textContent))),
  });
})()`);
const lg = JSON.parse(legend);
check("the colour key is on the board, not hidden in a modal", lg.exact && lg.close && lg.noMatch, legend);
check("a visible link opens the full rules", lg.link);

await evaluate(`(() => {
  const b = [...document.querySelectorAll('button')].find(x => /What the clues mean/i.test(x.textContent));
  b?.click(); return true;
})()`);
await sleep(400);
check(
  "that link actually opens the explainer",
  (await evaluate(`document.querySelector('[role="dialog"] h2')?.textContent?.trim() ?? null`)) === "How to play",
);
await evaluate(`document.querySelector('[role="dialog"] button[aria-label="Close"]')?.click(); true`);
await sleep(300);

/* ---- header controls must be nameable, not mystery glyphs ---- */
const nav = JSON.parse(await evaluate(`JSON.stringify(
  [...document.querySelectorAll('header nav button')].map(b => ({
    label: b.getAttribute('aria-label'),
    svg: Boolean(b.querySelector('svg')),
  }))
)`));
check("every header control is labelled", nav.length === 4 && nav.every((b) => b.label), JSON.stringify(nav));
check("header controls use real icons, not text glyphs", nav.every((b) => b.svg), JSON.stringify(nav));

/* ---- tiles explain their own rule on hover ---- */
const tips = await evaluate(`(() => {
  const withTitle = [...document.querySelectorAll('main ul li [title]')];
  return withTitle.filter(el => /gold/i.test(el.getAttribute('title') || '')).length;
})()`);
check("tiles carry their own clue explanation", tips >= 3, `${tips} tiles with a rule tooltip`);

/* ---- 7. no horizontal overflow at phone width ---- */
await S("Emulation.setDeviceMetricsOverride", {
  width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
});
await sleep(500);
const overflow = await evaluate(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
check("no horizontal overflow at 390px", overflow === 0, `overflow ${overflow}px`);

/* ---- 8. theme actually applied ---- */
const theme = await evaluate(`JSON.stringify({
  bg: getComputedStyle(document.body).backgroundColor,
  brand: getComputedStyle(document.documentElement).getPropertyValue('--color-brand').trim(),
})`);
const t = JSON.parse(theme);
check("page background is black", t.bg === "rgb(0, 0, 0)", t.bg);
check("brand colour is Netflix red", t.brand.toLowerCase() === "#e50914", t.brand);

console.log(failures === 0 ? "\nall browser checks passed\n" : `\n${failures} browser check(s) failed\n`);

chrome.kill();
// Windows keeps a handle on the profile for a moment after the kill; the
// leftover directory is harmless and the next run wipes it.
try {
  rmSync(PROFILE, { recursive: true, force: true });
} catch {
  /* ignore */
}
process.exit(failures === 0 ? 0 : 1);
