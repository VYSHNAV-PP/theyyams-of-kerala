import { useEffect, useRef, useState } from "react";
import {
  Coffee,
  MapPin,
  ShieldCheck,
  X,
} from "lucide-react";

const COFFEE_URL =
  "https://buymeacoffee.com/whyyshnavb";

const SPLASH_DURATION_MS = 2000;
const SPLASH_FADE_MS = 450;

/* ==========================================================================
   SPLASH / LOADING SCREEN
   ========================================================================== */

export function Splash() {
  const [phase, setPhase] = useState<
    "show" | "hide" | "gone"
  >("show");

  useEffect(() => {
    const root = document.documentElement;

    let removeTimer: number | undefined;

    const splashTimer = window.setTimeout(() => {
      setPhase("hide");

      removeTimer = window.setTimeout(() => {
        setPhase("gone");

        root.setAttribute(
          "data-ke-splash-seen",
          "1",
        );

        window.dispatchEvent(
          new Event("ke:splash-done"),
        );
      }, SPLASH_FADE_MS);
    }, SPLASH_DURATION_MS);

    return () => {
      window.clearTimeout(splashTimer);

      if (removeTimer !== undefined) {
        window.clearTimeout(removeTimer);
      }
    };
  }, []);

  if (phase === "gone") {
    return null;
  }

  return (
    <div
      className="ke-splash"
      data-phase={phase}
      role="status"
      aria-live="polite"
      aria-label="Loading Kerala Events"
    >
      <div
        className="ke-emblem"
        aria-hidden="true"
      >
        <MapPin
          size={30}
          strokeWidth={2}
          className="text-primary"
        />
      </div>

      <div className="text-center">
        <p className="font-display text-3xl font-bold tracking-tight text-foreground">
          Kerala Events
        </p>

        <p className="mt-1.5 text-sm text-muted-foreground">
          What's happening across Kerala
        </p>
      </div>

      <div
        className="ke-splash-bar"
        aria-hidden="true"
      >
        <i />
      </div>

      <p className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground">
        Loading map and events…
      </p>
    </div>
  );
}

/* ==========================================================================
   WELCOME / INTRO POPUP
   ========================================================================== */

export function WelcomeModal() {
  const [open, setOpen] = useState(false);

  const primaryButton =
    useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let shown = false;

    const show = () => {
      if (shown) {
        return;
      }

      shown = true;
      setOpen(true);
    };

    if (
      document.documentElement.getAttribute(
        "data-ke-splash-seen",
      ) === "1"
    ) {
      show();
      return;
    }

    window.addEventListener(
      "ke:splash-done",
      show,
      { once: true },
    );

    const fallbackTimer =
      window.setTimeout(() => {
        show();
      }, 3000);

    return () => {
      window.removeEventListener(
        "ke:splash-done",
        show,
      );

      window.clearTimeout(
        fallbackTimer,
      );
    };
  }, []);

  /*
   * The popup is dismissed only by:
   * - X button
   * - Explore the map button
   *
   * There is intentionally no localStorage flag,
   * so the popup appears again on every reload.
   */
  const close = () => {
    setOpen(false);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    primaryButton.current?.focus();

    /*
     * Deliberately no Escape handler.
     */
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ke-intro-title"
      className="ke-dialog fixed inset-0 z-[1000] flex items-end justify-center bg-black/45 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-10 sm:items-center sm:p-4"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <MapPin
              size={20}
              aria-hidden="true"
            />
          </div>

          <button
            type="button"
            onClick={close}
            aria-label="Close introduction"
            className="tap -mr-1 -mt-1 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          >
            <X
              size={18}
              aria-hidden="true"
            />
          </button>
        </div>

        <h2
          id="ke-intro-title"
          className="mt-3 font-display text-2xl font-bold text-foreground"
        >
          Kerala Events
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          A live map of what's happening around Kerala
          — sports, festivals, concerts, fairs, and more.
          Anyone can post an event, and anyone can confirm
          or report one. There's no waiting for approval and
          no editorial gatekeeping.
        </p>

        <div className="mt-4 flex gap-2.5 rounded-xl bg-muted p-3 text-sm">
          <ShieldCheck
            size={18}
            className="mt-0.5 shrink-0 text-primary"
            aria-hidden="true"
          />

          <p className="text-muted-foreground">
            Every event starts as{" "}
            <span className="font-medium text-foreground">
              New
            </span>
            . Once enough people confirm it, it becomes{" "}
            <span className="font-medium text-foreground">
              ✓ Verified
            </span>
            . Trust is built by the community, not by us.
          </p>
        </div>

        <button
          ref={primaryButton}
          type="button"
          onClick={close}
          className="tap mt-5 flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Explore the map
        </button>

        <div className="mt-4 border-t border-border pt-4">
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            Kerala Events is free and built by one person.
            If it's useful to you, a coffee helps keep it
            running.
          </p>

          <a
            href={COFFEE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="tap mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <Coffee
              size={17}
              className="text-gold"
              aria-hidden="true"
            />

            Buy me a coffee
          </a>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   FLOATING BUY ME A COFFEE BUTTON
   ========================================================================== */

export function CoffeeLink() {
  return (
    <a
      href={COFFEE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Buy me a coffee"
      title="Buy me a coffee"
      className="tap fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[950] flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-transform hover:scale-105 hover:bg-muted active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:bottom-5 sm:right-5"
    >
      <Coffee
        size={21}
        strokeWidth={2}
        className="text-gold"
        aria-hidden="true"
      />
    </a>
  );
}