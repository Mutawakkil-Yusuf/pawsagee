-- Only needed if you already ran the first schema.sql. New installs get this from schema.sql.
alter table public.books add column if not exists cover_url text;
drop policy if exists "books update creator" on public.books;
create policy "books update creator" on public.books
  for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
