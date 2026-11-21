# 03. Screens

14 app screens, designed at 390 by 844 (Recap is 390 by 693). Copy comes from `01-brand.md`. The implemented screens are the source of truth; any external reference boards are not included in this repo.

Routes are hash routes (see `04-architecture.md`). Bottom nav shows on routes marked "nav".

## Flow overview

```
splash -> welcome -> shelves -> ritual -> signup -> home
home <-> library <-> book -> log -> celebrate -> recap
home -> add -> (book added) -> library
stats -> recap
library (0 books) = empty
```

## Onboarding

### 1. Splash `#/splash` (no nav)
Violet gradient fill, centered mark, wordmark, tagline, sleepy Mochi. Auto-advances to Welcome after 3.2 s (or immediately if the user taps). If a session exists, skip straight to Home.

### 2. Welcome `#/welcome` (no nav)
Full-body Mochi waving on a lilac blob. Eyebrow, title, body, primary `continue`, ghost `skip` (sets `onboarded` and goes to signup). Page dots 1 of 3.

### 3. Shelves `#/shelves` (no nav)
Illustration of colorful shelf cards. Dots 2 of 3. `continue`, `skip`.

### 4. Ritual `#/ritual` (no nav)
Mochi with a speech bubble over a 7-day strip. Dots 3 of 3. Primary `let's go` leads to signup.

### 5. Sign up `#/signup` (no nav)
Mark, title, body. Buttons: continue with apple (hidden until Apple sign-in exists), continue with google, continue with email. Email opens a field plus `send magic link`. After sending show the "check your inbox" copy with Mochi curious. `log in` link for returning users. Legal line at the bottom. Success lands on Home and sets `profiles.onboarded_at`.

## Core

### 6. Home `#/home` (nav)
Data: current streak, today's pages and minutes versus goals, the book currently being read (most recently updated `reading`), up to 3 recent books, the 7-day strip.
Layout top to bottom: greeting with avatar, Mochi plus bubble (rotating line), hero "continue reading" card with cover, progress and `continue` button, three quick actions (log pages, timer, add book), streak card with the week strip, "recent" horizontal row with a "see all" link to Library.
Navigation: hero title opens Book. `continue`, `log pages` and `timer` open Log for that book. `add book` opens Add.
States: no books -> render Empty content instead of the hero. Returning after 3+ days -> Mochi miss-you face and the welcome-back line. Loading -> skeleton for the hero and strip.

### 7. Library `#/library` (nav)
Title `my shelf`, subtitle `{n} books · {m} collections`. Search icon button, filter chips (all, reading, up next, done), collections as colored cards in a 2-column grid with a dashed "new collection" card, then a book grid (3 columns) or list toggle.
Actions: tap a collection to filter, long-press a collection to rename, recolor or delete in a bottom sheet. Tap a book to open Book.
States: 0 books -> Empty screen. Loading skeleton. Error -> Mochi apologizes with a retry button.

### 8. Empty `#/library` with zero books (nav)
Dashed card with sleeping Mochi on an empty shelf line, title, body, primary `add your first book`, link `or scan an isbn` (opens Add on the scan tab).

### 9. Add `#/add` (nav)
Segmented control: search, scan isbn, manual. Search field autofocus, 350 ms debounce, minimum 2 characters. Result rows with cover (from `cover_i`), title, author, year, and an add button. Tapping a row expands it in place to reveal three status chips (want to read, reading, finished) and an optional shelf picker, then `add to my shelf`.
Data: `https://openlibrary.org/search.json?q=...&limit=12&fields=key,title,author_name,first_publish_year,cover_i,number_of_pages_median,isbn`.
States: idle (Mochi curious plus a few popular prompts), loading (skeleton rows), no results (not-found copy), network error (generic error plus retry), added (toast with undo, stay on page so more books can be added).
Footer line: `covers from Open Library`.

### 10. Book `#/book/:id` (no bottom nav; back button)
Mochi reading. Large cover, title, author, status chip (tap to change in a sheet), star rating (half stars), progress bar with `{current} of {total} pages`, three stat tiles (pages left, sessions, minutes), shelf chips, notes field (autosave with 600 ms debounce). Primary `start a session` opens Log. Overflow menu: mark finished, move shelf, favorite, remove (confirm copy in brand doc).
Marking finished sets `status`, `finished_at` and opens Celebrate (finished-book variant).

### 11. Log `#/log/:id` (no nav, immersive)
Reading session. Deep violet background, big timer ring with elapsed time, play and pause control, page stepper (`i'm on page`), running line (`{n} pages so far`), primary `finish session`.
Behavior: timer counts from `startedAt`, stored in `localStorage` so it survives reloads and backgrounding (compute elapsed from timestamps, never from interval ticks). `finish session` writes a `reading_sessions` row (start_page, end_page, duration_sec). If the book reaches its last page ask once "finished the book?" in a sheet. Then go to Celebrate if a streak milestone was hit, otherwise back to Book with the end-of-session toast.
Manual log variant (from Home `log pages`): same screen without the timer, just the stepper and `save`.

### 12. Stats `#/stats` (nav)
Segmented range: week, month, year. Yearly goal ring (`finished_per_year`), streak and longest streak tiles, pages and minutes charts (simple SVG bars, no chart library), month calendar with read days, top shelf, and a `share recap` button that opens Recap. Mochi bubble only when the goal ring is above 25%.

## Moments

### 13. Celebrate `#/celebrate?type=streak&n=7` (no nav)
Gradient background, confetti, cheering Mochi, white card with overline `STREAK UNLOCKED`, title `{n} days in a row!`, the day-dot row, two stat tiles (pages today, minutes today). Buttons `share` (opens Recap) and `keep going` (Home). Close X top right. Variants: `type=finished` (book cover replaces the day dots) and `type=goal`. Triggered after a session on milestones 3, 7, 14, 30 and 100, a finished book, or a hit yearly goal. Shown at most once per milestone.

### 14. Recap `#/recap?month=YYYY-MM` (no nav)
A 9:16 share card (render at 1080 by 1920): Mochi cheering, month name, big numbers (books, pages, minutes, best streak), top book cover, wordmark footer. Below it on screen: `share` (Web Share API with PNG file) and `save image`. Numbers must equal Stats for that month.

## Cross-cutting

- Back behavior: header back arrow on Book, Log, Add (when opened from Empty), Recap. Android back button must work through the hash router.
- First load with no connection: show the shell plus the offline banner, and read the last cached data from `localStorage`/IndexedDB.
- Pull to refresh is not needed. Realtime is not needed.
