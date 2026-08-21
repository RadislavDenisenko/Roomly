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

-- Housing search preferences (the "Zillow step" between quiz and deck).
alter table public.profiles
  add column if not exists pref_areas text[] default '{}',
  add column if not exists pref_tags text[] default '{}';

-- Lifestyle axes for "the awkward questions" (fridge rules, dishes, chores,
-- overnight guests, noise, weekends). All optional; scored in src/lib/compat.ts.
alter table public.profiles
  add column if not exists weekend_style text
    check (weekend_style in ('out', 'host', 'home', 'depends')),
  add column if not exists home_noise text
    check (home_noise in ('speakers', 'headphones', 'quiet')),
  add column if not exists food_sharing text
    check (food_sharing in ('share', 'ask', 'separate')),
  add column if not exists dishes text
    check (dishes in ('now', 'same_day', 'soaking', 'eventually')),
  add column if not exists chores text
    check (chores in ('rota', 'whoever', 'cleaner', 'eventually')),
  add column if not exists overnight_guests text
    check (overnight_guests in ('never', 'weekends', 'often', 'partner'));

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

-- People passes (so passed profiles stop reappearing) -----------------------
create table if not exists public.passes (
  passer_id  uuid not null references auth.users on delete cascade,
  passed_id  uuid not null references auth.users on delete cascade,
  created_at timestamptz default now(),
  primary key (passer_id, passed_id)
);
alter table public.passes enable row level security;

drop policy if exists "See own passes" on public.passes;
create policy "See own passes" on public.passes
  for select using (auth.uid() = passer_id);
drop policy if exists "Pass as yourself" on public.passes;
create policy "Pass as yourself" on public.passes
  for insert with check (auth.uid() = passer_id);
drop policy if exists "Remove own passes" on public.passes;
create policy "Remove own passes" on public.passes
  for delete using (auth.uid() = passer_id);

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

-- Places (complex/building level; the unit people match around) -------------
create table if not exists public.places (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  created_by uuid references auth.users on delete set null,
  name text not null,
  kind text not null default 'complex' check (kind in ('complex','building','house','other')),
  city text,
  neighborhood text,
  address text,
  rent_min int,
  rent_max int,
  photos text[] default '{}',
  website text,
  curated boolean default false,
  sponsored boolean default false -- dormant monetization flag, unused in UI
);
-- Amenity tags ("what's nearby"), matched against profiles.pref_tags.
alter table public.places
  add column if not exists tags text[] default '{}';
alter table public.places enable row level security;

drop policy if exists "Authenticated users can view places" on public.places;
create policy "Authenticated users can view places"
  on public.places for select using (auth.role() = 'authenticated');
drop policy if exists "Users can add places" on public.places;
create policy "Users can add places"
  on public.places for insert with check (
    auth.uid() = created_by and curated = false and sponsored = false
  );
drop policy if exists "Creators can edit their places" on public.places;
create policy "Creators can edit their places"
  on public.places for update using (created_by = auth.uid() and curated = false)
  with check (curated = false and sponsored = false);

alter table public.listings
  add column if not exists place_id uuid references public.places;

alter table public.profiles
  add column if not exists place_id uuid references public.places,
  add column if not exists looking_for_roommate boolean default false,
  add column if not exists people_visible boolean default true;

-- Place reactions: own rows ONLY. Cross-user pools go through RPCs (Task 10).
create table if not exists public.place_reactions (
  user_id    uuid not null references auth.users on delete cascade,
  place_id   uuid not null references public.places on delete cascade,
  reaction   text not null check (reaction in ('like','pass')),
  created_at timestamptz default now(),
  primary key (user_id, place_id)
);
alter table public.place_reactions enable row level security;

drop policy if exists "Own place reactions" on public.place_reactions;
create policy "Own place reactions" on public.place_reactions
  for select using (auth.uid() = user_id);
drop policy if exists "React to places as yourself" on public.place_reactions;
create policy "React to places as yourself" on public.place_reactions
  for insert with check (auth.uid() = user_id);
drop policy if exists "Update own place reactions" on public.place_reactions;
create policy "Update own place reactions" on public.place_reactions
  for update using (auth.uid() = user_id);
drop policy if exists "Delete own place reactions" on public.place_reactions;
create policy "Delete own place reactions" on public.place_reactions
  for delete using (auth.uid() = user_id);

-- Backfill: every orphan listing gets its own auto place (idempotent).
insert into public.places (name, kind, city, neighborhood, curated, created_by)
select l.title, 'other', l.city, l.neighborhood, false, l.owner_id
from public.listings l
where l.place_id is null
  and not exists (select 1 from public.places p where p.name = l.title);

update public.listings l set place_id = p.id
from public.places p
where l.place_id is null and p.name = l.title;

-- People pools: the ONLY cross-user window into place_reactions. -----------
drop function if exists public.people_for_place(uuid); -- return type changed; replace can't
create function public.people_for_place(pid uuid)
returns table (
  id uuid, full_name text, age int, city text, bio text, avatar_url text,
  photos text[], budget_min int, budget_max int, cleanliness int,
  sleep_schedule text, smoking boolean, pets boolean, guests text,
  weekend_style text, home_noise text, food_sharing text, dishes text,
  chores text, overnight_guests text,
  verification_status text, member_group text
) language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if (select p.verification_status from public.profiles p where p.id = auth.uid()) <> 'verified' then
    return;
  end if;
  -- eligible = caller liked this place, or lives there
  if not exists (select 1 from public.place_reactions r
                 where r.user_id = auth.uid() and r.place_id = pid and r.reaction = 'like')
     and not exists (select 1 from public.profiles p
                     where p.id = auth.uid() and p.place_id = pid) then
    return;
  end if;
  return query
  select p.id, p.full_name, p.age, p.city, p.bio, p.avatar_url, p.photos,
         p.budget_min, p.budget_max, p.cleanliness, p.sleep_schedule,
         p.smoking, p.pets, p.guests,
         p.weekend_style, p.home_noise, p.food_sharing, p.dishes,
         p.chores, p.overnight_guests,
         p.verification_status,
         case when p.place_id = pid and p.looking_for_roommate
              then 'resident' else 'seeker' end as member_group
  from public.profiles p
  where p.id <> auth.uid()
    and p.verification_status = 'verified'
    and not public.is_blocked_pair(auth.uid(), p.id)
    and not exists (select 1 from public.likes l
                    where l.liker_id = auth.uid() and l.liked_id = p.id)
    and not exists (select 1 from public.passes x
                    where x.passer_id = auth.uid() and x.passed_id = p.id)
    and (
      (p.people_visible and exists (select 1 from public.place_reactions r
                                    where r.user_id = p.id and r.place_id = pid
                                      and r.reaction = 'like'))
      or (p.place_id = pid and p.looking_for_roommate)
    );
end; $$;

grant execute on function public.people_for_place(uuid) to authenticated;

drop function if exists public.people_for_area(text, text); -- return type changed; replace can't
create function public.people_for_area(p_city text, p_neighborhood text)
returns table (
  id uuid, full_name text, age int, city text, bio text, avatar_url text,
  photos text[], budget_min int, budget_max int, cleanliness int,
  sleep_schedule text, smoking boolean, pets boolean, guests text,
  weekend_style text, home_noise text, food_sharing text, dishes text,
  chores text, overnight_guests text,
  verification_status text, member_group text
) language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if (select p.verification_status from public.profiles p where p.id = auth.uid()) <> 'verified' then
    return;
  end if;
  -- eligible = caller has a like on ANY place in this city (+ neighborhood if given)
  if not exists (
    select 1 from public.place_reactions r
    join public.places pl on pl.id = r.place_id
    where r.user_id = auth.uid() and r.reaction = 'like'
      and pl.city = p_city
      and (p_neighborhood is null or pl.neighborhood = p_neighborhood)
  ) then
    return;
  end if;
  return query
  select p.id, p.full_name, p.age, p.city, p.bio, p.avatar_url, p.photos,
         p.budget_min, p.budget_max, p.cleanliness, p.sleep_schedule,
         p.smoking, p.pets, p.guests,
         p.weekend_style, p.home_noise, p.food_sharing, p.dishes,
         p.chores, p.overnight_guests,
         p.verification_status,
         'seeker' as member_group
  from public.profiles p
  where p.id <> auth.uid()
    and p.verification_status = 'verified'
    and p.people_visible
    and not public.is_blocked_pair(auth.uid(), p.id)
    and not exists (select 1 from public.likes l
                    where l.liker_id = auth.uid() and l.liked_id = p.id)
    and not exists (select 1 from public.passes x
                    where x.passer_id = auth.uid() and x.passed_id = p.id)
    and exists (
      select 1 from public.place_reactions r
      join public.places pl on pl.id = r.place_id
      where r.user_id = p.id and r.reaction = 'like'
        and pl.city = p_city
        and (p_neighborhood is null or pl.neighborhood = p_neighborhood)
    );
end; $$;

grant execute on function public.people_for_area(text, text) to authenticated;

-- Per-visitor demo sessions -------------------------------------------------
-- The /demo quiz signs up a throwaway demo-<random>@roomly.test account, then
-- calls this to turn it into a fully seeded demo: verified (so pools open),
-- hidden from real users' pools, with place likes, two instant matches, and a
-- first message. Also GCs throwaway demo accounts older than a day (FK
-- cascades clean up all their rows).
create or replace function public.start_demo()
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  my_email text;
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  select email into my_email from auth.users where id = me;
  if my_email not like 'demo-%@roomly.test' then
    raise exception 'demo sessions only';
  end if;

  -- opportunistic GC of yesterday's throwaway demo accounts
  delete from auth.users
  where email like 'demo-%@roomly.test'
    and created_at < now() - interval '1 day'
    and id <> me;

  -- verified so the People pools open; invisible so real users never see
  -- (or match with) a throwaway demo visitor
  perform set_config('roomly.allow_verification_write', 'on', true);
  update public.profiles set
    full_name = coalesce(full_name, 'Demo Explorer'),
    city = coalesce(city, 'Austin, TX'),
    bio = coalesce(bio, 'Just exploring Roomly — throwaway demo profile.'),
    email_verified = true, phone_verified = true, id_verified = true,
    verification_status = 'verified', verified_at = now(),
    people_visible = false
  where id = me;

  -- like the two places with the busiest seeded pools
  insert into public.place_reactions (user_id, place_id, reaction)
  select me, p.id, 'like' from public.places p
  where p.name in ('The Triangle', 'Hyde Park Commons')
  on conflict do nothing;

  -- reciprocal likes with two seed users -> the trigger creates matches
  insert into public.likes (liker_id, liked_id)
  select me, u.id from auth.users u
  where u.email in ('seed.alex@roomly.demo', 'seed.zoe@roomly.demo')
  on conflict do nothing;
  insert into public.likes (liker_id, liked_id)
  select u.id, me from auth.users u
  where u.email in ('seed.alex@roomly.demo', 'seed.zoe@roomly.demo')
  on conflict do nothing;

  -- a first message so Matches opens with a real conversation
  insert into public.messages (sender_id, recipient_id, body)
  select u.id, me,
         'Hey! Saw we matched and we both liked The Triangle. When are you hoping to move in?'
  from auth.users u
  where u.email = 'seed.alex@roomly.demo'
    and not exists (select 1 from public.messages m
                    where m.sender_id = u.id and m.recipient_id = me);
end; $$;

grant execute on function public.start_demo() to authenticated;
