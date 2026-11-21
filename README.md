# Pawsage

A cozy reading tracker. Vanilla UI (no framework), Vite + TypeScript tooling, Supabase, Netlify, installable PWA. Import your own downloaded books and read them right in the app.

## Run it locally

```
npm install
npm run dev          # Vite dev server with HMR
```

Open the printed URL. With `js/config.js` left empty the app runs in **demo mode**: everything is stored on this device in localStorage. Settings > "load sample books" fills it with sample data.

```
npm test             # Vitest suite (pure logic: streaks, timer, escaping, covers)
npm run typecheck    # tsc --noEmit
npm run build        # typecheck + production build into dist/ (PWA included)
npm run preview      # serve the built dist/ locally
```

There is no framework and no runtime dependency to install in the browser. Supabase is imported lazily only when `config.js` is filled in, so demo mode never downloads it.

## Open it on your phone

A phone can't open the dev server from your computer. Deploy first (connect this repo to Netlify — `netlify.toml` already builds and publishes `dist/`), then open the https link on your phone. On Android tap the install prompt; on iPhone use Share > Add to Home Screen. The barcode scanner needs that https link too.

## Connect Supabase (real accounts and sync)

1. Create a project at supabase.com. In **SQL editor**, review and run `supabase/schema.sql`.
2. If you already ran an earlier version of the schema, also run `supabase/migrations/0003_user_overrides.sql` (per-user cover and page-count overrides). `0002_covers.sql` is already folded into `schema.sql`.
3. Project settings > API: copy the **Project URL** and **anon public key** into `js/config.js`. Never use the service role key here.
4. Sign-in is a 6-digit emailed code (the link still works too). The live project uses a Send Email Auth Hook (`supabase/functions/send-otp`) that emails through Brevo, because Supabase's free tier can't edit the built-in templates. Setup and verification steps are in `docs/EMAIL-TEMPLATES.md`.
5. Authentication > URL configuration: set the Site URL to your deployed URL and add `http://localhost:5173` as a redirect URL. Magic links use PKCE, so the link must be opened in the same browser that requested it.
6. Authentication > Providers: enable Email. Google sign-in is hidden in the UI until a Google OAuth client is configured.
7. Test RLS with two accounts: books and shelves of A must be invisible to B, and A's catalog rows must remain editable by A.

## Deploy on Netlify

Connect the repo. `netlify.toml` sets `npm ci && npm run build`, publishes `dist/`, has the SPA fallback and security headers. The service worker and precache manifest are generated from the build output by `vite-plugin-pwa`, so there is no VERSION string to bump — every release emits fresh hashed assets and a fresh SW.

## Where things are

- `js/db.ts`: all data access (demo and Supabase backends with identical shapes)
- `js/sound.ts`: synthesized sound effects (no audio files). `data-sfx="name"` on an element picks its sound, `data-sfx="none"` silences it
- `js/ui.ts`: icons, Mochi, covers, rings, toast, sheet, confetti
- `js/streaks.ts`: the single source of truth for streaks/stats (device-local days)
- `js/views/*`: one file per screen
- `css/tokens.css`: brand tokens. `docs/`: brand, design system, screens, architecture, stack, testing
- `public/`: static assets copied verbatim into the build (icons, fonts, Mochi SVGs, manifest, QR scanner)
- `tests/`: Vitest unit tests
- `js/files.ts`, `js/coverextract.ts`, `js/epub.ts`, `js/reader.ts`, `js/views/local.ts`, `js/views/localread.ts`: your personal offline bookshelf (see `docs/06-reading.md`)

## Covers

Each book tries, in order: Open Library by cover id, a stored cover_url (per-user override first), Google Books (looked up by ISBN or title and author), Open Library by ISBN, then a generated cover. Books without a cover get a background lookup and the result is remembered on **that reader's** `user_books` row, so it works even when the shared catalog row belongs to someone else.

## Reading

Library → **your books → add files** imports your downloaded PDF, EPUB or TXT files. They stay on your device, get real covers where available, and open in a clean paginated reader that remembers your place. See `docs/06-reading.md`.

## Known limits

- Reminders are an in-app nudge on Home. Real push notifications are not built (web push via the service worker is the next step; native only if app stores are a goal).
- Reading is for files you already have; the app doesn't fetch or distribute book text.
- Apple sign-in is not built (needs an Apple developer account).
- Streaks and stats are computed in the browser from the last 400 days of sessions.
- Cover images load from Open Library. Missing covers fall back to generated ones.
- TypeScript runs with `noImplicitAny` and `strictNullChecks` off (see `tsconfig.json`) to keep the DOM-heavy view code approachable; both can be tightened incrementally.
