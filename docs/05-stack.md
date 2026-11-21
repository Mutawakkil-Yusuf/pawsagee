# 05. Stack decision

## What Pawsage is optimizing for

- A cozy reading companion for people who want a gentle daily ritual, not a productivity scoreboard.
- Mobile-first, offline-capable, installable.
- One maintainer. "Small enough to read all of it in an afternoon" is a product constraint, not a throwaway line.
- Free/cheap static hosting and near-zero operations.

## Chosen stack

| Layer | Choice | Why |
|---|---|---|
| UI | Vanilla ES modules + hand-written CSS | No framework tax, no abstraction over the DOM, full control over the distinctive design |
| Tooling | Vite, TypeScript | HMR, type checking, hashed assets, tree-shaking — without changing the app architecture |
| Tests | Vitest + jsdom | Pure-logic coverage for the parts that can silently corrupt reading history |
| PWA | vite-plugin-pwa (generateSW) | Precache manifest derived from real build output; no VERSION drift |
| Backend | Supabase (Postgres, Auth, RLS) | Magic-link/Google auth and per-user RLS were the right call and are already built |
| Hosting | Netlify, static `dist/` | Already configured, free, zero server to operate |

Supabase is imported **dynamically**, so demo mode ships no Supabase code at all (Vite also tree-shakes it when config is empty).

## Why not a framework / Next.js / native?

- **React/Vue/Svelte** would mean rewriting ~2k lines of working views for a component model the app doesn't need yet. Consider it only if another maintainer joins or the UI state gets genuinely complex.
- **Next.js on Vercel** buys SSR/SEO and server actions. Pawsage is an offline-first, local-day, per-device app; SSR fights those properties. Revisit only if a public content site becomes a real goal.
- **Expo/React Native** is the right move only if real push notifications and app-store presence become core. Web push via the service worker (Android + iOS 16.4+ installed PWAs) is the cheaper next step before going native.

## Deliberate tradeoffs

- `noImplicitAny` and `strictNullChecks` are off for now (see `04-architecture.md`). This is a transitional choice, not a claim of full strictness.
- Cover images come from public APIs with no keys; rate limits and missing covers are expected and handled with generated fallbacks.
- Streaks are client-authoritative (see `04-architecture.md`). There is intentionally no second SQL implementation.
