-- Per-user overrides for the shared books catalog.
--
-- Problem: `books` is shared, and the RLS policy "books update creator" only lets
-- the row's creator UPDATE it. When reader B links to a catalog row created by A,
-- B's cover backfill and page-count edits silently fail. Fix: keep the catalog
-- immutable and store those two values on user_books instead.
--
-- Safe to re-run.

alter table public.user_books
  add column if not exists cover_url text,
  add column if not exists page_count int check (page_count is null or page_count > 0);

comment on column public.user_books.cover_url is
  'Reader-specific fallback cover; takes precedence over books.cover_url.';
comment on column public.user_books.page_count is
  'Reader-specific page count; takes precedence over books.page_count.';

-- The client merges these into the catalog row at load time, so no other
-- application code changes are needed for existing data.

-- Older schemas shipped server-side streak helpers that used profiles.timezone.
-- The app computes streaks in the browser from device-local days, so those would
-- give two different answers. Drop them on projects that already ran the old schema.
-- Functions first: current_streak() depends on the reading_days view.
drop function if exists public.current_streak(uuid);
drop function if exists public.longest_streak(uuid);
drop view if exists public.reading_days;
drop view if exists public.finished_per_year;
