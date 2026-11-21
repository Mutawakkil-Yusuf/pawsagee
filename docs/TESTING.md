# Testing

## Automated

```
npm test          # Vitest, jsdom environment
npm run typecheck # tsc --noEmit
npm run build     # typecheck + production build (run by Netlify)
```

Current unit coverage (`tests/`):

- `streaks.test.ts` — day keys, day bucketing, current/longest streak, week strip, month grid/stats, celebration keys, formatters
- `timer.test.ts` — timestamp-derived elapsed time, pause/resume idempotency, persistence
- `html.test.ts` — escaping, safe/raw interpolation, arrays/null/false, DOM construction
- `covers.test.ts` — candidate ordering and URL construction
- `grads.test.ts` — deterministic gradient hashing

Hooks that are worth adding tests for next: `openlibrary.search()` fallback logic (mock `fetch`), and `actions.setStatus` with a mocked backend.

## Manual checklist (per release)

1. `npm run dev`, open the URL, walk Splash → Welcome → Shelves → Ritual → Sign up.
2. Demo mode: set a name, confirm Home renders, load sample books from More.
3. Home → `start a session` → step pages → finish → confirm the toast and the book's progress.
4. Add a book via search, via manual entry, and (over https) via ISBN scan.
5. Library: filter chips, search, create/rename/recolor/reorder/delete a collection.
6. Book: rating, notes autosave (reload to confirm), status changes, overflow menu.
7. Stats: week/month/year ranges, calendar navigation, yearly goal editor.
8. Recap: month navigation, share/save image.
9. Go offline (DevTools), reload: cached shell + offline banner, then log pages and confirm the session queues and flushes on reconnect.
10. Install the PWA; confirm it opens standalone and `back()` never leaves the app.

## Two-user RLS check (before shipping account sync)

1. Create users A and B.
2. As A, add books and shelves. Confirm B sees none of A's rows.
3. As B, try to read or write A's rows by id through the Supabase client: both must fail.
4. Add the same book from Open Library as A and B. Each must be able to edit page count and see their own remembered cover (the `0003_user_overrides` regression).
