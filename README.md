# Pawsage

A cozy reading tracker. Vanilla HTML/CSS/JS (no build step), Supabase, Netlify, installable PWA.

## Open it on your phone
A phone can't open the zip's files directly. Deploy first (drag the folder into Netlify), then open the https link on your phone. On Android tap the install prompt; on iPhone use Share > Add to Home Screen. The barcode scanner needs that https link too.

## Run it now (demo mode)
```
npx serve -s .        # or: python3 -m http.server 8000
```
Open the printed URL. With `js/config.js` left empty the app runs in **demo mode**: everything is stored on this device in localStorage. Settings > "load sample books" fills it with sample data.

## Connect Supabase (real accounts and sync)
1. Create a project at supabase.com. In **SQL editor**, review and run `supabase/schema.sql`.
2. Project settings > API: copy the **Project URL** and **anon public key** into `js/config.js`. Never use the service role key here.
3. Sign-in is a 6-digit emailed code (the link still works too). **Edit both email templates** (Magic Link and Confirm signup) to include `{{ .Token }}`: see `docs/EMAIL-TEMPLATES.md`. Without that the email has only a link.
4. Authentication > URL configuration: set the Site URL to your deployed URL and add `http://localhost:8000` as a redirect URL. Magic links use PKCE, so the link must be opened in the same browser that requested it.
5. Authentication > Providers: enable Email. Enable Google if you want that button to work (needs a Google OAuth client).
6. Test RLS with two accounts: books and shelves of A must be invisible to B.

## Deploy on Netlify
Drag the folder into Netlify, or connect the repo. `netlify.toml` already has the SPA fallback and security headers (CSP allows only self, Supabase, Open Library covers). Bump `VERSION` in `sw.js` on every release so installed apps update.

## Where things are
- `js/db.js`: all data access (demo and Supabase backends with identical shapes)
- `js/sound.js`: synthesized sound effects (no audio files). `data-sfx="name"` on an element picks its sound, `data-sfx="none"` silences it
- `js/ui.js`: icons, Mochi, covers, rings, toast, sheet, confetti
- `js/views/*`: one file per screen
- `css/tokens.css`: brand tokens. `docs/`: brand, design system, screens, architecture

## Covers
Each book tries, in order: Open Library by cover id, a stored cover_url, Google Books (looked up by ISBN or title and author), Open Library by ISBN, then a generated cover. Books without a cover get a background lookup and the result is remembered. If you ran the first schema.sql already, run `supabase/migrations/0002_covers.sql` too.

## Known limits
- Reminders are an in-app nudge on Home. Real push notifications are not built.
- Apple sign-in is not built (needs an Apple developer account).
- Streaks and stats are computed in the browser from the last 400 days of sessions.
- Cover images load from Open Library. Missing covers fall back to generated ones.
