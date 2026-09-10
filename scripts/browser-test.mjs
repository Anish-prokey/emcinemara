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
  (await evaluate(`sessionStorage.getItem('emcinemara.identShown')`)) === "1",
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

const lang = await evaluate(`JSON.parse(localStorage.getItem('emcinemara.v1.settings')).lang`);
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
const EXPECTED_NAV = ["Mute", "How to play", "Archive", "Stats", "Settings"];
check(
  "every header control is labelled",
  nav.length === EXPECTED_NAV.length && nav.every((b) => b.label),
  JSON.stringify(nav),
);
check(
  "the header carries exactly the controls we expect",
  nav.map((b) => b.label).join() === EXPECTED_NAV.join(),
  nav.map((b) => b.label).join(),
);
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

/* The header is at its widest once a streak chip sits beside the five
   controls, so it is worth measuring in that state and not only bare. */
await evaluate(`(() => {
  // Mid-game there is no stats record yet, so derive the key from the profile
  // the test picked rather than looking for one that cannot be there.
  const lang = JSON.parse(localStorage.getItem("emcinemara.v1.settings") || "{}").lang;
  if (!lang) return false;
  const k = "emcinemara.v1.stats." + lang;
  localStorage.setItem(k, JSON.stringify({
    played: 188, wins: 188, streak: 188, best: 188, lastDay: null, dist: {},
  }));
  return true;
})()`);
await S("Page.reload");
await sleep(2200);
check(
  "a long streak shows in the header",
  (await evaluate(`Boolean(document.querySelector('header button[title*="streak"]'))`)) === true,
);
const overflowStreak = await evaluate(
  `document.documentElement.scrollWidth - document.documentElement.clientWidth`,
);
check(
  "no horizontal overflow at 390px with a streak chip",
  overflowStreak === 0,
  `overflow ${overflowStreak}px`,
);

/* ---- 8. the win, and the celebration that rides on it ----

   Reaching a win needs the answer, and the only place the app states it is the
   card shown after a loss. So: burn the ten guesses to learn the film, wipe the
   board, then play it back as a one-guess win. That also buys the first real
   coverage of the winning path — grade, streak line and confetti. */

/** Type a letter and take the first suggestion, whatever it is. */
async function guessAnything(seed) {
  await evaluate(`(() => {
    const i = document.querySelector('input[aria-label="Search for a movie"]');
    if (!i) return false;
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    i.focus(); set.call(i, ${JSON.stringify(seed)});
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(420);
  return evaluate(`(() => {
    const b = document.querySelector('[role="option"] button');
    if (!b) return false;
    b.click();
    return true;
  })()`);
}

/* ---- hints: offered late, taken by choice, and they stay taken ---- */
const hintEarly = await evaluate(
  `[...document.querySelectorAll("button")].some(b => /Show me the poster/.test(b.textContent))`,
);
check("no hint is offered early on", hintEarly === false);

// Walk up to the gate.
const LETTERS_H = "aeiorn".split("");
for (let i = 0; i < 6; i++) {
  const used = await evaluate(`(() => {
    const k = Object.keys(localStorage).find(x => x.startsWith("emcinemara.v1.game."));
    return k ? JSON.parse(localStorage.getItem(k)).guesses.length : 0;
  })()`);
  if (used >= 4) break;
  await guessAnything(LETTERS_H[i]);
  await sleep(260);
}

const frameOffered = await evaluate(
  `[...document.querySelectorAll("button")].some(b => /Show me the poster/.test(b.textContent))`,
);
check("artwork is offered once the board stops helping", frameOffered === true);

await evaluate(`(() => {
  const b = [...document.querySelectorAll("button")].find(x => /Show me the poster/.test(x.textContent));
  if (b) b.click();
  return true;
})()`);
await sleep(1400);

const framed = JSON.parse(await evaluate(`(() => {
  const c = document.querySelector("figure canvas");
  const k = Object.keys(localStorage).find(x => x.startsWith("emcinemara.v1.game."));
  const g = k ? JSON.parse(localStorage.getItem(k)) : {};
  return JSON.stringify({
    canvas: Boolean(c),
    painted: c ? c.width > 0 && c.height > 0 : false,
    saved: g.hints ? g.hints.frameAt : null,
    caption: document.querySelector("figcaption")?.textContent ?? "",
  });
})()`));
check("taking it draws the poster", framed.canvas && framed.painted, JSON.stringify(framed));
check("the hint is recorded on the board", framed.saved !== null && framed.saved !== undefined);
check("the artwork says it will sharpen", framed.caption.includes("1/"), framed.caption);

// The bug this guards: submit() used to rebuild the board and drop `hints`,
// so the frame vanished on the very next guess.
await guessAnything("s");
await sleep(700);
const afterGuess = JSON.parse(await evaluate(`(() => {
  const k = Object.keys(localStorage).find(x => x.startsWith("emcinemara.v1.game."));
  const g = k ? JSON.parse(localStorage.getItem(k)) : {};
  return JSON.stringify({
    stillThere: Boolean(document.querySelector("figure canvas")),
    saved: g.hints ? g.hints.frameAt : null,
    caption: document.querySelector("figcaption")?.textContent ?? "",
  });
})()`));
check("guessing again does not wipe the hint", afterGuess.stillThere === true, JSON.stringify(afterGuess));
check("the hint survives in storage", afterGuess.saved !== null && afterGuess.saved !== undefined);
check("the artwork sharpened by one step", afterGuess.caption.includes("2/"), afterGuess.caption);

// And it must come back after a reload, like the rest of the board.
await S("Page.reload");
await sleep(2200);
check(
  "the hint is still there after a reload",
  (await evaluate(`Boolean(document.querySelector("figure canvas"))`)) === true,
);

const LETTERS = "aeiorntslumk".split("");
for (let i = 0; i < 12; i++) {
  const done = await evaluate(`document.querySelector('input[aria-label="Search for a movie"]').disabled`);
  if (done) break;
  await guessAnything(LETTERS[i % LETTERS.length]);
  await sleep(260);
}

const answerTitle = await evaluate(
  `document.querySelector('main .display.text-2xl')?.textContent?.trim() ?? null`,
);
check("burning every guess reveals the film", Boolean(answerTitle), String(answerTitle));

// Wipe just today's board, keeping the profile, and play the known answer.
await evaluate(`(() => {
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith("emcinemara.v1.game.")) localStorage.removeItem(k);
  }
  // The loss above already recorded today, and a day is only ever counted
  // once, so clear that too or the replayed win records nothing.
  const lang = JSON.parse(localStorage.getItem("emcinemara.v1.settings") || "{}").lang;
  localStorage.setItem("emcinemara.v1.stats." + lang, JSON.stringify({
    played: 5, wins: 5, streak: 5, best: 5, lastDay: null, dist: {},
  }));
  return true;
})()`);
await S("Page.reload");
await sleep(2200);
await guessAnything(answerTitle);
await sleep(1200);

const winState = JSON.parse(await evaluate(`(() => {
  const de = document.documentElement;
  const c = document.querySelector("canvas");
  const r = c && c.getBoundingClientRect();
  return JSON.stringify({
    grade: document.querySelector('[data-testid="verdict"]')?.textContent?.trim() ?? null,
    canvas: Boolean(c),
    canvasW: r ? Math.round(r.width) : 0,
    clientW: de.clientWidth,
    overflow: de.scrollWidth - de.clientWidth,
    streakLine: Boolean(document.querySelector('[data-testid="streak-line"]')),
  });
})()`));

check("a one-guess win is graded", winState.grade === "One-take wonder", String(winState.grade));
check("the win throws confetti", winState.canvas === true);
check(
  "the confetti canvas never exceeds the visible viewport",
  winState.canvas && winState.canvasW <= winState.clientW,
  `canvas ${winState.canvasW}px vs viewport ${winState.clientW}px`,
);
check(
  "no horizontal overflow at 390px on a win",
  winState.overflow === 0,
  `overflow ${winState.overflow}px`,
);
check("the win card reports the streak", winState.streakLine === true);

/* A hint taken and then immediately solved used to stay frozen at its coarsest
   forever, so you never got to see what you had been squinting at. Replay the
   same win with the frame already taken and check it resolves. */
await evaluate(`(() => {
  const k = Object.keys(localStorage).find(x => x.startsWith("emcinemara.v1.game."));
  if (!k) return false;
  const g = JSON.parse(localStorage.getItem(k));
  g.hints = { frameAt: 0 };
  localStorage.setItem(k, JSON.stringify(g));
  return true;
})()`);
await S("Page.reload");
await sleep(2400);
const revealed = JSON.parse(await evaluate(`(() => {
  const c = document.querySelector("figure canvas");
  return JSON.stringify({
    canvas: Boolean(c),
    caption: document.querySelector("figcaption")?.textContent ?? "",
  });
})()`));
check("a finished board still shows the hint it was given", revealed.canvas === true);
check(
  "and the still is revealed rather than left pixelated",
  /Revealed/.test(revealed.caption),
  revealed.caption,
);

/* The same 390px width, but as a narrow desktop rather than a phone.
   This is not redundant: emulated mobile gets overlay scrollbars, so the page
   keeps the full 390px, while a real narrow window loses 12px to a classic
   scrollbar gutter. The header shipped overflowing by exactly that 12px, and
   the phone-width check above could never see it. */
await S("Emulation.setDeviceMetricsOverride", {
  width: 390, height: 844, deviceScaleFactor: 1, mobile: false,
});
await sleep(600);
// A CDP metrics override resizes the viewport without firing the resize event
// a real window resize would, and the canvas re-measures itself on that event.
await evaluate(`(window.dispatchEvent(new Event("resize")), true)`);
await sleep(300);
const narrow = JSON.parse(await evaluate(`(() => {
  const de = document.documentElement;
  const c = document.querySelector("canvas");
  const r = c && c.getBoundingClientRect();
  const head = document.querySelector("header > div");
  return JSON.stringify({
    clientW: de.clientWidth,
    gutter: window.innerWidth - de.clientWidth,
    overflow: de.scrollWidth - de.clientWidth,
    // The row itself is width-constrained; it is the controls group inside it
    // that pushes past the edge, so measure that.
    headerRight: head
      ? Math.round(head.lastElementChild.getBoundingClientRect().right)
      : 0,
    canvasW: r ? Math.round(r.width) : 0,
    canvas: Boolean(c),
  });
})()`));

check(
  "a narrow window really does have a scrollbar gutter",
  narrow.gutter > 0,
  `gutter ${narrow.gutter}px`,
);
check(
  "the header fits a narrow window once the gutter is taken",
  narrow.headerRight <= narrow.clientW,
  `header reaches ${narrow.headerRight}px in a ${narrow.clientW}px viewport`,
);
check(
  "no horizontal overflow in a 390px window with a scrollbar",
  narrow.overflow === 0,
  `overflow ${narrow.overflow}px`,
);
check(
  "the confetti canvas fits beside a scrollbar",
  !narrow.canvas || narrow.canvasW <= narrow.clientW,
  `canvas ${narrow.canvasW}px vs viewport ${narrow.clientW}px`,
);

/* ---- Reduce motion must stop the looping animations, not only the flips ---- */
await evaluate(`(() => {
  const s = JSON.parse(localStorage.getItem("emcinemara.v1.settings") || "{}");
  localStorage.setItem("emcinemara.v1.settings", JSON.stringify({ ...s, reduceMotion: true }));
  return true;
})()`);
await S("Page.reload");
await sleep(2200);
const motion = JSON.parse(await evaluate(`(() => {
  const running = [...document.querySelectorAll("*")]
    .map((el) => getComputedStyle(el))
    .filter((cs) => cs.animationName && cs.animationName !== "none")
    .map((cs) => cs.animationName + ":" + cs.animationIterationCount);
  return JSON.stringify({
    flagged: document.documentElement.classList.contains("reduce-motion"),
    infinite: [...new Set(running.filter((r) => r.endsWith("infinite")))],
    any: [...new Set(running)],
  });
})()`));
check("the reduce-motion setting reaches the stylesheet", motion.flagged === true);
check(
  "no animation keeps looping under reduce motion",
  motion.infinite.length === 0,
  motion.infinite.join(", "),
);
check("no animation runs at all under reduce motion", motion.any.length === 0, motion.any.join(", "));

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
