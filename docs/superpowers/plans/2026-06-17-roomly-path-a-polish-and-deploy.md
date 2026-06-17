# Path A — polished, deployed, free demo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Roomly a believable, populated, publicly deployed $0 demo (one-tap demo login + rich one-city seed data), plus a written map of what going to real users (Path B) would take.

**Architecture:** No new app subsystems — this is seed data (SQL), one reusable demo-login client component, scoped UI polish, one doc, and a collaborative deploy to Vercel. Reuses the existing Supabase client, `roomly-*` classes, and the `verification_status` gate already shipped.

**Tech Stack:** Next.js 16 (App Router, `src/`), React 19, TS, Tailwind v4, Supabase (Postgres + auth + RLS + storage), Vercel (Hobby/free), GitHub.

**Spec:** `docs/superpowers/specs/2026-06-17-roomly-path-a-polish-and-deploy-design.md`

## Global Constraints

- **$0 guardrail:** never enable a paid service. Gov-ID and SMS stay placeholders. Hosting = Vercel Hobby (free) + Supabase free tier. Use the free `*.vercel.app` URL (no custom domain).
- **One city:** all seed people/places are in **Austin, TX** for density.
- **Env vars** (exact names): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Demo login account:** the existing `sample.maya@roomly.test` / `Sample123!` (already a real, working account). The demo button signs into it.
- Idempotent SQL (safe to re-run); reuse `roomly-mark`/`roomly-btn`/`roomly-page` classes; keep the `supabaseConfigured` fallback working.
- Per `AGENTS.md`: read `node_modules/next/dist/docs/` before route/config changes.
- `npm run build` and `npm run lint` must pass; existing `npm test` (10 tests) stays green.

## Testing approach (read first)

No new unit-testable logic here, and the project has no DB in the build environment. So:
- **Seed SQL (Task 1):** verified by being well-formed + idempotent by construction; the **live run + browser check is collaborative** — the user runs `seed.sql` in the Supabase SQL editor and the controller verifies via the preview browser (Discover shows ~12 people).
- **UI (Tasks 2–3):** `npm run build` + `npm run lint` pass, then controller verifies in the preview browser.
- **Doc (Task 4):** content review.
- **Deploy (Task 5):** collaborative/human-in-the-loop with the user; verified by the live URL working.

A subagent cannot run SQL against Supabase, click the Vercel dashboard, or log into the user's accounts. Tasks 1 (live run), and 5 are therefore **controller + user** tasks, not autonomous subagent tasks.

---

## Task 1: Rich seed data (`supabase/seed.sql`)

**Files:**
- Create: `supabase/seed.sql`

**Interfaces:**
- Produces (DB, after the user runs it): ~12 verified Austin profiles that appear in Discover; the existing `sample.*` accounts marked verified; a few matches + one clean message for the demo account `sample.maya@roomly.test`.

**Known risk:** inserting into `auth.users` via SQL is the fragile part. The columns below are the widely-working Supabase pattern. If a run errors on a NOT-NULL column, add it (most missing ones are text defaulting to `''`). These seed users never log in, so no `auth.identities` row is needed.

- [ ] **Step 1: Write the seed file**

Create `supabase/seed.sql`:
```sql
-- Roomly demo seed (Austin, TX). Run in Supabase SQL editor AFTER schema.sql.
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
```

- [ ] **Step 2: Sanity-check it builds nothing (SQL-only) and commit**

Run: `npm run build` → Expected: success (confirms nothing else broke; SQL isn't compiled).
```bash
git add supabase/seed.sql
git commit -m "Add Austin demo seed (verified profiles, matches, sample chat)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 3: Collaborative live verification (controller + user)**

Controller asks the user to paste+Run `supabase/seed.sql` in the Supabase SQL editor. Then the controller, via the preview browser, demo-logs-in and confirms `/discover` shows ~12 Austin profiles with photos and `/matches` shows the seeded matches. If the `auth.users` insert errors, adapt the column list (add any NOT-NULL column the error names) and re-run.

---

## Task 2: Reusable demo-login button + add to `/login`

**Files:**
- Create: `src/components/DemoButton.tsx`
- Modify: `src/app/login/page.tsx`

**Interfaces:**
- Produces: `<DemoButton className?: string />` — a client component that signs into the demo account and routes to `/discover`.

- [ ] **Step 1: Create the component**

Create `src/components/DemoButton.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

export function DemoButton({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function tryDemo() {
    if (!supabaseConfigured) {
      router.push("/login");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: "sample.maya@roomly.test",
      password: "Sample123!",
    });
    if (error) {
      setBusy(false);
      router.push("/login");
      return;
    }
    router.push("/discover");
  }

  return (
    <button
      type="button"
      onClick={tryDemo}
      disabled={busy}
      className={className ?? "roomly-btn h-12 px-6 text-sm"}
    >
      {busy ? "Loading demo…" : "Try the demo"}
    </button>
  );
}
```

- [ ] **Step 2: Add it to the login page**

Read `src/app/login/page.tsx` first. Import `DemoButton` and render it below the existing "Log in" button as a secondary option, with a small divider label. Example placement (adapt to the file's real markup/classes):
```tsx
import { DemoButton } from "@/components/DemoButton";
// ...below the login form's submit button:
<div className="mt-4 flex items-center gap-3 text-xs text-zinc-400">
  <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
  or
  <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
</div>
<DemoButton className="roomly-btn mt-4 h-12 w-full text-sm" />
<p className="mt-2 text-center text-xs text-zinc-400">Explore as a sample user — no signup.</p>
```

- [ ] **Step 3: Build, lint, commit**

Run: `npm run build` and `npm run lint` → Expected: both pass.
```bash
git add src/components/DemoButton.tsx src/app/login/page.tsx
git commit -m "Add reusable 'Try the demo' button on login

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 4: Controller browser check**

Controller loads `/login` in the preview, clicks "Try the demo", confirms it lands on a populated `/discover`.

---

## Task 3: Landing-page clarity + demo CTA + verify-placeholder label

**Files:**
- Modify: `src/app/page.tsx` (landing)
- Modify: `src/app/verify/page.tsx`

- [ ] **Step 1: Make the landing pitch clear + add the demo CTA**

Read `src/app/page.tsx` first. Ensure the landing clearly communicates, above the fold:
- A one-line value prop, e.g. a headline "Find a roommate you can actually trust" and subtext "Verified people, real places — match, chat, and find your spot together."
- The primary CTA is the demo: render `<DemoButton />` prominently (import from `@/components/DemoButton`), with the existing sign-up/login links as secondary.
- Keep the existing animated landing scene only if it supports the pitch; if it crowds the message, reduce its prominence (do not delete wholesale — keep changes scoped).

Add the import:
```tsx
import { DemoButton } from "@/components/DemoButton";
```
Place the CTA near the headline, e.g.:
```tsx
<DemoButton className="roomly-btn h-12 px-7 text-base" />
```

- [ ] **Step 2: Label the verify ID step as a demo placeholder**

In `src/app/verify/page.tsx`, the gov-ID step copy currently reads "Secure identity check — provider coming soon." Make it unmistakably intentional for a demo, e.g.:
```tsx
<p className="text-sm text-zinc-500 dark:text-zinc-400">Demo step — a real ID/selfie check (Stripe Identity / Persona) plugs in here later. For now this completes instantly.</p>
```

- [ ] **Step 3: Build, lint, commit**

Run: `npm run build` and `npm run lint` → Expected: both pass.
```bash
git add src/app/page.tsx src/app/verify/page.tsx
git commit -m "Clarify landing pitch + demo CTA; label verify ID step as demo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 4: Controller browser check**

Controller loads `/` in the preview, confirms the pitch reads clearly and "Try the demo" is prominent and works; loads `/verify` and confirms the ID step reads as an intentional demo placeholder.

---

## Task 4: Path-B readiness doc

**Files:**
- Create: `docs/superpowers/roomly-path-b-readiness.md`

- [ ] **Step 1: Write the doc**

Create `docs/superpowers/roomly-path-b-readiness.md` covering, concisely:
- **What changes from A → B:** turn on real ID verification (Stripe Identity or Persona, ~$1.50/check) replacing the placeholder in `/verify`; wire a real SMS provider (Twilio) into Supabase for phone OTP (per-text cost + number rental); optional custom domain (~$12/yr); Vercel Pro ($20/mo) only if usage becomes commercial.
- **Legal/safety before real users:** a privacy policy + terms; basic moderation/abuse handling on `reports`; a support contact. (Reaffirm the existing guardrails: no DIY criminal/background checks, no criminal-history filters, never paywall safety.)
- **The real crux — cold start:** the app is useless below ~50–100 real people in one city/campus at once. Pick a single beachhead (one campus, one subreddit, one Discord), recruit that first cohort simultaneously, and only then expand. This is a community/marketing problem, not a code problem.
- **What's already B-ready:** the verified-only RLS gate, matches/blocks/reports schema, and messaging already enforce trust server-side — only the verification *providers* are stubbed.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/roomly-path-b-readiness.md
git commit -m "Add Path-B readiness map (costs, legal, cold-start)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Deploy to Vercel (collaborative — controller + user)

Not an autonomous subagent task (needs the user's GitHub + Vercel accounts and dashboard clicks). `gh` CLI is not installed, so GitHub is created in the browser.

**Pre-flight (controller):** confirm `npm run build` and `npm run lint` pass on the current HEAD. Confirm the offensive seed message was removed (user's scoped `delete from public.messages where body ilike '%cunt%';`).

- [ ] **Step 1: Create a GitHub repo (user, browser)**

User: at github.com → New repository → name e.g. `roomly` → **Private** is fine → Create. Do NOT initialize with a README (the repo already has history).

- [ ] **Step 2: Push (controller runs git, after user pastes the repo URL)**

```bash
git remote add origin <USER_REPO_URL>
git push -u origin main
git push origin feat/path-a-deploy-demo   # if finishing the feature branch separately
```
(If `main` is the intended deploy branch, ensure the feature work is merged to `main` first via finishing-a-development-branch.)

- [ ] **Step 3: Import to Vercel (user, browser)**

User: at vercel.com → Add New → Project → Import the GitHub repo → Framework preset auto-detects **Next.js** → before deploying, add Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL` = (value from `.env.local`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (value from `.env.local`)
Then Deploy. **Stay on the Hobby (free) plan; do not add a payment method.**

- [ ] **Step 4: Point Supabase auth at the live URL (user, browser)**

User: Supabase dashboard → Authentication → URL Configuration → set Site URL (and add to Redirect URLs) the new `https://<project>.vercel.app`. This makes login work in production.

- [ ] **Step 5: Verify live (controller + user)**

Open the live `*.vercel.app` URL, click "Try the demo", confirm the populated `/discover`, a match, and messaging all work in production with no console errors. Done.

---

## Self-review (completed during planning)

- **Spec coverage:** demo login (T2) + rich one-city seed (T1) = "both" demo access; deploy free (T5); polish landing/CTA + verify label + (user's) data cleanup (T3 + pre-flight); Path-B map (T4). All spec sections mapped.
- **Placeholders:** none unfilled. The gov-ID/SMS "placeholders" are intentional product decisions, and the `auth.users` insert risk is explicitly called out with a mitigation.
- **Type/name consistency:** `DemoButton` (created T2) is imported identically in T2 (`/login`) and T3 (`/`); env var names and the demo credential match the Global Constraints verbatim.
- **Reality flags:** T1 live-run, and T5 are collaborative (subagent can't run SQL / click dashboards / use the user's accounts) — stated up front.
