# 06. Reading in the app

Pawsage can display actual book text on a phone, in two ways.

## Public-domain editions (`#/read/:id`)

Every book detail screen has **"read a free edition"**. Tapping it:

1. Looks for Archive.org identifiers from Open Library (stored when the book was added, or looked up on demand).
2. Prefers identifiers that are public-domain scans (`…gut`, older `…01aust`-style IDs) over borrow-only ones.
3. Fetches the clean Project Gutenberg `.txt` file when the Archive item has one; falls back to OCR text otherwise.
4. Cleans front matter, splits into chapters, and paginates into comfortable pages.

The reader keeps your page per book in localStorage, has a table of contents, text-size / line-spacing / paper-sepia-night settings, arrow-key and swipe navigation, and prefers the same warm visual language as the rest of the app. The body uses a serif face for long-form comfort — a deliberate exception to the Nunito-only UI rule.

If a book has no free edition, Mochi says so gently and sends you back to the book; nothing is lost.

## Your own PDFs (`#/pdf`)

More → **"read a pdf from your device"** opens a file picker. The selected PDF stays on the device — nothing is uploaded — and is rendered page by page with `pdfjs-dist`. You get page navigation, a slider, zoom controls, and the same paper-like shell. The pdf.js worker is bundled and precached so it works offline after the first load.

`pdfjs-dist` is loaded as a lazy route chunk so it does not inflate the main bundle (main app stays ~100 KB; the PDF reader is a separate ~336 KB chunk).

## Technical notes

- `js/reader.ts` holds the text discovery/cleaning/pagination logic (pure functions are unit-tested).
- `js/views/read.ts` and `js/views/pdfread.ts` are the two immersive views. Both hide the bottom nav.
- The CSP allows `archive.org` / `*.archive.org` in `connect-src`, and the service worker caches those responses.
- Open Library's cover ids are also used for the real book covers shown in onboarding; those images are bundled in `public/assets/covers/` so they work offline.
