-- Schema for DTC map assignment
create extension if not exists "pgcrypto";

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name_th text not null,
  type text not null,
  address text default '',
  lat numeric(10, 7) not null,
  lng numeric(10, 7) not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_locations_name_th on public.locations using btree (name_th);
create index if not exists idx_locations_type on public.locations using btree (type);

alter table public.locations enable row level security;

drop policy if exists "public can read locations" on public.locations;
create policy "public can read locations"
on public.locations
for select
to anon, authenticated
using (true);

drop policy if exists "public can insert locations" on public.locations;
create policy "public can insert locations"
on public.locations
for insert
to anon, authenticated
with check (true);

drop policy if exists "public can delete locations" on public.locations;
create policy "public can delete locations"
on public.locations
for delete
to anon, authenticated
using (true);
