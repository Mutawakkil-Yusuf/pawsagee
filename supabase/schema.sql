-- Pawsage database schema. Supabase (Postgres 15+).
-- Run once in the Supabase SQL editor, or save as supabase/migrations/0001_init.sql.
-- Review it before running. Everything is owner-only through Row Level Security.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.reading_status as enum ('want', 'reading', 'finished', 'paused');
create type public.shelf_color    as enum ('rose', 'lilac', 'mint', 'butter', 'sky');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created by trigger
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  display_name      text,
  timezone          text not null default 'UTC',          -- IANA name, e.g. 'Africa/Lagos'
  yearly_goal       int  not null default 12  check (yearly_goal between 1 and 365),
  daily_goal_pages  int  not null default 10  check (daily_goal_pages between 1 and 1000),
  daily_goal_minutes int not null default 20  check (daily_goal_minutes between 1 and 600),
  reminder_time     time,                                  -- null = reminders off
  onboarded_at      timestamptz,
  created_at        timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- books: shared catalog cache. Many users point at the same row.
-- ---------------------------------------------------------------------------
create table public.books (
  id                  uuid primary key default gen_random_uuid(),
  ol_work_key         text unique,            -- e.g. '/works/OL45804W'. Null for manual books.
  ol_cover_id         bigint,                 -- Open Library cover_i
  isbn13              text,
  title               text not null check (char_length(title) between 1 and 300),
  authors             text[] not null default '{}',
  first_publish_year  int,
  page_count          int check (page_count is null or page_count > 0),
  description         text,
  subjects            text[] not null default '{}',
  cover_url           text,                   -- fallback cover (e.g. Google Books) when Open Library has none
  created_by          uuid references auth.users (id) on delete set null,
  created_at          timestamptz not null default now()
);
create index books_isbn_idx  on public.books (isbn13);
create index books_title_idx on public.books using gin (to_tsvector('simple', title));

-- ---------------------------------------------------------------------------
-- shelves (collections)
-- ---------------------------------------------------------------------------
create table public.shelves (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  color       public.shelf_color not null default 'rose',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);
create index shelves_user_idx on public.shelves (user_id, sort_order);

-- ---------------------------------------------------------------------------
-- user_books: a user's relationship to a book
-- ---------------------------------------------------------------------------
create table public.user_books (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  book_id       uuid not null references public.books (id) on delete restrict,
  status        public.reading_status not null default 'want',
  rating        numeric(2,1) check (rating is null or rating between 0.5 and 5),
  current_page  int not null default 0 check (current_page >= 0),
  started_at    date,
  finished_at   date,
  is_favorite   boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, book_id)
);
create index user_books_user_status_idx on public.user_books (user_id, status);
create trigger user_books_updated_at
  before update on public.user_books
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- shelf_books: which books sit on which shelf (a book can be on many shelves)
-- ---------------------------------------------------------------------------
create table public.shelf_books (
  shelf_id      uuid not null references public.shelves (id) on delete cascade,
  user_book_id  uuid not null references public.user_books (id) on delete cascade,
  position      int  not null default 0,
  primary key (shelf_id, user_book_id)
);
create index shelf_books_user_book_idx on public.shelf_books (user_book_id);

-- ---------------------------------------------------------------------------
-- reading_sessions
-- ---------------------------------------------------------------------------
create table public.reading_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  user_book_id  uuid not null references public.user_books (id) on delete cascade,
  started_at    timestamptz not null default now(),
  duration_sec  int not null default 0 check (duration_sec >= 0),
  start_page    int not null default 0 check (start_page >= 0),
  end_page      int not null default 0 check (end_page >= 0),
  pages_read    int generated always as (greatest(end_page - start_page, 0)) stored,
  created_at    timestamptz not null default now()
);
create index reading_sessions_user_time_idx on public.reading_sessions (user_id, started_at desc);
create index reading_sessions_book_idx      on public.reading_sessions (user_book_id);

-- Keep the book's progress and status in step with the latest session.
create or replace function public.bump_user_book()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  tz text;
begin
  select coalesce(timezone, 'UTC') into tz from public.profiles where id = new.user_id;
  update public.user_books ub
     set current_page = greatest(ub.current_page, new.end_page),
         status = case when ub.status in ('want', 'paused')
                       then 'reading'::public.reading_status else ub.status end,
         started_at = coalesce(ub.started_at, (new.started_at at time zone coalesce(tz, 'UTC'))::date)
   where ub.id = new.user_book_id
     and ub.user_id = new.user_id;
  return new;
end $$;

create trigger reading_sessions_bump_book
  after insert on public.reading_sessions
  for each row execute function public.bump_user_book();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.books            enable row level security;
alter table public.shelves          enable row level security;
alter table public.user_books       enable row level security;
alter table public.shelf_books      enable row level security;
alter table public.reading_sessions enable row level security;

-- profiles: read and update only your own row (insert is done by the trigger)
create policy "profiles select own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- books: any signed-in user can read the catalog and add entries they created
create policy "books select all" on public.books
  for select to authenticated using (true);
create policy "books insert own" on public.books
  for insert to authenticated with check (created_by = (select auth.uid()));
create policy "books update creator" on public.books
  for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

-- shelves
create policy "shelves all own" on public.shelves
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- user_books
create policy "user_books all own" on public.user_books
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- shelf_books: both the shelf and the user_book must belong to you
create policy "shelf_books all own" on public.shelf_books
  for all to authenticated
  using (
    exists (select 1 from public.shelves s
            where s.id = shelf_id and s.user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.shelves s
            where s.id = shelf_id and s.user_id = (select auth.uid()))
    and exists (select 1 from public.user_books ub
                where ub.id = user_book_id and ub.user_id = (select auth.uid()))
  );

-- reading_sessions: yours only, and only against your own user_book
create policy "sessions all own" on public.reading_sessions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.user_books ub
                where ub.id = user_book_id and ub.user_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Views and functions (security invoker, so RLS still applies)
-- ---------------------------------------------------------------------------

-- One row per user per local calendar day with reading activity.
create or replace view public.reading_days with (security_invoker = true) as
select rs.user_id,
       (rs.started_at at time zone p.timezone)::date as day,
       sum(rs.duration_sec)::int                     as seconds,
       sum(rs.pages_read)::int                       as pages
from public.reading_sessions rs
join public.profiles p on p.id = rs.user_id
group by rs.user_id, (rs.started_at at time zone p.timezone)::date;

-- Books finished per year, for the yearly goal ring.
create or replace view public.finished_per_year with (security_invoker = true) as
select user_id,
       extract(year from finished_at)::int as year,
       count(*)::int                       as books
from public.user_books
where status = 'finished' and finished_at is not null
group by user_id, extract(year from finished_at);

-- Current streak in days. Today not read yet? The streak still counts through yesterday.
create or replace function public.current_streak(p_user uuid default auth.uid())
returns int language sql stable security invoker set search_path = public as $$
  with tz as (
    select coalesce((select timezone from public.profiles where id = p_user), 'UTC') as z
  ),
  today as (select (now() at time zone (select z from tz))::date as d),
  days as (select distinct day from public.reading_days where user_id = p_user),
  anchor as (
    select case when exists (select 1 from days where day = (select d from today))
                then (select d from today)
                else (select d from today) - 1 end as a
  ),
  numbered as (
    select day, row_number() over (order by day desc) as rn
    from days
    where day <= (select a from anchor)
  )
  select count(*)::int
  from numbered
  where day = (select a from anchor) - (rn - 1)::int;
$$;

-- Longest streak ever (gaps-and-islands).
create or replace function public.longest_streak(p_user uuid default auth.uid())
returns int language sql stable security invoker set search_path = public as $$
  with d as (select distinct day from public.reading_days where user_id = p_user),
  g as (select day, day - (row_number() over (order by day))::int as grp from d)
  select coalesce(max(c), 0)::int
  from (select count(*) as c from g group by grp) t;
$$;

grant execute on function public.current_streak(uuid) to authenticated;
grant execute on function public.longest_streak(uuid)  to authenticated;
