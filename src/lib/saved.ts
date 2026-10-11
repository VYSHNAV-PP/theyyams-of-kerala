import { useSyncExternalStore } from "react";

/**
 * Bookmarked performances, kept on this device only (no account needed).
 * Uses useSyncExternalStore so every bookmark button, the filter and the
 * calendar stay in step, including across browser tabs.
 */

const KEY = "ke-saved";
const EMPTY: ReadonlySet<string> = new Set();

let cache: ReadonlySet<string> = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function read(): ReadonlySet<string> {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [],
    );
  } catch {
    return new Set();
  }
}

function emit() {
  for (const l of listeners) l();
}

function snapshot(): ReadonlySet<string> {
  if (!loaded && typeof window !== "undefined") {
    cache = read();
    loaded = true;
  }
  return cache;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = read();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function toggleSaved(id: string) {
  const next = new Set(snapshot());
  if (next.has(id)) next.delete(id);
  else next.add(id);
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    // Storage can be unavailable (private mode); the bookmark still works until reload.
  }
  emit();
}

/** The set of saved performance ids. Empty on the server. */
export function useSaved(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
