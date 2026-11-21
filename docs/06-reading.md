# 06. Reading your own books

Pawsage is a home for books you've already downloaded. Nothing is fetched from an outside book source — the reader works entirely with files on the device.

## Importing

- **Library → "your books" → add files** picks one or more **PDF, EPUB or TXT** files from the phone.
- Files are stored in **IndexedDB** (`js/files.ts`), so they stay on the device and survive reloads and offline use. Nothing is uploaded.
- Each imported book gets a real cover when possible:
  - **PDF** → page 1 is rendered to a small JPEG thumbnail (`js/coverextract.ts`).
  - **EPUB** → the cover image declared in the EPUB metadata is extracted (`js/epub.ts`).
  - **TXT** → a stable colour gradient generated from the title.
- The shelf shows each book's cover, file size and reading progress; a small trash button removes it.

## Reading

Tap any book on the personal shelf:

- **PDF** pages are rendered with `pdfjs-dist` into the same paper-like shell. Previous/next, progress and page position are saved.
- **EPUB** and **TXT** are converted to clean, paginated text (`js/epub.ts` → `js/reader.ts`): chapter detection, comfortable page lengths, chapter labels, page progress.
- Progress (`progress` + `location`) is saved per book in IndexedDB after every page turn, so reopening resumes where you left off.
- The bottom nav is hidden while reading for a quiet, book-like feel.

Larger libraries are fine up to the browser's IndexedDB quota; individual files over 40 MB are rejected with a friendly message.

## Technical notes

- `js/files.ts` — IndexedDB wrapper for stored books.
- `js/coverextract.ts` — PDF/EPUB cover extraction (pdf.js loaded lazily).
- `js/epub.ts` — EPUB unzip/spine/text extraction via JSZip (no iframe renderer).
- `js/reader.ts` — pure text cleaning, chapter splitting and pagination helpers (unit-tested).
- `js/views/local.ts` — the "your books" shelf and import flow.
- `js/views/localread.ts` — the shared reader shell for all three formats.
- A small legacy `#/pdf` quick-open route remains under More for opening one PDF without adding it to the shelf.

The main bundle stays ~96 KB; pdf.js and the EPUB/cover helpers load as separate chunks only when needed.
