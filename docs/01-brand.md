# 01. Brand

## Essence

Pawsage is a reading companion, not a productivity tracker. The whole product leans on one idea: **a tiny daily ritual with a cat who keeps your place.**

- **Personality:** warm, playful, calm, slightly sleepy.
- **Voice in three words:** warm, playful, never guilt.
- **Looks like:** lavender air, violet ink, candy accents (pink, butter, mint), round shapes everywhere.
- **Never looks like:** a spreadsheet, a fitness app, a corporate dashboard, anything neon or high-pressure.

## Name and wordmark

- Written **pawsage**, always lowercase, in the UI and in the logo. In running prose in docs and store listings, "Pawsage".
- Wordmark: Nunito 900, letter-spacing -4%. "paw" in violet-600 `#5B4BC4`, "sage" in ink `#3B2F5C`. On dark backgrounds: "paw" in lilac-300 `#D9CCFF`, "sage" in white.
- Files: `assets/logo/wordmark.svg` (needs Nunito installed or embedded) and `assets/logo/wordmark-reversed.svg`.

## Logo mark

Mochi peeks over an open pink book on a violet squircle. Closed smiling eyes, always.

- `assets/logo/mark.svg`: rounded squircle, for avatars, favicons and in-app use.
- `assets/logo/app-icon-1024.svg`: full-bleed square master. Export 1024 px PNG for the stores and let iOS and Android apply their own corner masks. Also export 512, 192 and 180 px PNGs for the web manifest and apple-touch-icon.
- Clear space equals Mochi's ear height (about 25% of the mark) on every side. Minimum mark size 24 px. Minimum wordmark width 80 px.
- Do not stretch, rotate, outline, recolor, add shadows to the wordmark, or place on busy photos.

## Mascot: Mochi

A cream cat with pink inner ears, pink cheeks and nose, three faint stripes on the forehead, and a curled tail. Always outlined in ink `#3B2F5C` at 3 to 4 px (at the 120 px design scale). Same shape in every pose. Only the eyes and mouth change.

| File | Expression | Use it for |
|---|---|---|
| `mochi-happy.svg` | closed smiling eyes | default: Home, welcome, logo |
| `mochi-curious.svg` | wide round eyes | Add book, search, loading |
| `mochi-sleepy.svg` | closed drooping eyes, tiny "o" mouth, "zz" | empty shelf, splash, quiet states |
| `mochi-cheering.svg` | star eyes, open smile | streak milestones, finished book, goal hit, recap |
| `mochi-miss-you.svg` | worried brows, one tear, small frown | returning after 3+ days away. Gentle, never scolding. |
| `mochi-reading.svg` | round violet glasses, eyes down | Book detail, reading session |
| `mochi-full.svg` | full body, waving | welcome screen and brand moments |

Rules: one Mochi per screen except onboarding. Minimum 56 px tall. Bubble style is white, radius 22, a 16 px rotated-square tail, text 15 px weight 800, at most two lines. Tapping Mochi is always safe: a tiny bounce (scale 1 to 1.06 to 1, 320 ms spring) and nothing else.

## Voice rules

1. Lowercase for headings, buttons, tabs and chips. Normal sentence case for body paragraphs.
2. Short. One idea per line. Contractions are fine.
3. Mochi talks in first person, present tense, and stays a little shy. Mochi never nags.
4. Describe what happened, not what the user failed to do. "welcome back. mochi saved your spot." beats "you missed 3 days".
5. No exclamation spam. One "!" per screen at most, saved for real wins.
6. No emoji in UI chrome. Mochi is the emoji.
7. Plain error language. Say what happened and what to try. Never show codes to the user.

## Copy bank

Use these strings exactly. `{n}`, `{title}` and friends are placeholders.

**Onboarding**
- welcome eyebrow: WELCOME TO PAWSAGE
- welcome title: your cozy corner for books
- welcome body: Keep every book you read on one pretty shelf, and let Mochi nudge you back to the page.
- shelves eyebrow: CUSTOMIZE
- shelves title: build shelves that feel like you
- shelves body: Group books into collections, pick a color for each, and arrange them the way your own shelf looks at home.
- ritual title: a tiny ritual, every day
- ritual body: Read a few pages, watch your streak grow, and let Mochi cheer you on.
- ritual bubble: ten pages is enough. i'll keep your spot!
- sign-up title: start your shelf
- sign-up body: Sign in to sync your books and streak across every device.
- buttons: continue, skip, let's go, continue with email, continue with apple, continue with google, log in
- legal line: By continuing you agree to the Terms and Privacy Policy.

**Home**
- greeting: hi, reader (use the first name when known: "hi, {name}")
- bubble examples (rotate, never repeat twice in a row): psst... one chapter before bed? · ten pages is enough for today. · your book is right where you left it. · no rush. mochi is warming the page.
- quick actions: log pages, timer, add book

**Library and shelves**
- title: my shelf · subtitle: {n} books · {m} collections
- chips: all, reading, up next, done
- new collection prompt: new collection
- empty title: this shelf is lonely
- empty body: Add the book you're reading right now and Mochi will keep your place.
- empty actions: add your first book, or scan an isbn

**Add book**
- title: add a book · tabs: search, scan isbn, manual
- result count: {n} results · attribution line: covers from Open Library
- status buttons: want to read, reading, finished
- not found: Can't find it? Switch to manual and Mochi will help you add it yourself.
- toast on add: on the shelf! mochi approves. (action: undo)

**Book and session**
- eyebrow on Book: NOW READING · statuses: want to read, reading, finished
- start button: start a session · session eyebrow: READING SESSION
- stepper label: i'm on page · running line: {n} pages so far · goal today is {goal}
- finish button: finish session · pause label (accessible only): Pause timer
- session end toast: nice! {n} pages today. that's a whole chapter. (use only when n is 10 or more; otherwise "nice! {n} pages today.")

**Moments**
- streak 3: 3 days in a row, you're on a roll.
- streak 7 (title "7 days in a row!"): A whole week. Mochi is doing a little dance.
- streak 14: two weeks. mochi is purring.
- streak 30: 30 days. mochi is speechless.
- streak 100: 100 days. you and mochi are legends.
- streak restart after a gap: fresh start today. mochi isn't counting, you are.
- welcome back after 3+ days (Mochi miss-you face): welcome back. mochi saved your spot.
- finished a book: you finished {title}! mochi did a little dance.
- yearly goal hit: that's {goal} books. mochi is so proud of you.
- stats bubble: Mochi is so proud of you (only when the yearly goal ring is above 25%)

**System**
- reminder push: mochi is cozied up with a book. join?
- offline banner: no wifi, no worries. it all saves on your phone.
- generic error: mochi dropped something. try again?
- sign-in link sent: check your inbox. mochi sent a magic link.
- sign-in failed: that link didn't work. want a fresh one?
- delete confirm: remove this book? your notes and sessions go too. (buttons: keep it, remove)

## Imagery and illustration

- No stock photos. Every image is a cover (real or generated), Mochi, or a flat pastel shape.
- Generated cover (when there is no real cover): a 160-degree gradient from the list in `02-design-system.md`, title in Nunito 900 at the bottom-left, with an inner left-edge highlight to look like a book spine. Pick the gradient by hashing the title so it is stable.
- Confetti (celebration only): small pill and dot shapes in white, pink, butter, mint and violet-500.
