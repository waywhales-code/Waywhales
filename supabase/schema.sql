-- Waywhales cloud sync schema
-- Run this file once in Supabase Dashboard > SQL Editor > New query.
-- Uses Supabase Auth user IDs and row-level security. Never expose service_role keys.

create table if not exists public.waywhales_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.waywhales_data enable row level security;

drop policy if exists "Users can read their own Waywhales data" on public.waywhales_data;
create policy "Users can read their own Waywhales data"
  on public.waywhales_data for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own Waywhales data" on public.waywhales_data;
create policy "Users can insert their own Waywhales data"
  on public.waywhales_data for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own Waywhales data" on public.waywhales_data;
create policy "Users can update their own Waywhales data"
  on public.waywhales_data for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on public.waywhales_data to authenticated;
