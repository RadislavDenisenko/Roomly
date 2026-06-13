-- Roomly database schema
-- Run this in your Supabase project: SQL Editor → paste → Run.
-- Safe to run multiple times (it drops + recreates policies cleanly).

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  created_at timestamptz default now(),

  -- basics
  full_name text,
  age int,
  bio text,
  avatar_url text,

  -- what they're looking for
  city text,
  budget_min int,
  budget_max int,
  move_in_date date,

  -- lifestyle (used for compatibility matching)
  cleanliness int,          -- 1 (relaxed) to 5 (very tidy)
  sleep_schedule text,      -- 'early_bird' | 'night_owl' | 'flexible'
  smoking boolean,
  pets boolean,
  guests text,              -- 'rarely' | 'sometimes' | 'often'

  -- trust signals
  email_verified boolean default false,
  phone_verified boolean default false
);

alter table public.profiles enable row level security;

-- Anyone logged in can browse profiles (needed for matching).
drop policy if exists "Authenticated users can view profiles" on public.profiles;
create policy "Authenticated users can view profiles"
  on public.profiles for select
  using (auth.role() = 'authenticated');

-- You can only create/edit your own profile.
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Automatically create a blank profile row when someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
