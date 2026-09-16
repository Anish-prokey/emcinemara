import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * The nudge to install.
 *
 * Without one, almost nobody installs: Android fires a prompt the browser
 * mostly hides, and iOS has no API at all — Safari's only route is Share ▸ Add
 * to Home Screen, which people have to be told about.
 *
 * It waits until someone has actually played a few guesses, so a first-time
 * visitor is never asked to install something they have not tried, and once
 * dismissed it never returns.
 */

const DISMISSED = "emcinemara.v1.installDismissed";

type Choice = { outcome: "accepted" | "dismissed" };
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<Choice> };

/** Already installed? Then there is nothing to offer. */
function isStandalone(): boolean {
  try {
    return (
      matchMedia("(display-mode: standalone)").matches ||
      // Safari's own flag, which predates the standard media query.
      (navigator as unknown as { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // iPadOS reports itself as a Mac; the touch points give it away.
  (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

export default function InstallPrompt({ ready }: { ready: boolean }) {
  const [event, setEvent] = useState<InstallEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED) === "1";
    } catch {
      // Storage blocked: offer it, and accept that dismissing will not stick.
      return false;
    }
  });

  useEffect(() => {
    const onPrompt = (e: Event) => {
      // Keep the event: calling prompt() later is the only way to show the
      // browser's own install dialog.
      e.preventDefault();
      setEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const hide = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISSED, "1");
    } catch {
      /* dismissing just will not persist */
    }
  };

  // Inside the Android app there is nothing to install: it already is one.
  if (!ready || dismissed || isStandalone() || Capacitor.isNativePlatform()) return null;

  // Android and desktop Chrome hand us a real prompt. iOS never will, so it
  // gets instructions instead. Anything else gets nothing rather than advice
  // that might not match its menus.
  const ios = isIOS();
  if (!event && !ios) return null;

  return (
    <div className="fade-up mb-4 flex items-start gap-3 rounded border border-[var(--color-line)] bg-[var(--color-card)]/70 px-3 py-2.5">
      <img src="/pwa-192.png" alt="" width={36} height={36} className="mt-0.5 shrink-0 rounded" />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white/90">Play it like an app</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--color-muted)]">
          {ios ? (
            <>
              Tap <span className="text-white/80">Share</span> then{" "}
              <span className="text-white/80">Add to Home Screen</span> — it opens full screen and
              works without a connection.
            </>
          ) : (
            <>Adds it to your home screen. Opens full screen and works offline.</>
          )}
        </p>

        {event && (
          <button
            onClick={async () => {
              try {
                await event.prompt();
                await event.userChoice;
              } catch {
                /* the browser declined to show it */
              }
              hide();
            }}
            className="mt-2 rounded bg-white px-4 py-1.5 text-sm font-bold text-black transition hover:bg-white/85"
          >
            Install
          </button>
        )}
      </div>

      <button
        onClick={hide}
        aria-label="Dismiss"
        className="shrink-0 rounded-full px-2 py-0.5 text-[var(--color-muted)] transition hover:bg-white/10 hover:text-white"
      >
        ✕
      </button>
    </div>
  );
}
