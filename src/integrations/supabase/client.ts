import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Public (browser-safe) values. Set them in .env — see .env.example.
function create() {
  const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
  if (!url || !key) {
    throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env and fill them in.");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }, // the app has no user accounts
    global: {
      // New-style sb_publishable_* keys are opaque strings, not JWTs, so they must not be sent as a Bearer token.
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (headers.get("Authorization") === `Bearer ${key}` && key.startsWith("sb_")) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

let client: ReturnType<typeof create> | undefined;
/** Created on first use so importing this module never throws during build/SSR. */
export const supabase = new Proxy({} as ReturnType<typeof create>, {
  get(_, prop, receiver) {
    client ??= create();
    return Reflect.get(client, prop, receiver);
  },
});
