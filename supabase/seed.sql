-- Roomly demo seed (Austin, TX). Run in the Supabase SQL editor AFTER schema.sql.
-- Idempotent: safe to re-run. Also serves as the demo-state reset.

create extension if not exists pgcrypto;

-- 1) Mark existing sample.* accounts verified so they pass the gate + can demo-login.
update public.profiles p
set verification_status = 'verified', email_verified = true,
    phone_verified = true, id_verified = true, verified_at = now()
from auth.users u
where p.id = u.id and u.email like 'sample.%@roomly.test';

-- 2) Create ~12 profile-only demo users (never log in; exist so they appear in Discover).
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
select s.id, m.id, 'Hey! Saw we matched — your place sounds great. When are you hoping to move in?'
from auth.users m join auth.users s on s.email = 'seed.alex@roomly.demo'
where m.email = 'sample.maya@roomly.test'
  and not exists (select 1 from public.messages x where x.sender_id = s.id and x.recipient_id = m.id);
