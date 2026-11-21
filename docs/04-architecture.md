# 04. Architecture

Vanilla JS, ES modules, no build step. Everything is static files served by Netlify. Keep it small enough that one person can read all of it in an afternoon.

## File layout

```
/
├─ index.html                 shell: <div id="app">, nav, toast root, module script
├─ manifest.webmanifest
├─ sw.js                      service worker
├─ netlify.toml
├─ css/
│  ├─ tokens.css              copy of design/tokens.css
│  ├─ base.css                reset, body, focus, utilities
│  ├─ components.css          .btn .chip .card .nv .toast .sheet ...
│  └─ screens.css             per-screen layout classes
├─ js/
│  ├─ main.js                 boot: config, auth listener, router start, SW register
│  ├─ config.js               SUPABASE_URL, SUPABASE_ANON_KEY (public values)
│  ├─ router.js
│  ├─ store.js                tiny observable state
│  ├─ db.js                   all Supabase calls live here, nowhere else
│  ├─ openlibrary.js          search, cover URL, normalize
│  ├─ session-timer.js        timestamp-based timer + localStorage persistence
│  ├─ streaks.js              milestone detection, celebrate-once flags
│  ├─ ui/html.js              safe template tag
│  ├─ ui/components.js        button(), chip(), bookRow(), cover(), mochi(), toast(), sheet()
│  └─ views/                  splash.js welcome.js ... one file per screen
├─ assets/                    from this pack (logo, mochi, icons)
├─ fonts/                     Nunito woff2, weights 600 to 900
└─ docs/
```

Supabase JS client: load from `https://esm.sh/@supabase/supabase-js@2` pinned to an exact version, or vendor the file into `js/vendor/`. Vendoring is preferred so offline start works.

## Routing

Hash router. `#/home`, `#/library`, `#/add`, `#/book/:id`, `#/log/:id`, `#/stats`, `#/celebrate`, `#/recap`, onboarding routes as in `03-screens.md`.

```js
// router.js
const routes = [];                         // [{ pattern: RegExp, keys: [], view: fn }]
export function route(path, view) { /* compile ':id' to a RegExp */ }
export function start() {
  const go = async () => {
    const [path, qs] = (location.hash.slice(1) || '/splash').split('?');
    const match = find(path);
    const params = { ...match.params, ...Object.fromEntries(new URLSearchParams(qs)) };
    if (match.auth && !store.get().session) return (location.hash = '#/welcome');
    app.replaceChildren(await match.view(params));   // views return a DOM node
    document.body.dataset.nav = match.nav ? 'on' : 'off';
    app.focus();                                      // move focus for screen readers
  };
  addEventListener('hashchange', go); go();
}
```

Auth guard: everything except onboarding routes needs a session.

## Safe templating (security rule 6)

```js
// ui/html.js
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const raw = s => ({ __raw: String(s) });
export function html(strings, ...vals) {
  const out = strings.reduce((acc, s, i) => {
    const v = vals[i - 1];
    const part = Array.isArray(v) ? v.map(x => x?.__raw ?? esc(x)).join('') : (v?.__raw ?? esc(v));
    return acc + part + s;
  });
  return out;
}
```

Use `html` for every template that contains data. `raw()` only for trusted static SVG from `assets/`. Never put Open Library strings, titles, notes or names into `innerHTML` any other way. Use `textContent` for single values.

## State

`store.js` is an object plus subscribers. Keep it flat: `session`, `profile`, `shelves`, `userBooks` (joined with `books`), `activeSession` (timer), `online`. Views read from the store and call functions in `db.js`. After a write, update the store optimistically and roll back on error with the generic error toast.

## Data layer (`db.js`)

One module, thin wrappers. Examples:

```js
export const listUserBooks = () => sb.from('user_books')
  .select('*, book:books(*), shelf_books(shelf_id)').order('updated_at', { ascending: false });

export async function addBook(olDoc, status = 'want', shelfId = null) {
  // 1. upsert the catalog row by ol_work_key (insert if new, never overwrite someone else's row)
  let { data: book } = await sb.from('books').select('*').eq('ol_work_key', olDoc.key).maybeSingle();
  if (!book) {
    ({ data: book } = await sb.from('books').insert({
      ol_work_key: olDoc.key, ol_cover_id: olDoc.cover_i ?? null,
      title: olDoc.title, authors: olDoc.author_name ?? [],
      first_publish_year: olDoc.first_publish_year ?? null,
      page_count: olDoc.number_of_pages_median ?? null,
      created_by: (await sb.auth.getUser()).data.user.id,
    }).select().single());
  }
  // 2. link to user. unique(user_id, book_id) makes this idempotent
  const { data: ub, error } = await sb.from('user_books')
    .upsert({ user_id: uid(), book_id: book.id, status }, { onConflict: 'user_id,book_id', ignoreDuplicates: true })
    .select().maybeSingle();
  // 3. optional shelf
  if (shelfId && ub) await sb.from('shelf_books').upsert({ shelf_id: shelfId, user_book_id: ub.id });
  return { book, ub, error };
}
```

If two users insert the same `ol_work_key` at once the unique index makes one fail. Catch it and re-select.

Streak: `await sb.rpc('current_streak')`. Longest: `sb.rpc('longest_streak')`. Calendar: `sb.from('reading_days').select('*').gte('day', monthStart)`. Yearly goal: `sb.from('finished_per_year')`.

Set `profiles.timezone` from `Intl.DateTimeFormat().resolvedOptions().timeZone` at first sign-in and when it changes.

## Auth

- Supabase Auth: email magic link (`signInWithOtp`) and Google OAuth. Set Site URL and redirect URLs to the Netlify domain and `http://localhost:8888`.
- Keep the session in the default `localStorage` store. `onAuthStateChange` updates `store.session`.
- Show the "link didn't work" copy if the URL contains an auth error.

## Open Library (`openlibrary.js`)

```js
const BASE = 'https://openlibrary.org';
const FIELDS = 'key,title,author_name,first_publish_year,cover_i,number_of_pages_median,isbn';
const cache = new Map();
export async function search(q, { signal } = {}) {
  q = q.trim(); if (q.length < 2) return [];
  if (cache.has(q)) return cache.get(q);
  const r = await fetch(`${BASE}/search.json?q=${encodeURIComponent(q)}&limit=12&fields=${FIELDS}`, { signal });
  if (!r.ok) throw new Error('search failed');
  const docs = (await r.json()).docs ?? [];
  cache.set(q, docs); return docs;
}
export const coverUrl = (id, size = 'M') =>
  id ? `https://covers.openlibrary.org/b/id/${id}-${size}.jpg?default=false` : null;
export const byIsbn = async isbn => (await search(`isbn:${isbn}`))[0] ?? null;
```

- Debounce input 350 ms and abort the previous request with `AbortController`.
- `<img loading="lazy" decoding="async">` for covers, with `onerror` swapping to the generated cover. `?default=false` makes missing covers return 404 instead of a blank image.
- Be a good citizen: identify the app with a `User-Agent`-style note is not possible from browsers, so just keep requests low and cached.

## Reading session timer

```js
// session-timer.js
const KEY = 'pawsage.activeSession';
export const begin = (userBookId, startPage) =>
  save({ userBookId, startPage, startedAt: Date.now(), pausedMs: 0, pausedAt: null });
export const elapsedSec = s => Math.floor(((s.pausedAt ?? Date.now()) - s.startedAt - s.pausedMs) / 1000);
// pause(): pausedAt = now.  resume(): pausedMs += now - pausedAt; pausedAt = null.
// finish(endPage): insert reading_sessions row, clear the key.
```

The display redraws with `requestAnimationFrame` or a 1 s interval but always derives from timestamps. On boot, if the key exists, offer "resume session" via Mochi.

## Offline and PWA

- `manifest.webmanifest`: `name: "Pawsage"`, `short_name: "Pawsage"`, `display: "standalone"`, `background_color: "#F3EEFF"`, `theme_color: "#6C57E8"`, `start_url: "/#/home"`, icons 192, 512 (and maskable 512).
- `sw.js`: precache the shell (index, css, js, fonts, assets) with a versioned cache name. Strategy: cache-first for static files, stale-while-revalidate for Open Library covers (cap 200 entries), network-only for Supabase requests. Bump the cache version on every release.
- Queue failed `reading_sessions` inserts in `localStorage` (`pawsage.queue`) and flush on `online` and on boot. This is the only offline write path in the MVP.
- Show the offline banner when `navigator.onLine` is false.
- iOS: add `apple-touch-icon` (180), `apple-mobile-web-app-capable`, status bar `default`.

## Netlify (`netlify.toml`)

```toml
[build]
  publish = "."

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "camera=(self), geolocation=(), microphone=()"
    Content-Security-Policy = "default-src 'self'; img-src 'self' data: https://covers.openlibrary.org https://*.archive.org; connect-src 'self' https://*.supabase.co https://openlibrary.org; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; frame-ancestors 'none'"

[[headers]]
  for = "/sw.js"
  [headers.values]
    Cache-Control = "no-cache"
```

Remove the Google Fonts allowances after self-hosting. If using esm.sh instead of vendoring, add it to `script-src`.

## Security checklist

- RLS on every table (see schema). Test with two accounts before shipping M2.
- Anon key only in the client. No service role key anywhere in the repo or Netlify client env.
- Escape everything (see `html` tag). No `eval`, no inline event handlers, CSP blocks inline scripts.
- Validate lengths client-side to match the DB checks (title 300, shelf name 40).
- Don't log user data to the console.

## Testing (`docs/TESTING.md`, write it during M2)

Manual checklist per milestone plus the two-user RLS check: create users A and B, add books and shelves as A, confirm B sees none of them and cannot read or write A's rows by id through the Supabase client. Unit-test pure helpers (`elapsedSec`, streak milestone logic, `html` escaping, cover hashing) with plain Node `assert` scripts. No test framework needed.

## Environment

- `js/config.js` holds `SUPABASE_URL` and `SUPABASE_ANON_KEY` placeholders. The owner fills them in after creating the Supabase project.
- Local dev: `npx serve -s .` or `netlify dev`.
