# 02. Design system

All values live in `design/tokens.css`. This file explains how to use them. The visual boards are in `reference/` (start with `reference/color.png` and `reference/components.png`).

## Color rules

| Role | Token | Notes |
|---|---|---|
| Text | `--ink` | Default. Headings and body. |
| Secondary text | `--muted` | Only on mist, blush, white. 5.09:1 on mist. |
| Primary fill | `--violet-500` | Buttons, active nav, selected chips. White text only. |
| Link / text on light / pressed | `--violet-600` | Use this, not violet-500, for violet text on light surfaces. |
| App background | `--bg-app` | Mist to blush, 180 degrees. |
| Cards | `--white` | Sometimes 88 to 94% white with blur on top of gradients. |
| Accent fills | pink, butter, mint, sky (and soft or deep variants) | Ink text only. Used for stat tiles, shelf colors, chips, covers. |

Forbidden pairings: white on pink, butter, mint or sky. Violet-500 text on mist (4.44:1). Muted `#8B80A8` for any text (3.29:1). Never red. Missed days are lilac-100 with muted text.

Shelf colors map to: rose = pink-soft, lilac = lilac-300, mint = mint, butter = butter, sky = sky. The tiny shelf swatch uses the deep variant.

## Typography

Nunito only. Weights 600, 700, 800, 900. Headings, buttons, tabs and chips are lowercase. Overlines are uppercase with 8 to 14% tracking.

| Style | Size / weight | Use |
|---|---|---|
| display | 36 / 900 | screen titles ("my shelf"), big numbers |
| title | 28 / 900 | section titles, empty states |
| heading | 22 / 900 | card titles |
| body | 15 / 700 | paragraphs. Line height 1.45 to 1.5 |
| label | 13 / 800 | chips, meta rows |
| caption | 12 / 800 | tab labels, tiny meta |
| overline | 12 / 900 uppercase | eyebrows ("WELCOME TO PAWSAGE") |

Minimum text size anywhere: 11 px (tab labels only). Body text never below 14 px.

## Shape, depth, spacing

- Radii: chips 14, inputs 22, buttons are full pills (28 for 56 px tall), cards 30, bottom sheets 36 (top corners), nav is a 34 px pill.
- Shadows are always violet-tinted, never grey. Use `--sh-sm` on small cards, `--sh-md` on large cards, `--sh-cta` on the primary button, `--sh-nav` on the nav.
- 4 pt spacing grid. Screen gutter is 20 px. Gap between cards 12 to 16. Section gap 24 to 32.
- Safe areas: add `env(safe-area-inset-bottom)` to the nav bottom offset (22 px base).

## Components

Build each as a small CSS class plus a tiny JS render function. Names are suggestions.

**Button (`.btn`)**
- Primary: 56 px tall (hero 60), pill, `--violet-500`, white text 900 17 px lowercase, `--sh-cta`. Pressed: `--violet-600`, scale .98 over 180 ms. Disabled: lilac-300 background, muted text, no shadow.
- Secondary: white, ink text, `--sh-sm`.
- Ghost/link: no background, `--violet-600` text 900 15 px, min height 44.
- Icon button: 44 by 44 circle, white 85% with ink icon.
- Only one primary per screen.

**Chip (`.chip`)**: 36 px tall, radius 14, label 13/800. Off: white with `--sh-sm`. On: violet-500 with white text. Filter chips in a horizontally scrolling row without scrollbar.

**Segmented control**: 48 px tall pill track in lilac-100, selected segment white with `--sh-sm`, text 800 14 px.

**Input**: 56 px tall, radius 22, white, 2 px lilac-300 border, 16 px padding, ink text, muted placeholder. Focus: border violet-500 plus focus ring. Error: border pink, message in ink on pink-soft chip below. Search input has a leading magnifier icon and a trailing clear button.

**Switch**: 52 by 32 pill. Off lilac-300, on violet-500, white knob, spring on toggle.

**Stepper**: minus and plus 52 px circles (white, ink icons), number in display style between them. Long press repeats after 400 ms.

**Cards**: white, radius 30, padding 16 to 20, `--sh-md`. Stat tiles use accent fills (butter, mint, pink-soft, sky), radius 20, number 22/900 over a 12/800 label.

**Progress**: bar 10 px tall pill on lilac-100, fill violet-500 (or accent). Ring (goal ring) is an SVG circle, stroke 14, round caps, number in the middle.

**Calendar days**: 36 px circles. Read day: violet-500 with white check. Today: pink with ink check and white double ring. Missed or future: lilac-100 with muted number. Never red, never an X.

**Floating nav (`.nv`)**: fixed, left and right 16, bottom 22, height 68, radius 34, white 88% with 16 px backdrop blur, `--sh-nav`. Five items: home, shelf, add, stats, more. Each is a 62 by 54 pill with a 22 px icon and 11/800 label. Active item is violet-500 with white content and `aria-current="page"`. Hide it on Splash, Welcome, Shelves, Ritual, Sign-up, Log (session) and Celebrate.

**Book row**: 72 px cover (3:4.4, radius 10, spine highlight) plus title 16/900, author 13/700 muted, status chip, progress bar when reading. The whole row is one link.

**Generated cover**: 160-degree gradient picked by hash from: violet (`#8A78FF` to `#5B4BC4`), pink (`#FF8FB3` to `#FFC6E0`), mint (`#8FE0BF` to `#C8F0E0`), butter (`#FFD36B` to `#FFE8A3`), sky (`#8CCDF5` to `#B8E2F7`), and a deep violet (`#4A3C9E` to `#6C57E8`). Text on violet and deep violet covers is white. Text on the others is ink.

**Toast**: floating pill above the nav, ink background `#3B2F5C`, white 14/800 text, optional ghost action in lilac-300. Auto-dismiss 3.5 s. `role="status"`.

**Bottom sheet**: white, top radius 36, 5 by 40 grab handle in lilac-300, scrim `rgba(59,47,92,.35)`. Opens with a 320 ms spring. Closes on scrim tap, swipe down and Escape.

**Mochi bubble**: white, radius 22, 16 px rotated-square tail pointing at Mochi, 15/800 text, max two lines, `--sh-sm`.

## Interaction states

Every interactive element needs default, pressed (180 ms, scale .98 and a shade darker), focus-visible (ring), disabled, and loading (replace label with three bouncing lilac dots, keep width). Skeletons: lilac-100 blocks with a slow 1.6 s shimmer, disabled under reduced motion.

## Motion

- Taps: 180 ms ease-out scale to .98.
- Screen change: 220 ms fade plus 12 px rise. No slide-overs except bottom sheets.
- Mochi: 320 ms spring (`--spring`), never faster, never looping except the sleepy "zz" fade on Empty and Splash.
- Celebration: confetti pieces fall 1.8 s once, then stop.
- All motion collapses to opacity fades under `prefers-reduced-motion`.

## Accessibility

- All text AA or better using the pairings above. Tap targets 44 px minimum.
- Mochi SVGs get `role="img"` with a short `aria-label` ("Mochi the cat, reading"). Confetti and decorative blobs are `aria-hidden`.
- Streak and calendar visuals have text equivalents ("Seven days read in a row").
- Timer announces only on minute changes, not every second (`aria-live="off"` on the ticking digits, a separate polite region for the minute).
- Language `en`. Support Dynamic Type up to 130% without clipping.
