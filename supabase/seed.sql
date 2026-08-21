-- Roomly demo seed (Austin, TX). Run in the Supabase SQL editor AFTER schema.sql.
-- Idempotent: safe to re-run. Also serves as the demo-state reset.

create extension if not exists pgcrypto;

-- 1) Mark existing sample.* accounts verified so they pass the gate + can demo-login.
update public.profiles p
set verification_status = 'verified', email_verified = true,
    phone_verified = true, id_verified = true, verified_at = now()
from auth.users u
where p.id = u.id and u.email like 'sample.%@roomly.test';

-- 2) Create ~12 profile-only demo users (never log in; exist so they appear in People pools).
--    The on_auth_user_created trigger auto-creates a blank profiles row for each.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated',
       'authenticated', d.email, crypt('seed-no-login', gen_salt('bf')), now(),
       now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
       '', '', '', ''
from (values
  ('seed.alex@roomly.demo'),  ('seed.mia@roomly.demo'),   ('seed.noah@roomly.demo'),
  ('seed.ava@roomly.demo'),   ('seed.liam@roomly.demo'),  ('seed.sofia@roomly.demo'),
  ('seed.ethan@roomly.demo'), ('seed.zoe@roomly.demo'),   ('seed.lucas@roomly.demo'),
  ('seed.emma@roomly.demo'),  ('seed.caleb@roomly.demo'), ('seed.harper@roomly.demo')
) as d(email)
where not exists (select 1 from auth.users u where u.email = d.email);

-- 3) Fill those profiles with believable data (all Austin, all verified).
update public.profiles p set
  full_name = d.full_name, age = d.age, city = 'Austin, TX', bio = d.bio,
  budget_min = d.bmin, budget_max = d.bmax, cleanliness = d.clean,
  sleep_schedule = d.sleep, smoking = d.smoke, pets = d.pets, guests = d.guests,
  avatar_url = d.photo, photos = array[d.photo],
  verification_status = 'verified', email_verified = true,
  phone_verified = true, id_verified = true, verified_at = now()
from (values
  ('seed.alex@roomly.demo','Alex Rivera',24,'CS grad student. Quiet weeknights, big on a clean kitchen.',800,1300,4,'night_owl',false,false,'sometimes','https://randomuser.me/api/portraits/men/32.jpg'),
  ('seed.mia@roomly.demo','Mia Thompson',26,'Nurse on rotating shifts. Tidy, friendly, plant collector.',900,1500,5,'flexible',false,true,'rarely','https://randomuser.me/api/portraits/women/44.jpg'),
  ('seed.noah@roomly.demo','Noah Kim',23,'Junior dev. Morning gym, cook most nights.',700,1200,3,'early_bird',false,false,'sometimes','https://randomuser.me/api/portraits/men/45.jpg'),
  ('seed.ava@roomly.demo','Ava Martinez',25,'Remote designer, coffee snob, very chill.',1000,1600,4,'flexible',false,true,'sometimes','https://randomuser.me/api/portraits/women/68.jpg'),
  ('seed.liam@roomly.demo','Liam O''Brien',28,'Teacher + musician. Practice with headphones, promise.',650,1100,3,'night_owl',false,false,'often','https://randomuser.me/api/portraits/men/12.jpg'),
  ('seed.sofia@roomly.demo','Sofia Reyes',22,'Psych senior. Early riser, neat, no-drama roommate wanted.',600,1000,5,'early_bird',false,false,'rarely','https://randomuser.me/api/portraits/women/21.jpg'),
  ('seed.ethan@roomly.demo','Ethan Walker',27,'Bartender, out late, respectful of quiet hours.',800,1400,3,'night_owl',true,false,'often','https://randomuser.me/api/portraits/men/76.jpg'),
  ('seed.zoe@roomly.demo','Zoe Patel',24,'Vet tech, dog mom to a senior beagle. Pet-friendly please!',900,1400,4,'flexible',false,true,'sometimes','https://randomuser.me/api/portraits/women/9.jpg'),
  ('seed.lucas@roomly.demo','Lucas Brooks',29,'Civil engineer, 9-5, weekend hiker. Easygoing and clean.',1000,1700,4,'early_bird',false,false,'rarely','https://randomuser.me/api/portraits/men/3.jpg'),
  ('seed.emma@roomly.demo','Emma Nguyen',23,'Barista + art student. Messy desk, clean shared spaces.',700,1150,3,'night_owl',false,false,'sometimes','https://randomuser.me/api/portraits/women/52.jpg'),
  ('seed.caleb@roomly.demo','Caleb Foster',26,'In sales, travel half the month. Low maintenance.',900,1500,3,'flexible',false,false,'rarely','https://randomuser.me/api/portraits/men/53.jpg'),
  ('seed.harper@roomly.demo','Harper Lee',25,'Grad student, runner, vegetarian. Quiet, tidy, friendly.',800,1300,5,'early_bird',false,true,'sometimes','https://randomuser.me/api/portraits/women/65.jpg')
) as d(email, full_name, age, bio, bmin, bmax, clean, sleep, smoke, pets, guests, photo)
join auth.users u on u.email = d.email
where p.id = u.id;

-- 3b) "Awkward question" lifestyle answers for every seeded person, matched to
--     their bios. Keyed by full_name so it works without touching auth.users.
update public.profiles p set
  weekend_style = d.weekend, home_noise = d.noise, food_sharing = d.food,
  dishes = d.dishes, chores = d.chores, overnight_guests = d.overnight
from (values
  ('Alex Rivera',   'home',    'headphones', 'ask',      'now',        'rota',       'weekends'),
  ('Mia Thompson',  'depends', 'quiet',      'share',    'same_day',   'rota',       'weekends'),
  ('Noah Kim',      'host',    'headphones', 'ask',      'same_day',   'whoever',    'weekends'),
  ('Ava Martinez',  'host',    'speakers',   'share',    'same_day',   'whoever',    'often'),
  ('Liam O''Brien', 'host',    'speakers',   'ask',      'soaking',    'whoever',    'often'),
  ('Sofia Reyes',   'home',    'quiet',      'separate', 'now',        'rota',       'never'),
  ('Ethan Walker',  'out',     'speakers',   'ask',      'eventually', 'eventually', 'often'),
  ('Zoe Patel',     'depends', 'headphones', 'share',    'same_day',   'whoever',    'weekends'),
  ('Lucas Brooks',  'home',    'headphones', 'ask',      'now',        'rota',       'never'),
  ('Emma Nguyen',   'out',     'speakers',   'ask',      'soaking',    'whoever',    'weekends'),
  ('Caleb Foster',  'depends', 'headphones', 'separate', 'same_day',   'cleaner',    'never'),
  ('Harper Lee',    'home',    'quiet',      'separate', 'now',        'rota',       'weekends'),
  ('Maya Chen',     'host',    'headphones', 'ask',      'same_day',   'whoever',    'weekends'),
  ('Jordan Pierce', 'home',    'headphones', 'ask',      'now',        'rota',       'weekends'),
  ('Sam Rivera',    'home',    'quiet',      'separate', 'same_day',   'rota',       'never'),
  ('Priya Nair',    'depends', 'headphones', 'ask',      'same_day',   'whoever',    'weekends'),
  ('Diego Alvarez', 'host',    'speakers',   'share',    'soaking',    'whoever',    'often'),
  ('Riley Brooks',  'depends', 'headphones', 'ask',      'same_day',   'rota',       'weekends')
) as d(full_name, weekend, noise, food, dishes, chores, overnight)
where p.full_name = d.full_name;

-- 4) Give the demo account (sample.maya) matches with 3 seed users
--    (reciprocal likes -> on_like_created trigger creates the match rows).
insert into public.likes (liker_id, liked_id)
select m.id, s.id from auth.users m
  join auth.users s on s.email in ('seed.alex@roomly.demo','seed.zoe@roomly.demo','seed.ava@roomly.demo')
where m.email = 'sample.maya@roomly.test'
on conflict do nothing;

insert into public.likes (liker_id, liked_id)
select s.id, m.id from auth.users m
  join auth.users s on s.email in ('seed.alex@roomly.demo','seed.zoe@roomly.demo','seed.ava@roomly.demo')
where m.email = 'sample.maya@roomly.test'
on conflict do nothing;

-- 5) One clean sample message (seed.alex -> maya), only if not already present.
insert into public.messages (sender_id, recipient_id, body)
select s.id, m.id, 'Hey! Saw we matched and your place sounds great. When are you hoping to move in?'
from auth.users m join auth.users s on s.email = 'seed.alex@roomly.demo'
where m.email = 'sample.maya@roomly.test'
  and not exists (select 1 from public.messages x where x.sender_id = s.id and x.recipient_id = m.id);

-- 6) Curated Austin places directory (idempotent by name).
insert into public.places (name, kind, city, neighborhood, rent_min, rent_max, curated, photos)
select 'The Triangle', 'complex', 'Austin, TX', 'Triangle State', 1300, 2200, true,
  array['https://picsum.photos/seed/roomly-place-triangle-a/800/1000','https://picsum.photos/seed/roomly-place-triangle-b/800/1000']
where not exists (select 1 from public.places where name = 'The Triangle');

insert into public.places (name, kind, city, neighborhood, rent_min, rent_max, curated, photos)
select 'East 6th Lofts', 'complex', 'Austin, TX', 'East Austin', 1250, 2100, true,
  array['https://picsum.photos/seed/roomly-place-east6th-a/800/1000','https://picsum.photos/seed/roomly-place-east6th-b/800/1000']
where not exists (select 1 from public.places where name = 'East 6th Lofts');

insert into public.places (name, kind, city, neighborhood, rent_min, rent_max, curated, photos)
select 'Zilker Terrace', 'complex', 'Austin, TX', 'Zilker', 1400, 2400, true,
  array['https://picsum.photos/seed/roomly-place-zilker-a/800/1000','https://picsum.photos/seed/roomly-place-zilker-b/800/1000']
where not exists (select 1 from public.places where name = 'Zilker Terrace');

insert into public.places (name, kind, city, neighborhood, rent_min, rent_max, curated, photos)
select 'Hyde Park Commons', 'complex', 'Austin, TX', 'Hyde Park', 1100, 1800, true,
  array['https://picsum.photos/seed/roomly-place-hydepark-a/800/1000','https://picsum.photos/seed/roomly-place-hydepark-b/800/1000']
where not exists (select 1 from public.places where name = 'Hyde Park Commons');

insert into public.places (name, kind, city, neighborhood, rent_min, rent_max, curated, photos)
select 'Riverside Landing', 'complex', 'Austin, TX', 'Riverside', 950, 1600, true,
  array['https://picsum.photos/seed/roomly-place-riverside-a/800/1000','https://picsum.photos/seed/roomly-place-riverside-b/800/1000']
where not exists (select 1 from public.places where name = 'Riverside Landing');

insert into public.places (name, kind, city, neighborhood, rent_min, rent_max, curated, photos)
select 'Domain Northside Flats', 'complex', 'Austin, TX', 'The Domain', 1500, 2600, true,
  array['https://picsum.photos/seed/roomly-place-domain-a/800/1000','https://picsum.photos/seed/roomly-place-domain-b/800/1000']
where not exists (select 1 from public.places where name = 'Domain Northside Flats');

insert into public.places (name, kind, city, neighborhood, rent_min, rent_max, curated, photos)
select 'Aldrich House', 'complex', 'Austin, TX', 'Mueller', 1350, 2300, true,
  array['https://picsum.photos/seed/roomly-place-aldrich-a/800/1000','https://picsum.photos/seed/roomly-place-aldrich-b/800/1000']
where not exists (select 1 from public.places where name = 'Aldrich House');

insert into public.places (name, kind, city, neighborhood, rent_min, rent_max, curated, photos)
select 'South Congress Studios', 'complex', 'Austin, TX', 'South Congress', 1200, 1900, true,
  array['https://picsum.photos/seed/roomly-place-soco-a/800/1000','https://picsum.photos/seed/roomly-place-soco-b/800/1000']
where not exists (select 1 from public.places where name = 'South Congress Studios');

insert into public.places (name, kind, city, neighborhood, rent_min, rent_max, curated, photos)
select 'Barton Creek Villas', 'complex', 'Austin, TX', 'Barton Hills', 1450, 2500, true,
  array['https://picsum.photos/seed/roomly-place-bartoncreek-a/800/1000','https://picsum.photos/seed/roomly-place-bartoncreek-b/800/1000']
where not exists (select 1 from public.places where name = 'Barton Creek Villas');

insert into public.places (name, kind, city, neighborhood, rent_min, rent_max, curated, photos)
select 'Cherrywood Court', 'house', 'Austin, TX', 'Cherrywood', 1000, 1700, true,
  array['https://picsum.photos/seed/roomly-place-cherrywood-a/800/1000','https://picsum.photos/seed/roomly-place-cherrywood-b/800/1000']
where not exists (select 1 from public.places where name = 'Cherrywood Court');

-- 6b) Amenity tags for the curated directory (matched against pref_tags).
update public.places p set tags = d.tags::text[]
from (values
  ('The Triangle',           '{groceries,parks,transit,coffee}'),
  ('East 6th Lofts',         '{nightlife,coffee,transit,gym}'),
  ('Zilker Terrace',         '{parks,dog_park,quiet,coffee}'),
  ('Hyde Park Commons',      '{campus,coffee,quiet,groceries}'),
  ('Riverside Landing',      '{transit,parks,gym}'),
  ('Domain Northside Flats', '{gym,groceries,nightlife,transit}'),
  ('Aldrich House',          '{parks,groceries,dog_park,coffee}'),
  ('South Congress Studios', '{nightlife,coffee,parks}'),
  ('Barton Creek Villas',    '{parks,quiet,gym,dog_park}'),
  ('Cherrywood Court',       '{quiet,coffee,campus,parks}')
) as d(name, tags)
where p.name = d.name;

-- 7) Seed place likes so the apartment-first People pools have real pools.
--    maya shares The Triangle + Hyde Park Commons with several other seeded
--    users; the rest are scattered across the directory.
insert into public.place_reactions (user_id, place_id, reaction)
select u.id, p.id, 'like'
from auth.users u, public.places p
where u.email = 'sample.maya@roomly.test' and p.name = 'The Triangle'
  and not exists (select 1 from public.place_reactions r where r.user_id = u.id and r.place_id = p.id);

insert into public.place_reactions (user_id, place_id, reaction)
select u.id, p.id, 'like'
from auth.users u, public.places p
where u.email = 'sample.maya@roomly.test' and p.name = 'Hyde Park Commons'
  and not exists (select 1 from public.place_reactions r where r.user_id = u.id and r.place_id = p.id);

insert into public.place_reactions (user_id, place_id, reaction)
select u.id, p.id, 'like'
from auth.users u, public.places p
where u.email = 'seed.alex@roomly.demo' and p.name = 'The Triangle'
  and not exists (select 1 from public.place_reactions r where r.user_id = u.id and r.place_id = p.id);

insert into public.place_reactions (user_id, place_id, reaction)
select u.id, p.id, 'like'
from auth.users u, public.places p
where u.email = 'seed.mia@roomly.demo' and p.name = 'The Triangle'
  and not exists (select 1 from public.place_reactions r where r.user_id = u.id and r.place_id = p.id);

insert into public.place_reactions (user_id, place_id, reaction)
select u.id, p.id, 'like'
from auth.users u, public.places p
where u.email = 'seed.noah@roomly.demo' and p.name = 'The Triangle'
  and not exists (select 1 from public.place_reactions r where r.user_id = u.id and r.place_id = p.id);

insert into public.place_reactions (user_id, place_id, reaction)
select u.id, p.id, 'like'
from auth.users u, public.places p
where u.email = 'seed.ava@roomly.demo' and p.name = 'Hyde Park Commons'
  and not exists (select 1 from public.place_reactions r where r.user_id = u.id and r.place_id = p.id);

insert into public.place_reactions (user_id, place_id, reaction)
select u.id, p.id, 'like'
from auth.users u, public.places p
where u.email = 'seed.liam@roomly.demo' and p.name = 'Hyde Park Commons'
  and not exists (select 1 from public.place_reactions r where r.user_id = u.id and r.place_id = p.id);

insert into public.place_reactions (user_id, place_id, reaction)
select u.id, p.id, 'like'
from auth.users u, public.places p
where u.email = 'seed.sofia@roomly.demo' and p.name = 'Zilker Terrace'
  and not exists (select 1 from public.place_reactions r where r.user_id = u.id and r.place_id = p.id);

insert into public.place_reactions (user_id, place_id, reaction)
select u.id, p.id, 'like'
from auth.users u, public.places p
where u.email = 'seed.ethan@roomly.demo' and p.name = 'Riverside Landing'
  and not exists (select 1 from public.place_reactions r where r.user_id = u.id and r.place_id = p.id);

insert into public.place_reactions (user_id, place_id, reaction)
select u.id, p.id, 'like'
from auth.users u, public.places p
where u.email = 'seed.zoe@roomly.demo' and p.name = 'Domain Northside Flats'
  and not exists (select 1 from public.place_reactions r where r.user_id = u.id and r.place_id = p.id);

insert into public.place_reactions (user_id, place_id, reaction)
select u.id, p.id, 'like'
from auth.users u, public.places p
where u.email = 'seed.lucas@roomly.demo' and p.name = 'Aldrich House'
  and not exists (select 1 from public.place_reactions r where r.user_id = u.id and r.place_id = p.id);

insert into public.place_reactions (user_id, place_id, reaction)
select u.id, p.id, 'like'
from auth.users u, public.places p
where u.email = 'seed.emma@roomly.demo' and p.name = 'South Congress Studios'
  and not exists (select 1 from public.place_reactions r where r.user_id = u.id and r.place_id = p.id);

insert into public.place_reactions (user_id, place_id, reaction)
select u.id, p.id, 'like'
from auth.users u, public.places p
where u.email = 'seed.caleb@roomly.demo' and p.name = 'Barton Creek Villas'
  and not exists (select 1 from public.place_reactions r where r.user_id = u.id and r.place_id = p.id);

insert into public.place_reactions (user_id, place_id, reaction)
select u.id, p.id, 'like'
from auth.users u, public.places p
where u.email = 'seed.harper@roomly.demo' and p.name = 'Cherrywood Court'
  and not exists (select 1 from public.place_reactions r where r.user_id = u.id and r.place_id = p.id);

insert into public.place_reactions (user_id, place_id, reaction)
select u.id, p.id, 'like'
from auth.users u, public.places p
where u.email = 'sample.diego@roomly.test' and p.name = 'East 6th Lofts'
  and not exists (select 1 from public.place_reactions r where r.user_id = u.id and r.place_id = p.id);

-- 8) Seed two residents (declared "I live here, looking for a roommate").
--    A no-op if these sample accounts don't exist locally.
update public.profiles set place_id = p.id, looking_for_roommate = true
from public.places p
where public.profiles.id = (select id from auth.users where email = 'sample.riley@roomly.test')
  and p.name = 'The Triangle';

update public.profiles set place_id = p.id, looking_for_roommate = true
from public.places p
where public.profiles.id = (select id from auth.users where email = 'sample.diego@roomly.test')
  and p.name = 'East 6th Lofts';
