-- Roomly database schema
-- Run in Supabase: SQL Editor → paste → Run. Safe to run multiple times.

-- Profiles -----------------------------------------------------------------
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

-- Dealbreaker filters (hard "no" preferences)
alter table public.profiles
  add column if not exists db_nonsmokers_only     boolean default false,
  add column if not exists db_no_pet_owners       boolean default false,
  add column if not exists db_budget_overlap_only boolean default false;

alter table public.profiles enable row level security;

drop policy if exists "Authenticated users can view profiles" on public.profiles;
create policy "Authenticated users can view profiles"
  on public.profiles for select using (auth.role() = 'authenticated');

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create a blank profile when someone signs up
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

-- Likes / matches ----------------------------------------------------------
-- A "match" = two rows: A liked B and B liked A.
create table if not exists public.likes (
  liker_id   uuid not null references auth.users on delete cascade,
  liked_id   uuid not null references auth.users on delete cascade,
  created_at timestamptz default now(),
  primary key (liker_id, liked_id)
);

alter table public.likes enable row level security;

drop policy if exists "See own likes" on public.likes;
create policy "See own likes" on public.likes
  for select using (auth.uid() = liker_id or auth.uid() = liked_id);

drop policy if exists "Like as yourself" on public.likes;
create policy "Like as yourself" on public.likes
  for insert with check (auth.uid() = liker_id);

drop policy if exists "Remove own likes" on public.likes;
create policy "Remove own likes" on public.likes
  for delete using (auth.uid() = liker_id);

-- Messages -----------------------------------------------------------------
-- You can only message someone you have mutually matched with.
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  sender_id uuid not null references auth.users on delete cascade,
  recipient_id uuid not null references auth.users on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

alter table public.messages enable row level security;

drop policy if exists "See your own messages" on public.messages;
create policy "See your own messages" on public.messages
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "Message your matches" on public.messages;
create policy "Message your matches" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and exists (select 1 from public.likes where liker_id = auth.uid() and liked_id = recipient_id)
    and exists (select 1 from public.likes where liker_id = recipient_id and liked_id = auth.uid())
  );
