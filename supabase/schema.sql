-- Roomly database schema
-- Run in Supabase: SQL Editor -> paste -> Run. Safe to run multiple times.

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

-- Profile photo gallery (ordered list of public image URLs; photos[1] is the main one).
-- avatar_url is kept in sync with the first photo for quick thumbnails.
alter table public.profiles
  add column if not exists photos text[] default '{}';

-- Identity verification (email + phone + gov-ID/selfie). Source of truth for gating.
alter table public.profiles
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified')),
  add column if not exists id_verified boolean default false,
  add column if not exists verified_at timestamptz;

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

-- Verification columns: writable only by SQL editor/service role or the RPC.
create or replace function public.protect_verification_columns()
returns trigger language plpgsql security definer as $$
begin
  if auth.uid() is not null
     and coalesce(current_setting('roomly.allow_verification_write', true), '') <> 'on'
     and (new.verification_status is distinct from old.verification_status
          or new.id_verified is distinct from old.id_verified
          or new.verified_at is distinct from old.verified_at
          or new.email_verified is distinct from old.email_verified
          or new.phone_verified is distinct from old.phone_verified) then
    raise exception 'verification fields can only be set by Roomly';
  end if;
  return new;
end; $$;

drop trigger if exists protect_verification_columns on public.profiles;
create trigger protect_verification_columns
  before update on public.profiles
  for each row execute procedure public.protect_verification_columns();

-- DEMO SEMANTICS: completing the /verify steps grants verified. Path B swaps
-- the id_verified line for a verification-vendor webhook check. This function
-- is the single place to harden.
create or replace function public.complete_verification()
returns void language plpgsql security definer set search_path = public as $$
declare
  u record;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select email_confirmed_at, phone_confirmed_at into u
    from auth.users where id = auth.uid();
  if u.email_confirmed_at is null then
    raise exception 'confirm your email first';
  end if;
  perform set_config('roomly.allow_verification_write', 'on', true);
  update public.profiles set
    email_verified = true,
    phone_verified = (u.phone_confirmed_at is not null),
    id_verified = true,
    verification_status = 'verified',
    verified_at = now()
  where id = auth.uid();
end; $$;

grant execute on function public.complete_verification() to authenticated;

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

-- Matches: one row per pair (ordered), written by trigger on reciprocal like.
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users on delete cascade,
  user_b uuid not null references auth.users on delete cascade,
  created_at timestamptz default now(),
  status text not null default 'active' check (status in ('active', 'unmatched')),
  last_message_at timestamptz,
  unique (user_a, user_b),
  check (user_a < user_b)
);

alter table public.matches enable row level security;

drop policy if exists "See own matches" on public.matches;
create policy "See own matches" on public.matches
  for select using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "Update own matches" on public.matches;
create policy "Unmatch own matches" on public.matches
  for update using (auth.uid() = user_a or auth.uid() = user_b)
  with check ((auth.uid() = user_a or auth.uid() = user_b) and status = 'unmatched');

create or replace function public.handle_new_like()
returns trigger language plpgsql security definer as $$
begin
  if exists (select 1 from public.likes
             where liker_id = new.liked_id and liked_id = new.liker_id) then
    insert into public.matches (user_a, user_b)
    values (least(new.liker_id, new.liked_id), greatest(new.liker_id, new.liked_id))
    on conflict (user_a, user_b) do update set status = 'active';
  end if;
  return new;
end; $$;

drop trigger if exists on_like_created on public.likes;
create trigger on_like_created
  after insert on public.likes
  for each row execute procedure public.handle_new_like();

create or replace function public.unmatch_user(other_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  update public.matches set status = 'unmatched'
    where user_a = least(auth.uid(), other_id)
      and user_b = greatest(auth.uid(), other_id);
  delete from public.likes
    where (liker_id = auth.uid() and liked_id = other_id)
       or (liker_id = other_id and liked_id = auth.uid());
end; $$;

grant execute on function public.unmatch_user(uuid) to authenticated;

create or replace function public.touch_match_on_message()
returns trigger language plpgsql security definer as $$
begin
  update public.matches
     set last_message_at = new.created_at
   where user_a = least(new.sender_id, new.recipient_id)
     and user_b = greatest(new.sender_id, new.recipient_id);
  return new;
end; $$;

drop trigger if exists on_message_sent on public.messages;
create trigger on_message_sent
  after insert on public.messages
  for each row execute procedure public.touch_match_on_message();

-- Blocks (one-directional storage, enforced both ways for messaging).
create table if not exists public.blocks (
  blocker_id uuid not null references auth.users on delete cascade,
  blocked_id uuid not null references auth.users on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.blocks enable row level security;

drop policy if exists "See own blocks" on public.blocks;
create policy "See own blocks" on public.blocks
  for select using (auth.uid() = blocker_id);
drop policy if exists "Block as yourself" on public.blocks;
create policy "Block as yourself" on public.blocks
  for insert with check (auth.uid() = blocker_id);
drop policy if exists "Unblock own" on public.blocks;
create policy "Unblock own" on public.blocks
  for delete using (auth.uid() = blocker_id);

-- Helpers (security definer so policy checks can see both sides' rows) ------
create or replace function public.has_active_match(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.matches m
    where m.status = 'active'
      and m.user_a = least(a, b)
      and m.user_b = greatest(a, b)
  );
$$;

create or replace function public.is_blocked_pair(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b)
       or (blocker_id = b and blocked_id = a)
  );
$$;

grant execute on function public.has_active_match(uuid, uuid) to authenticated;
grant execute on function public.is_blocked_pair(uuid, uuid) to authenticated;

-- Message policy referencing matches + blocks (placed here so both tables exist).
drop policy if exists "Message your matches" on public.messages;
drop policy if exists "Message your active matches" on public.messages;
create policy "Message your active matches" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and (select verification_status from public.profiles where id = auth.uid()) = 'verified'
    and (select verification_status from public.profiles where id = recipient_id) = 'verified'
    and public.has_active_match(auth.uid(), recipient_id)
    and not public.is_blocked_pair(auth.uid(), recipient_id)
  );

-- Like policy using helpers (moved here so helpers exist first).
drop policy if exists "Like as yourself" on public.likes;
create policy "Like as yourself" on public.likes
  for insert with check (
    auth.uid() = liker_id
    and (select verification_status from public.profiles where id = auth.uid()) = 'verified'
    and not public.is_blocked_pair(auth.uid(), liked_id)
  );

-- Reports (feed the /safety page; no client select needed).
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users on delete cascade,
  reported_id uuid not null references auth.users on delete cascade,
  reason text,
  details text,
  created_at timestamptz default now()
);
alter table public.reports enable row level security;

drop policy if exists "Report as yourself" on public.reports;
create policy "Report as yourself" on public.reports
  for insert with check (auth.uid() = reporter_id);

-- Backfill matches for pairs that already liked each other before the trigger existed.
insert into public.matches (user_a, user_b)
select least(l1.liker_id, l1.liked_id), greatest(l1.liker_id, l1.liked_id)
from public.likes l1
join public.likes l2 on l2.liker_id = l1.liked_id and l2.liked_id = l1.liker_id
on conflict (user_a, user_b) do nothing;

-- Apartment listings -------------------------------------------------------
-- In-app listings posted by owners/landlords (verified by Roomly, not scraped
-- from third parties). owner-posted listings start unverified.
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users on delete cascade,
  created_at timestamptz default now(),
  title text not null,
  description text,
  city text,
  neighborhood text,
  rent int,
  bedrooms int,
  bathrooms int,
  available_from date,
  photos text[] default '{}',
  verified boolean default false
);

alter table public.listings enable row level security;

drop policy if exists "Authenticated users can view listings" on public.listings;
create policy "Authenticated users can view listings"
  on public.listings for select using (auth.role() = 'authenticated');

drop policy if exists "Owners can post listings" on public.listings;
create policy "Owners can post listings"
  on public.listings for insert with check (auth.uid() = owner_id);

drop policy if exists "Owners can edit their listings" on public.listings;
create policy "Owners can edit their listings"
  on public.listings for update using (auth.uid() = owner_id);

drop policy if exists "Owners can delete their listings" on public.listings;
create policy "Owners can delete their listings"
  on public.listings for delete using (auth.uid() = owner_id);

-- Saved / bookmarked listings
create table if not exists public.saved_listings (
  user_id    uuid not null references auth.users on delete cascade,
  listing_id uuid not null references public.listings on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, listing_id)
);

alter table public.saved_listings enable row level security;

drop policy if exists "See own saved listings" on public.saved_listings;
create policy "See own saved listings" on public.saved_listings
  for select using (auth.uid() = user_id);

drop policy if exists "Save listings as yourself" on public.saved_listings;
create policy "Save listings as yourself" on public.saved_listings
  for insert with check (auth.uid() = user_id);

drop policy if exists "Unsave own listings" on public.saved_listings;
create policy "Unsave own listings" on public.saved_listings
  for delete using (auth.uid() = user_id);

-- Collaborative search: each person reacts to listings; a "shared shortlist"
-- is where BOTH matched roommates liked the same place.
create table if not exists public.listing_reactions (
  user_id    uuid not null references auth.users on delete cascade,
  listing_id uuid not null references public.listings on delete cascade,
  reaction   text not null check (reaction in ('like', 'pass')),
  created_at timestamptz default now(),
  primary key (user_id, listing_id)
);

alter table public.listing_reactions enable row level security;

-- You can see your own reactions, and the reactions of anyone you have a
-- mutual match with (so the two of you can compare shortlists).
drop policy if exists "See own and matched reactions" on public.listing_reactions;
create policy "See own and matched reactions" on public.listing_reactions
  for select using (
    auth.uid() = user_id
    or (public.has_active_match(auth.uid(), user_id)
        and not public.is_blocked_pair(auth.uid(), user_id))
  );

drop policy if exists "React as yourself" on public.listing_reactions;
create policy "React as yourself" on public.listing_reactions
  for insert with check (auth.uid() = user_id);

drop policy if exists "Update own reactions" on public.listing_reactions;
create policy "Update own reactions" on public.listing_reactions
  for update using (auth.uid() = user_id);

drop policy if exists "Delete own reactions" on public.listing_reactions;
create policy "Delete own reactions" on public.listing_reactions
  for delete using (auth.uid() = user_id);

-- Demo listings (idempotent: each only inserts once, by title) --------------
insert into public.listings (owner_id, title, description, city, neighborhood, rent, bedrooms, bathrooms, available_from, photos, verified)
select u.id, 'Sunny 2BR near campus',
  'Bright corner unit with big windows, dishwasher, and a small balcony. Walkable to campus, coffee, and the green belt.',
  'Austin, TX', 'Hyde Park', 1450, 2, 1, date '2026-08-01',
  array['https://picsum.photos/seed/roomly-listing-1a/800/1000','https://picsum.photos/seed/roomly-listing-1b/800/1000','https://picsum.photos/seed/roomly-listing-1c/800/1000'], true
from auth.users u
where u.email = 'sample.maya@roomly.test'
  and not exists (select 1 from public.listings where title = 'Sunny 2BR near campus');

insert into public.listings (owner_id, title, description, city, neighborhood, rent, bedrooms, bathrooms, available_from, photos, verified)
select u.id, 'Modern loft downtown',
  'Open-plan loft with exposed brick, in-unit laundry, and a rooftop pool. Steps from restaurants and transit.',
  'Austin, TX', 'Downtown', 1900, 1, 1, date '2026-07-15',
  array['https://picsum.photos/seed/roomly-listing-2a/800/1000','https://picsum.photos/seed/roomly-listing-2b/800/1000'], true
from auth.users u
where u.email = 'sample.diego@roomly.test'
  and not exists (select 1 from public.listings where title = 'Modern loft downtown');

insert into public.listings (owner_id, title, description, city, neighborhood, rent, bedrooms, bathrooms, available_from, photos, verified)
select u.id, 'Cozy room in shared house',
  'Furnished private room in a friendly 3-person house. Big backyard, fast wifi, and a cat named Biscuit.',
  'Austin, TX', 'East Side', 850, 1, 1, date '2026-09-01',
  array['https://picsum.photos/seed/roomly-listing-3a/800/1000','https://picsum.photos/seed/roomly-listing-3b/800/1000'], false
from auth.users u
where u.email = 'sample.riley@roomly.test'
  and not exists (select 1 from public.listings where title = 'Cozy room in shared house');
