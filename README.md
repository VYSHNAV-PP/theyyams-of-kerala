# Theyyams of Kerala

A map-first guide to Theyyam performances in kavus and temples across Kerala. Explore what is on now, tonight or
later; browse by form (Muchilottu Bhagavathi, Vishnumoorthi, Gulikan and more); filter by type, date and place;
bookmark performances; confirm or report them; and add new ones.

**Stack:** TanStack Start (React 19, SSR via Nitro) · Tailwind CSS 4 · Leaflet with OpenStreetMap tiles ·
Supabase (Postgres + Storage). Fonts are self-hosted (Cinzel, Hanken Grotesk, Noto Malayalam).

## 1. Set up Supabase (your own project)

1. Create a project at <https://supabase.com>.
2. Run every file in `supabase/migrations/` **in filename order** (SQL editor, or `supabase link` + `supabase db push`).
3. Copy `.env.example` to `.env` and fill in the project URL and publishable/anon key
   (Project Settings → API).

### Upgrading an existing "Kerala Events" database

`supabase/migrations/20261010000000_theyyams_of_kerala.sql` is safe to run once on top of the old schema. It:

- adds the columns the app relies on (`image_candidates`, `source_types`, `registration_*`, `downvotes`), which
  earlier migrations did not create;
- replaces the old categories with the Theyyam families;
- **archives** old generic events by setting their `status` to `rejected`. Nothing is deleted. To restore one:
  `UPDATE public.events SET status = 'published', category = 'Other' WHERE id = '…';`

### Demo data (optional, testing only)

`supabase/demo/demo_theyyams.sql` inserts a few clearly labelled **sample** performances around "now" so every tab
has content. They are not real schedules. Remove them with `DELETE FROM public.events WHERE id LIKE 'demo-%';`.

## 2. Run

```sh
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm run lint
npm run build
npm start            # serves the production build (Node)
```

## 3. Deploy

Nitro picks the output for the platform automatically, or you can force it with `NITRO_PRESET`.

- **Cloudflare / Vercel / Netlify:** connect the Git repo, build command `npm run build`, add the two `VITE_*`
  variables in the platform's dashboard.
- **Any Node host:** `npm run build`, then `npm start` (`node .output/server/index.mjs`) with the `VITE_*`
  variables set **at build time**.

## How it is organised

| Path | Purpose |
| --- | --- |
| `src/routes/index.tsx` | Home: hero, map, "Theyyam Now" panel (tabs + Filters), forms, calendar |
| `src/routes/submit.tsx` | Four-step "Add a Theyyam" form |
| `src/routes/event.$id.tsx` | Performance page: details, confirm, report, add to calendar |
| `src/components/EventMap.tsx` | Leaflet map, OSM tiles, zoom-based clustering (no plugin) |
| `src/components/NowPanel.tsx` | The list panel with Now / Tonight / Upcoming / Ended tabs |
| `src/components/FilterSheet.tsx` | Filters: family, form, date, place, verified, saved |
| `src/components/FormsSection.tsx`, `TheyyamCalendar.tsx` | "Explore Theyyam forms" and the week calendar |
| `src/lib/taxonomy.ts` | **Theyyam families and forms** (names, Malayalam, one-line descriptions) |
| `src/lib/events.ts` | Data access, IST date logic, phases (now/tonight/upcoming), search, filters, .ics export |
| `src/lib/saved.ts` | Bookmarks, stored on the visitor's device |
| `src/styles.css` | Design tokens (one dark theme, flat colours, no gradients) |
| `public/` | Logo, favicon, hero photo, bundled Kerala district boundaries |

### Customising

- **Add or edit a Theyyam form:** `FORMS` in `src/lib/taxonomy.ts`. Mark `featured: true` to show it in the first row
  of the forms section. The families (`CATEGORIES`) are also enforced by the database, so a new family needs a
  matching change to the `events_category_v3` check constraint.
- **Colours:** the CSS variables at the top of `src/styles.css`. Phase colours (map pins, calendar dots) are in
  `PHASE_META` in `src/lib/events.ts`.
- **Map tint:** the OSM tiles are warmed with one CSS rule (`.ke-map .leaflet-tile-pane`) in `src/styles.css`.
  Remove or change it to restyle the map.
- **"Tonight":** defined as 5 PM to 6 AM Kerala time (`tonightWindow` in `src/lib/events.ts`).

### Notes

- The old `entry`/ticket/registration fields still exist in the database but are not shown, since Theyyam
  performances are open to all.
- The welcome pop-up and the splash screen show once per browser session.
- Map data © OpenStreetMap contributors. Please respect the
  [OSM tile usage policy](https://operations.osmfoundation.org/policies/tiles/) if traffic grows; a hosted tile
  provider is a drop-in replacement for the tile URL in `EventMap.tsx`.

## Moderation later

The insert policy publishes performances immediately (`status = 'published'`). To moderate, change that check to
`'pending'` and approve rows by setting `status = 'published'`; the public read policy already returns only
published rows.
