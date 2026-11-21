# 04. Architecture

Vanilla ES modules and CSS. Vite is a **build tool only** — there is no UI framework. Output is static files served by Netlify. Supabase is imported dynamically and only when `js/config.ts` has a URL and key.

## File layout

```
/
├─ index.html                 shell: <main id="app">, nav, toast/sheet roots, module script
├─ package.json               scripts: dev, build, preview, test, typecheck
├─ tsconfig.json              TypeScript config (see "TypeScript policy" below)
├─ vite.config.ts             build + vite-plugin-pwa (generated service worker)
├─ vitest.config.ts           jsdom test environment
├─ netlify.toml               build command, publish dist/, redirects, headers
├─ public/                    copied verbatim to dist/
│  ├─ manifest.webmanifest
│  ├─ assets/logo, assets/mochi
│  ├─ fonts/, icons/
│  └─ vendor/html5-qrcode.min.js   (lazy-loaded only when the scan tab is used)
├─ css/
│  ├─ tokens.css              design tokens (source of truth)
│  ├─ base.css                reset, shell, reusable components
│  └─ app.css                 per-screen layout
├─ js/
│  ├─ main.ts                 boot: config, auth listener, router start, SW register
│  ├─ config.ts               SUPABASE_URL, SUPABASE_ANON_KEY (public values)
│  ├─ types.ts                shared shapes + small global augmentations
│  ├─ router.ts               hash router
│  ├─ store.ts                tiny observable state + localStorage prefs
│  ├─ db.ts                   all data access; demo and Supabase backends behind one interface
│  ├─ actions.ts              store-level operations, optimistic patches, offline queue
│  ├─ openlibrary.ts          Open Library / Google Books search and covers
│  ├─ covers.ts               cover resolution + background lookup
│  ├─ grads.ts                pure generated-cover gradient hashing
│  ├─ timer.ts                timestamp-based timer + localStorage persistence
│  ├─ streaks.ts              THE source of truth for streaks/stats/calendar
│  ├─ ui.ts                   icons, Mochi, covers, rings, toast, sheet, confetti
│  ├─ html.ts                 safe template tag
│  ├─ sound.ts                synthesized WebAudio effects
│  ├─ guard.ts                friendly error if opened over file://
│  ├─ reader.ts               public-domain text discovery/cleaning/pagination
│  └─ views/                  one file per screen (incl. read.ts, pdfread.ts)
├─ supabase/                  schema + migrations
├─ tests/                     Vitest unit tests
└─ docs/
```

## Routing

Hash router. `#/home`, `#/library`, `#/add`, `#/book/:id`, `#/log/:id`, `#/stats`, `#/more`, `#/celebrate`, `#/recap`, plus onboarding routes. On auth change the guard redirects protected routes to Welcome.

`back(fallback)` deliberately **does not** call `history.back()`: hash routers can otherwise leave the app, and installed PWAs have no referrer. Every in-app back button passes an explicit fallback. Device/browser back still works through `hashchange`.

## Safe templating (security rule 6)

`html.ts` escapes every interpolation unless it came from `html``` or `raw()`. `raw()` is only for trusted static SVG from `public/assets/`. Never put Open Library strings, titles, notes or names into `innerHTML` any other way — use `textContent` for single values.

## State

`store.ts` is a flat object plus subscribers: `session`, `profile`, `shelves`, `books` (user_books joined with catalog book + `shelf_ids`), `sessions`, `online`, `ready`. Views read from the store and call functions in `actions.ts`. After a write, update the store optimistically and roll back on error with the generic error toast.

## Data layer (db.ts)

Both backends satisfy the `Backend` interface, so callers are agnostic:

- **demo**: a single `pawsage.demo.v1` localStorage blob.
- **supabase**: thin wrappers over PostgREST/Auth. The client is created by an async `client()` that dynamically imports `@supabase/supabase-js` on first use.

`loadAll()` merges each reader's `user_books.cover_url` / `user_books.page_count` overrides into the shared `books` row. This is why the catalog can stay shared and immutable while each reader can still edit page counts and remember a fallback cover — `schema.sql` gives `UPDATE` on `books` only to its creator.

```ts
// loadAll merge (simplified)
{
  ...userBook,
  book: {
    ...catalogRow,
    cover_url: userBook.cover_url ?? catalogRow.cover_url,
    page_count: userBook.page_count ?? catalogRow.page_count,
  },
  shelf_ids: userBook.shelf_books.map(r => r.shelf_id),
}
```

## Streaks and stats — one source of truth

Everything derived from sessions lives in `js/streaks.ts` and uses **device-local calendar days**. Earlier schema drafts had `reading_days`, `current_streak()` and `longest_streak()` SQL helpers using `profiles.timezone`; they were removed because they would disagree with the client (and with the offline demo backend) whenever a reader travels or their profile timezone is stale. If you later want server-authoritative streaks, introduce them deliberately and have the client call the RPC when online.

Sessions are loaded for the last 400 days; older sessions still exist but don't feed the charts.

## Reading session timer

`timer.ts` stores `{ userBookId, startPage, startedAt, pausedMs, pausedAt }` under `pawsage.active`. `elapsedSec()` derives time from those timestamps, so reloads, background tabs and interval drift are harmless. Ceilings: the display redraws on a 250 ms interval, announces only whole minutes, and the finish action writes a `reading_sessions` row.

## Offline and PWA

- `vite-plugin-pwa` (`generateSW`) builds `dist/sw.js` and the precache manifest from the actual build output. No hand-maintained VERSION/SHELL list.
- `registerType: 'autoUpdate'`; registration is explicit in `main.ts`.
- Runtime caching: covers (Open Library / archive.org / Google) use stale-while-revalidate capped at 200 entries; Open Library search, Google Books and Supabase are network-only.
- Failed `reading_sessions` inserts queue in `pawsage.queue` and flush on `online` and boot. This is the only offline write path.
- `manifest.webmanifest` and `netlify.toml` headers (including CSP) are unchanged in intent; see the files for exact values.

## Supabase

- RLS on every table. `profiles`, `shelves`, `user_books`, `shelf_books`, `reading_sessions` are owner-only. `books` is readable by any signed-in user, insertable with `created_by = auth.uid()`, and effectively immutable for others (per-user edits live on `user_books`).
- The `on_auth_user_created` trigger creates a profile row.
- Anon key only in `config.ts`. No service role key anywhere in the repo or client env.

## TypeScript policy

`tsconfig.json` enables type checking with `strict: true` but keeps `noImplicitAny` and `strictNullChecks` off. The view layer is DOM-event-heavy vanilla JS; turning those on would require a large cast-only rewrite with little payoff. The shared shapes in `types.ts` still catch wrong assignments and wrong arguments. Tighten incrementally, one view at a time.

## Testing

See `docs/TESTING.md`. `npm test` runs the Vitest suite; `npm run typecheck` and `npm run build` run in CI-equivalent fashion via the Netlify build command.
