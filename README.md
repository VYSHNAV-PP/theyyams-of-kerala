# Kerala Events

Map-first event discovery for Kerala: explore events on a Kerala map, search and filter them, confirm or report
them, and post new ones.

**Stack:** TanStack Start (React 19, SSR via Nitro) · Tailwind CSS 4 · Leaflet · Supabase (Postgres + Storage)

## 1. Set up Supabase (your own project)

1. Create a project at <https://supabase.com>.
2. Run every file in `supabase/migrations/` **in filename order** (SQL editor, or `supabase link` + `supabase db push`).
3. Copy `.env.example` to `.env` and fill in the project URL and publishable/anon key
   (Project Settings → API).

## 2. Run

```sh
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm run build
npm start            # serves the production build (Node)
```

## 3. Deploy

Nitro picks the output for the platform automatically, or you can force it with `NITRO_PRESET`.

- **Cloudflare / Vercel / Netlify:** connect the Git repo, build command `npm run build`, add the two `VITE_*`
  variables in the platform's dashboard. Check Nitro's docs for the preset name if auto-detection doesn't apply.
- **Any Node host (VPS, Hostinger Business/Cloud Node.js apps):** `npm run build`, then run `npm start`
  (`node .output/server/index.mjs`) with the `VITE_*` variables set **at build time**.

## Structure

| Path | Purpose |
| --- | --- |
| `src/routes/index.tsx` | Map/list home: search, category + quick filters, preview |
| `src/routes/submit.tsx` | Four-step "Post an Event" form |
| `src/routes/event.$id.tsx` | Event page: details, confirm, report |
| `src/components/EventMap.tsx` | Leaflet map with zoom-based clustering (no plugin) |
| `src/lib/taxonomy.ts` | Categories, subcategories, icons, report reasons |
| `src/lib/events.ts` | Data access, event lifecycle, search parsing, filters |
| `src/lib/geo.ts` | Districts, Kerala bounds, point-in-district lookup |
| `supabase/migrations/` | Schema, RLS, confirm/report functions, poster bucket |

## Moderation later

In the v2 migration the insert policy publishes events immediately (`status = 'published'`). To moderate, change
that check to `'pending'` and approve rows by setting `status = 'published'`; the public read policy already
returns only published events.
