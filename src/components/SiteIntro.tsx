import { useEffect, useRef, useState } from "react";
import { Coffee, ShieldCheck, X } from "lucide-react";
import { CONFIRMED_MIN } from "@/lib/events";
import { SPLASH_KEY, WELCOME_KEY } from "@/lib/splash";

export const COFFEE_URL = "https://buymeacoffee.com/whyyshnavb";

const SPLASH_DURATION_MS = 1800;
const SPLASH_FADE_MS = 450;

function seen(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function remember(key: string) {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    // Private mode: the splash simply plays again next time.
  }
}

/* ==========================================================================
   SPLASH
   Plays once per browser session.
   ========================================================================== */

export function Splash() {
  const [phase, setPhase] = useState<"show" | "hide" | "gone">("show");

  useEffect(() => {
    const root = document.documentElement;

    const finish = () => {
      setPhase("gone");
      root.setAttribute("data-ke-splash-seen", "1");
      remember(SPLASH_KEY);
      window.dispatchEvent(new Event("ke:splash-done"));
    };

    if (seen(SPLASH_KEY)) {
      finish();
      return;
    }

    let removeTimer: number | undefined;
    const splashTimer = window.setTimeout(() => {
      setPhase("hide");
      removeTimer = window.setTimeout(finish, SPLASH_FADE_MS);
    }, SPLASH_DURATION_MS);

    return () => {
      window.clearTimeout(splashTimer);
      if (removeTimer !== undefined) window.clearTimeout(removeTimer);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      className="ke-splash"
      data-phase={phase}
      role="status"
      aria-live="polite"
      aria-label="Loading Theyyams of Kerala"
    >
      <div className="ke-emblem" aria-hidden="true">
        <img src="/logo-mark.png" alt="" width={112} height={112} />
      </div>

      <div className="text-center">
        <p className="font-display text-2xl font-bold uppercase tracking-[0.12em] text-foreground sm:text-3xl">
          Theyyams of Kerala
        </p>
        <p className="mt-2 text-sm text-muted-foreground">Find a Theyyam near you, tonight</p>
      </div>

      <div className="ke-splash-bar" aria-hidden="true">
        <i />
      </div>

      <p className="absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] text-xs text-subtle">
        Loading the map and performances…
      </p>
    </div>
  );
}

/* ==========================================================================
   WELCOME
   Shown once per browser session, after the splash.
   ========================================================================== */

export function WelcomeModal() {
  const [open, setOpen] = useState(false);
  const primaryButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (seen(WELCOME_KEY)) return;

    let shown = false;
    const show = () => {
      if (shown) return;
      shown = true;
      setOpen(true);
    };

    if (document.documentElement.getAttribute("data-ke-splash-seen") === "1" && seen(SPLASH_KEY)) {
      // Splash finished already (or was skipped): wait one tick so the page can paint first.
      const t = window.setTimeout(show, 150);
      return () => window.clearTimeout(t);
    }

    window.addEventListener("ke:splash-done", show, { once: true });
    const fallbackTimer = window.setTimeout(show, 3500);
    return () => {
      window.removeEventListener("ke:splash-done", show);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  const close = () => {
    remember(WELCOME_KEY);
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    primaryButton.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ke-intro-title"
      className="ke-dialog fixed inset-0 z-[1500] flex items-end justify-center bg-black/70 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-10 sm:items-center sm:p-4"
    >
      <div className="w-full max-w-md rounded-lg border border-gold-line bg-popover p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <img
            src="/logo-mark-96.png"
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 object-contain"
          />
          <button
            type="button"
            onClick={close}
            aria-label="Close introduction"
            className="tap -mr-1 -mt-1 flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <h2
          id="ke-intro-title"
          className="mt-3 font-display text-xl font-bold uppercase tracking-[0.08em] text-foreground"
        >
          Theyyams of Kerala
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          A live map of Theyyam performances in kavus and temples across Kerala. Anyone can add a
          performance, and anyone can confirm or report one. There is no approval queue.
        </p>

        <div className="mt-4 flex gap-2.5 rounded-md border border-border bg-card p-3 text-sm">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
          <p className="text-muted-foreground">
            Timings can change at the last minute. When {CONFIRMED_MIN} people confirm a performance
            it is marked <span className="font-semibold text-foreground">Verified</span>. Trust is
            built by the community.
          </p>
        </div>

        <button
          ref={primaryButton}
          type="button"
          onClick={close}
          className="tap mt-5 flex h-12 w-full items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Explore the map
        </button>

        <div className="mt-4 border-t border-border pt-4">
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            This site is free and built by one person. If it helped you find a Theyyam, a coffee
            keeps it running.
          </p>
          <a
            href={COFFEE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="tap mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-md border border-gold-line text-sm font-semibold text-foreground hover:bg-accent"
          >
            <Coffee size={17} className="text-gold" aria-hidden="true" />
            Buy me a coffee
          </a>
        </div>
      </div>
    </div>
  );
}
