# Roomly v2 — Apartment-first Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invert Roomly's core loop to place-first: swipe places → liking a place unlocks a People section (co-seekers + residents) → existing match/chat — after fixing six trust flaws.

**Architecture:** All cross-user people-pool reads go through security-definer Postgres RPCs (never client-visible RLS reads). New `places` table is the matching unit; `listings` belong to places; `place_reactions` is the swipe signal. UI is Next.js App Router client pages talking to Supabase directly, same as the rest of the app.

**Tech Stack:** Next.js (App Router, `src/`), TypeScript, Tailwind (existing `.roomly-*` design system), Supabase (`@supabase/ssr` browser client), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-09-roomly-v2-apartment-first-design.md`

## Global Constraints

- Branch `feat/v2-apartment-first`; commit per task; NO push, NO deploy, NO live-DB changes (Rad runs SQL himself and pushes via GitHub Desktop).
- `supabase/schema.sql` stays ONE idempotent file, safe to re-run top-to-bottom (`create ... if not exists`, `create or replace`, `drop policy if exists` before every `create policy`).
- $0: no paid providers; demo semantics for ID verification stay clearly commented.
- Demo-mode parity: every new page must degrade via `isMissingTable(...)` (and RPC-missing `PGRST202`) to demo data with the standard "run schema.sql" banner — never crash.
- Design system: reuse `.roomly-mark` / `.roomly-btn` / `.roomly-page` / `.roomly-card-in`, fuchsia→violet gradient for active states, VerifiedBadge stays green, animations gated behind `prefers-reduced-motion` (existing patterns do this — copy them).
- Seeds and SQL comments: ASCII only (June encoding lesson).
- `node_modules/next/dist/docs/` is the Next.js reference — this repo's Next has breaking changes vs training data; check it before using redirect/dynamic-route APIs.
- After every task: `npm run test && npm run lint && npm run build` must be green.
- SQL tasks cannot be executed locally (no local Supabase): verification = careful read-through for idempotency + the Manual RLS matrix (end of plan) that Rad runs after pasting into the SQL editor.

## Testing approach (read before starting)

Pure logic → Vitest (existing setup, `src/lib/*.test.ts`, run `npm test`). UI/RLS behavior → the app's preview flow (`npm run dev`) with demo mode, plus the Manual RLS matrix at the end for Rad's live DB. Do not add new test frameworks.

---

## Task 1: Security-definer helpers + policy hardening + repo hygiene

**Files:**
- Modify: `supabase/schema.sql` (insert a "Helpers" section AFTER the `blocks` table creation, BEFORE the `"Message your active matches"` policy, i.e. around line 194)
- Delete: `Roomly/` directory at repo root

**Interfaces:**
- Produces (SQL, used by Tasks 3, 4, 10): `public.has_active_match(a uuid, b uuid) returns boolean`, `public.is_blocked_pair(a uuid, b uuid) returns boolean` — both `stable security definer`, EXECUTE granted to `authenticated`.

Why: Postgres evaluates policy subqueries under the *caller's* RLS. The current `messages` policy checks `blocks` rows the sender can never see (recipient's blocks), so that half of the check silently passes. Security-definer helpers bypass RLS safely.

- [ ] **Step 1: Add helper functions to schema.sql**

Insert after the blocks policies (before the message policy section):

```sql
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
```

- [ ] **Step 2: Rewrite the messages INSERT policy to use the helpers**

Replace the body of `"Message your active matches"` (keep the existing `drop policy if exists` lines above it):

```sql
create policy "Message your active matches" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and (select verification_status from public.profiles where id = auth.uid()) = 'verified'
    and (select verification_status from public.profiles where id = recipient_id) = 'verified'
    and public.has_active_match(auth.uid(), recipient_id)
    and not public.is_blocked_pair(auth.uid(), recipient_id)
  );
```

- [ ] **Step 3: Harden the likes INSERT policy**

Replace `"Like as yourself"` policy body (this policy is defined BEFORE blocks exist in the file — MOVE the `drop policy if exists "Like as yourself"` + `create policy` pair down into the helpers section so the function exists first):

```sql
drop policy if exists "Like as yourself" on public.likes;
create policy "Like as yourself" on public.likes
  for insert with check (
    auth.uid() = liker_id
    and (select verification_status from public.profiles where id = auth.uid()) = 'verified'
    and not public.is_blocked_pair(auth.uid(), liked_id)
  );
```

- [ ] **Step 4: Repo hygiene**

```bash
rm -rf Roomly
git branch -d feat/apartments feat/collab-search
```
(`Roomly/` is an abandoned `git init` stub — only `.git` + `.gitattributes`; Rad confirmed deletion. Both branches are already merged into main.)

- [ ] **Step 5: Verify + commit**

Run: `npm run test && npm run lint && npm run build` — all green (schema-only change; this catches accidental file damage).
Read `supabase/schema.sql` top-to-bottom once: every object referenced by a policy/function must be created earlier in the file.

```bash
git add supabase/schema.sql
git commit -m "Fix silent block-check in RLS via security-definer helpers"
```

---

## Task 2: Verification columns become client-read-only

**Files:**
- Modify: `supabase/schema.sql` (after the profiles policies block, ~line 63)
- Modify: `src/app/verify/page.tsx` (the `persist` function, lines 37–55, and its call sites)

**Interfaces:**
- Produces (SQL): `public.complete_verification() returns void` — the ONLY client path to `verification_status='verified'`. EXECUTE to `authenticated`.
- Consumes: nothing from other tasks.

- [ ] **Step 1: Add protection trigger + RPC to schema.sql**

```sql
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
```

- [ ] **Step 2: Rework `/verify` writes**

In `src/app/verify/page.tsx`, replace `persist(next: Steps)` with a local-state setter plus a final RPC call:

```ts
  async function finishVerification(next: Steps) {
    setSteps(next);
    if (!(next.email && next.phone && next.id)) return; // not done yet — UI state only
    const supabase = createClient();
    const { error } = await supabase.rpc("complete_verification");
    if (error) {
      setNote("Couldn't finish verification — please try again.");
      return;
    }
  }
```

Update every `persist(...)` call site to `finishVerification(...)`. Intermediate steps no longer write to the DB — `pending` display (profile card) already derives from `deriveVerificationStatus` client-side where needed; verify this still renders sensibly on `/profile` and adjust its status read to fall back to the local derivation if the card looks wrong.

- [ ] **Step 3: Verify + commit**

Run: `npm run test && npm run lint && npm run build` — green.
Manual (demo mode ok): `/verify` still walks all 3 steps; completing the last shows no error with Supabase configured.

```bash
git add supabase/schema.sql src/app/verify/page.tsx
git commit -m "Make verification server-granted: protect columns, add complete_verification RPC"
```

---

## Task 3: Durable unmatch

**Files:**
- Modify: `supabase/schema.sql` (matches UPDATE policy ~line 139; new RPC after `handle_new_like`)
- Modify: `src/app/messages/[id]/page.tsx` (`unmatch()` lines 103–115, `block()` lines 117–130)

**Interfaces:**
- Produces (SQL): `public.unmatch_user(other_id uuid) returns void` — unmatches AND deletes both directions' likes. EXECUTE to `authenticated`.
- Consumes: nothing.

- [ ] **Step 1: Restrict the matches UPDATE policy**

```sql
drop policy if exists "Update own matches" on public.matches;
create policy "Unmatch own matches" on public.matches
  for update using (auth.uid() = user_a or auth.uid() = user_b)
  with check ((auth.uid() = user_a or auth.uid() = user_b) and status = 'unmatched');
```
(Clients can only ever set `unmatched`; re-activation happens solely via the reciprocal-like trigger, which now requires BOTH people to re-like because unmatching deletes the likes.)

- [ ] **Step 2: Add the unmatch RPC**

```sql
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
```

- [ ] **Step 3: Switch the conversation page to the RPC**

In `unmatch()`: replace the `.from("matches").update(...)` call with

```ts
    const { error } = await supabase.rpc("unmatch_user", { other_id: otherId });
```

In `block()`: replace its `.from("matches").update(...)` line with

```ts
    await supabase.rpc("unmatch_user", { other_id: otherId });
```

The `orderedPair` import may become unused here — remove it if so.

- [ ] **Step 4: Verify + commit**

Run: `npm run test && npm run lint && npm run build` — green.

```bash
git add supabase/schema.sql "src/app/messages/[id]/page.tsx"
git commit -m "Durable unmatch: restrict match updates, unmatch_user RPC deletes likes"
```

---

## Task 4: Reaction privacy + Together reads the matches table

**Files:**
- Modify: `supabase/schema.sql` (listing_reactions SELECT policy ~line 310)
- Modify: `src/app/apartments/together/page.tsx` (mutual-match loading, lines 61–75)

**Interfaces:**
- Consumes: `has_active_match`, `is_blocked_pair` (Task 1).

- [ ] **Step 1: Fix the listing_reactions SELECT policy**

```sql
drop policy if exists "See own and matched reactions" on public.listing_reactions;
create policy "See own and matched reactions" on public.listing_reactions
  for select using (
    auth.uid() = user_id
    or (public.has_active_match(auth.uid(), user_id)
        and not public.is_blocked_pair(auth.uid(), user_id))
  );
```

- [ ] **Step 2: Together page loads partners from matches**

Replace the sent/recv likes-intersection block (lines 62–73) with:

```ts
      const { data: matchRows } = await supabase
        .from("matches")
        .select("user_a, user_b")
        .eq("status", "active");
      const mutualIds = (matchRows ?? []).map((m: { user_a: string; user_b: string }) =>
        m.user_a === uid ? m.user_b : m.user_a,
      );
```
(RLS already scopes `matches` to rows containing the caller.) Keep the subsequent `profiles` fetch unchanged.

- [ ] **Step 3: Verify + commit**

Run: `npm run test && npm run lint && npm run build` — green.

```bash
git add supabase/schema.sql src/app/apartments/together/page.tsx
git commit -m "Scope reaction visibility to active unblocked matches; Together uses matches table"
```

---

## Task 5: Persisted people-passes

**Files:**
- Modify: `supabase/schema.sql` (new table after `likes`)
- Modify: `src/app/discover/page.tsx` (pass handling + load filter)

**Interfaces:**
- Produces (SQL, reused by Task 10's RPCs and Task 11's People page): `public.passes` (`passer_id uuid`, `passed_id uuid`, `created_at`, PK (passer_id, passed_id)).

- [ ] **Step 1: Add the passes table**

```sql
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
```

- [ ] **Step 2: Wire Discover**

In `src/app/discover/page.tsx`:
- In the load effect, alongside the `myLikes` fetch, add:

```ts
      const { data: myPasses } = await supabase.from("passes").select("passed_id").eq("passer_id", uid);
      const passed = new Set((myPasses ?? []).map((p: { passed_id: string }) => p.passed_id));
```
  and add `if (passed.has(p.id)) return false;` to the `filtered` predicate.
- Add an `onPass` handler and use it for BOTH Pass buttons (card and ProfileDetail footer) instead of the bare `setIndex((i) => i + 1)`:

```ts
  async function onPass(them: Profile) {
    setIndex((i) => i + 1);
    if (!myId) return;
    const supabase = createClient();
    await supabase.from("passes").upsert({ passer_id: myId, passed_id: them.id });
  }
```
(Fire-and-forget; if the table is missing pre-migration the upsert errors silently and behavior degrades to today's.)

- [ ] **Step 3: Verify + commit**

Run: `npm run test && npm run lint && npm run build` — green.

```bash
git add supabase/schema.sql src/app/discover/page.tsx
git commit -m "Persist people passes"
```

---

## Task 6: Places data model + curated Austin directory + lib

**Files:**
- Modify: `supabase/schema.sql` (new "Places" section AFTER the listings/saved_listings/listing_reactions sections)
- Modify: `supabase/seed.sql` (append curated directory)
- Create: `src/lib/places.ts`, `src/lib/places.test.ts`
- Modify: `src/lib/listings.ts` (add `place_id` to `Listing`; extend `isMissingTable` with `PGRST202`)

**Interfaces:**
- Produces (SQL): `public.places`, `listings.place_id`, `profiles.place_id` / `looking_for_roommate` / `people_visible`, `public.place_reactions`.
- Produces (TS, consumed by Tasks 7–13):
  - `type Place = { id: string; name: string; kind: "complex"|"building"|"house"|"other"; city: string|null; neighborhood: string|null; address: string|null; rent_min: number|null; rent_max: number|null; photos: string[]|null; website: string|null; curated: boolean|null; sponsored: boolean|null; created_at?: string }`
  - `placePhotos(p): string[]`, `placeMainPhoto(p): string` (picsum fallback by id, same pattern as `listingPhotos`)
  - `formatRentRange(min: number|null, max: number|null): string` → `"$900–$1,400/mo"` / `"$1,200/mo"` (min only or min==max) / `"Rent varies"` (both null) — use `–` en dash escape in code to keep the file ASCII-safe
  - `deckOrder(places: Place[]): Place[]` — curated first, then `created_at` desc within each group
  - `DEMO_PLACES: Place[]` (6 entries, Austin, mixed curated flags, rent ranges)
  - `getDemoPlaceReactions(): Record<string, "like"|"pass">`, `setDemoPlaceReactions(map): void` (localStorage key `roomly_demo_place_reactions`, window-guarded like `getDemoSaved`)

- [ ] **Step 1: Schema — places + columns + reactions**

```sql
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
```

- [ ] **Step 2: Curated Austin directory → append to `supabase/seed.sql`**

Ten inserts, each idempotent by name, ASCII only, picsum photos. Pattern (repeat with the table below):

```sql
insert into public.places (name, kind, city, neighborhood, rent_min, rent_max, curated, photos)
select 'The Triangle', 'complex', 'Austin, TX', 'Triangle State', 1300, 2200, true,
  array['https://picsum.photos/seed/roomly-place-triangle-a/800/1000','https://picsum.photos/seed/roomly-place-triangle-b/800/1000']
where not exists (select 1 from public.places where name = 'The Triangle');
```

| name | neighborhood | rent_min | rent_max |
|---|---|---|---|
| The Triangle | Triangle State | 1300 | 2200 |
| East 6th Lofts | East Austin | 1250 | 2100 |
| Zilker Terrace | Zilker | 1400 | 2400 |
| Hyde Park Commons | Hyde Park | 1100 | 1800 |
| Riverside Landing | Riverside | 950 | 1600 |
| Domain Northside Flats | The Domain | 1500 | 2600 |
| Aldrich House | Mueller | 1350 | 2300 |
| South Congress Studios | South Congress | 1200 | 1900 |
| Barton Creek Villas | Barton Hills | 1450 | 2500 |
| Cherrywood Court | Cherrywood | 1000 | 1700 |

All `kind='complex'` except Cherrywood Court (`'house'`).

- [ ] **Step 3: Write failing tests for the lib**

`src/lib/places.test.ts`: `formatRentRange` (range, single value, both null), `deckOrder` (curated before non-curated; newest first within group). Follow the assertion style of `src/lib/format.test.ts`.

- [ ] **Step 4: Run, verify FAIL** — `npm test -- places` (cannot import `./places`).

- [ ] **Step 5: Implement `src/lib/places.ts`** per the Interfaces block (copy the `listingPhotos` picsum-fallback and `getDemoSaved` localStorage patterns from `src/lib/listings.ts`). Add `place_id: string | null` to the `Listing` type and `"PGRST202"` to the code checks in `isMissingTable`.

- [ ] **Step 6: Run, verify PASS** — `npm test` (all suites), then `npm run lint && npm run build`.

- [ ] **Step 7: Commit**

```bash
git add supabase/schema.sql supabase/seed.sql src/lib/places.ts src/lib/places.test.ts src/lib/listings.ts
git commit -m "Add places model, place_reactions, curated Austin directory, places lib"
```

---

## Task 7: Route renames + PlacesNav + Browse lists places

**Files:**
- Rename: `git mv src/app/apartments src/app/places`, then `git mv src/app/places/page.tsx src/app/places/browse/page.tsx`, `git mv "src/app/places/[id]" "src/app/places/unit/[id]"`
- Create: `src/app/places/page.tsx` (temporary redirect → `/places/browse`; replaced by the deck in Task 9)
- Rename: `git mv src/components/ApartmentsNav.tsx src/components/PlacesNav.tsx`
- Modify: every file linking `/apartments*` (from repo grep: `src/app/discover/page.tsx`, `src/app/matches/page.tsx`, `src/app/profile/page.tsx`, `src/components/DemoButton.tsx`, the moved places pages themselves)

**Interfaces:**
- Produces: `PlacesNav` with tabs Swipe `/places` · Browse `/places/browse` · Saved `/places/saved` · Together `/places/together`. Route map used by ALL later tasks: place detail `/places/[id]` (Task 8), unit detail `/places/unit/[id]`, post form `/places/new`.

- [ ] **Step 1: Do the renames** (exact `git mv` commands above), create the temporary `src/app/places/page.tsx`:

```tsx
import { redirect } from "next/navigation";
export default function PlacesIndex() {
  redirect("/places/browse");
}
```
(Check `node_modules/next/dist/docs/` for the current `redirect` API before assuming.)

- [ ] **Step 2: Update all `/apartments` hrefs to `/places`** (grep `-rn "/apartments" src/` until zero hits; unit detail links become `/places/unit/${id}`). Rename the component to `PlacesNav`, TABS per Interfaces (4 tabs).

- [ ] **Step 3: Rework Browse (`src/app/places/browse/page.tsx`) to list places**

Keep the page's skeleton (header, demo banner, filter card, grid) but:
- Query `places` ordered `created_at desc`; demo fallback `DEMO_PLACES` via `isMissingTable`.
- Filters: search (name/city/neighborhood), max-rent slider compared against `rent_min ?? 0`, "Curated" checkbox (replaces "Verified only", checks `curated`), sort newest / rent low-high / high-low on `rent_min`. Remove beds/baths (`Segmented` stays for future use only if still used — otherwise delete it).
- Cards: photo `placeMainPhoto`, name, neighborhood, `formatRentRange(rent_min, rent_max)`, kind chip; VerifiedBadge label "Curated" when `curated`. Replace the save-heart with Like/Pass buttons (heart = like) writing `place_reactions` — copy the toggle-upsert/delete pattern from `react()` in the together page; demo mode uses `getDemoPlaceReactions`/`setDemoPlaceReactions`. Card click → `/places/${id}`.
- Remove `saved_listings` logic from this page (unit saves move to place detail in Task 8; `/places/saved` keeps working meanwhile since it reads `saved_listings` itself — verify, and update its unit links to `/places/unit/...`).

- [ ] **Step 4: Verify + commit**

Run: `npm run test && npm run lint && npm run build` — green. Manual demo-mode pass: `/places` redirects to Browse; Browse shows DEMO_PLACES with working like/pass + filters; Saved and Together still render; no `/apartments` links remain.

```bash
git add -A src/
git commit -m "Rename apartments->places; Browse lists places with like/pass"
```

---

## Task 8: Place detail + unit saves + post-form place picker

**Files:**
- Create: `src/app/places/[id]/page.tsx` (place detail)
- Modify: `src/app/places/unit/[id]/page.tsx` (back-link + save heart audit)
- Modify: `src/app/places/new/page.tsx` (place picker)

**Interfaces:**
- Consumes: `Place`, `placePhotos`, `formatRentRange`, `DEMO_PLACES` (Task 6); routes (Task 7).
- Produces: place detail at `/places/[id]` with a `#people-teaser` section that Task 10 rewires; post form writes `listings.place_id`.

- [ ] **Step 1: Build place detail page**

Client page, params `id`. Loads: the place (`places` by id, demo fallback), its listings (`listings` where `place_id = id`), the caller's reaction (`place_reactions` own row). Renders, in order: photo gallery (reuse the gallery pattern from the unit detail page), name + neighborhood/city + kind + `formatRentRange`, Like/Pass buttons (same reaction writes as Browse), the people teaser, then unit listing rows (photo, title, `formatRent`, `bedBath`, save-heart toggling `saved_listings` — move/copy `toggleSave` from the old browse code) each linking to `/places/unit/${listing.id}`.

People teaser (static until Task 10):

```tsx
<section id="people-teaser" className="mt-6 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
  {myReaction === "like" ? (
    <p className="text-sm text-zinc-600 dark:text-zinc-400">Checking who else wants this place…</p>
  ) : (
    <p className="text-sm text-zinc-600 dark:text-zinc-400">🔒 Like this place to see who else wants it.</p>
  )}
</section>
```

- [ ] **Step 2: Post form place picker**

In `/places/new`, above the existing fields add a required "Which place is this in?" block: a text input that live-filters a fetched `places` list (client-side `ilike`-style match on name) with a "Create '<typed name>'" option when no match. On submit: if creating, `insert into places` (`created_by` = uid, name + kind select defaulting `complex`, copy city/neighborhood from the form) and use its id; write `place_id` on the listing insert. Demo mode: skip the picker with a note (posting already requires real tables).

- [ ] **Step 3: Verify + commit**

Run: `npm run test && npm run lint && npm run build` — green. Manual demo pass: `/places/demo-place-1` (a `DEMO_PLACES` id) renders with locked teaser; unit rows link correctly.

```bash
git add -A src/app/places
git commit -m "Add place detail with unit saves and people teaser; post form picks a place"
```

---

## Task 9: Place swipe deck + consent note

**Files:**
- Replace: `src/app/places/page.tsx` (the Task 7 redirect becomes the deck)
- Create: `src/lib/consent.ts`, `src/lib/consent.test.ts`

**Interfaces:**
- Consumes: `deckOrder`, `DEMO_PLACES`, demo reaction helpers (Task 6).
- Produces: `peopleConsentSeen(): boolean`, `markPeopleConsentSeen(): void` (localStorage key `roomly_people_consent_seen`, window-guarded) — reused by Task 11.

- [ ] **Step 1: TDD the consent helpers** — failing tests (returns false with no flag; true after mark; false when `window` undefined), run `npm test -- consent` (FAIL), implement, run (PASS).

- [ ] **Step 2: Build the deck**

Model on `src/app/discover/page.tsx`'s structure (loading/auth gates, `index` state, card + two buttons). Differences:
- Data: places via `deckOrder`, excluding ids present in own `place_reactions` (demo: `getDemoPlaceReactions`).
- Card: `roomly-card-in`, `placeMainPhoto` hero, name, neighborhood + kind, `formatRentRange`; tap → `/places/${id}`.
- Buttons: Pass 👎 / Like ❤️ — upsert `place_reactions` (demo: localStorage helpers) then advance.
- First like ever (`!peopleConsentSeen()`): show a dismissible note overlay before advancing — copy: "People who like the same places can see your profile. Turn this off anytime in Profile." Buttons: "Got it" (calls `markPeopleConsentSeen()`); link "Manage in Profile" → `/profile`.
- `PlacesNav` on top (Swipe tab active); deck-empty state links to Browse and People.
- No people-counts on cards.

- [ ] **Step 3: Verify + commit**

Run: `npm run test && npm run lint && npm run build` — green. Manual demo pass: deck shows curated demo places first; like → consent note once; reactions persist across reload (localStorage); exhausted deck shows empty state.

```bash
git add src/app/places/page.tsx src/lib/consent.ts src/lib/consent.test.ts
git commit -m "Add place swipe deck with one-time people-visibility consent note"
```

---

## Task 10: People-pool RPCs + teaser wiring

**Files:**
- Modify: `supabase/schema.sql` (new "People pools" section at the END of the file, after places)
- Modify: `src/app/places/[id]/page.tsx` (wire `#people-teaser`)

**Interfaces:**
- Produces (SQL, consumed by Task 11): both functions return `table (id uuid, full_name text, age int, city text, bio text, avatar_url text, photos text[], budget_min int, budget_max int, cleanliness int, sleep_schedule text, smoking boolean, pets boolean, guests text, verification_status text, member_group text)` where `member_group` ∈ `'seeker' | 'resident'`:
  - `public.people_for_place(pid uuid)`
  - `public.people_for_area(p_city text, p_neighborhood text)` (`p_neighborhood` nullable)

- [ ] **Step 1: Add `people_for_place`**

```sql
-- People pools: the ONLY cross-user window into place_reactions. -----------
create or replace function public.people_for_place(pid uuid)
returns table (
  id uuid, full_name text, age int, city text, bio text, avatar_url text,
  photos text[], budget_min int, budget_max int, cleanliness int,
  sleep_schedule text, smoking boolean, pets boolean, guests text,
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
         p.smoking, p.pets, p.guests, p.verification_status,
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
```

- [ ] **Step 2: Add `people_for_area`**

Same returns/guards/exclusions shape; eligibility = caller has a like on ANY place in the area; membership = seekers only (`people_visible` + a like on any place where `city = p_city` and, when `p_neighborhood is not null`, `neighborhood = p_neighborhood`); `member_group` is always `'seeker'`. Write it out fully in the same style as Step 1 — do not abbreviate the profile column list.

```sql
grant execute on function public.people_for_area(text, text) to authenticated;
```

- [ ] **Step 3: Wire the place-detail teaser**

When the caller's reaction is `like`, call `supabase.rpc("people_for_place", { pid: id })`; render count: `N people also want this place →` linking `/people` (0 → "No one else has swiped here yet — you're early."). RPC error with `isMissingTable` → keep the static "Checking…" line replaced by a demo count from `DEMO_PLACES` context (demo: show "2 people also want this place" for curated demo places, 0 otherwise).

- [ ] **Step 4: Verify + commit**

Run: `npm run test && npm run lint && npm run build` — green.

```bash
git add supabase/schema.sql "src/app/places/[id]/page.tsx"
git commit -m "Add people-pool RPCs; place detail shows live seeker count"
```

---

## Task 11: The People page

**Files:**
- Create: `src/lib/compat.ts`, `src/lib/compat.test.ts` (extraction), `src/lib/people.ts`, `src/lib/people.test.ts`, `src/app/people/page.tsx`
- Replace: `src/app/discover/page.tsx` (redirect to `/people`)
- Modify: nav links to `/discover` (`src/app/matches/page.tsx`, `src/components/DemoButton.tsx`, `src/app/page.tsx` if present, places pages' empty states)

**Interfaces:**
- Consumes: RPCs (Task 10), `passes` (Task 5), consent helpers (Task 9), `ProfileDetail`, `VerifiedBadge`, `mainPhoto`.
- Produces:
  - `src/lib/compat.ts`: `compatibility(me, them): number`, `reasons(me, them): Reason[]`, `budgetsOverlap(me, them): boolean`, `headline(score, why): string`, `type Reason`, `sleepLabel` — moved VERBATIM from `src/app/discover/page.tsx` (plus the `Profile`-shape input type, exported as `CompatProfile`).
  - `src/lib/people.ts`: `type PoolPerson = CompatProfile & { member_group: "seeker" | "resident" }`; `groupPeopleByPlace(placesLiked: {id: string; name: string}[], poolsByPlace: Record<string, PoolPerson[]>): { place: {id: string; name: string}; people: PoolPerson[] }[]` — preserves `placesLiked` order (most recent first as passed in), dedupes a person into the FIRST section they appear in, residents sorted before seekers within a section.

- [ ] **Step 1: TDD the extraction + grouping** — write `compat.test.ts` (score is 0–100; identical lifestyle profiles score higher than opposite ones; `headline` returns first good reason) and `people.test.ts` (dedupe keeps first occurrence; residents first; empty pools drop out). Run — FAIL. Move the functions out of discover into `compat.ts` (discover imports from it for now), implement `people.ts`. Run — PASS.

- [ ] **Step 2: Build `/people`**

Structure (client page, `roomly-page`, top nav like Discover's with Places/Matches links):
1. Gates: loading / not configured / not authed / not verified (reuse Discover's verify-gate block).
2. Load: own likes+passes (exclusion sets), own `place_reactions` likes joined to `places` (ordered `created_at desc`), then `people_for_place` per liked place (`Promise.all`), `groupPeopleByPlace`, compat-score each person with the caller's profile (sort seekers by score inside `groupPeopleByPlace`'s output — scoring happens in the page, residents keep their front position).
3. Locked state (zero liked places): explainer card — "Like places first. People who want the same places show up here." CTA → `/places`.
4. Sections per place: place name header; horizontal scroll of person cards (photo, name+age, score chip via `scoreColor`, "Lives here" badge for residents); tap → `ProfileDetail` with Pass/Like footer (Pass → `passes` upsert + remove from view; Like → `likes` upsert + reciprocal check + match overlay — copy `onLike`/match overlay from Discover verbatim).
5. Empty place pool → inline `people_for_area(place.city, place.neighborhood)` fallback row, copy: "Nobody else has swiped on {name} yet — people looking in {neighborhood}:". All pools empty → city-wide fallback: the old Discover deck UI (import nothing — reuse the card/pass/like pieces already in this page over a `profiles` query filtered like Discover's) under the copy "Here's everyone verified on Roomly for now."
6. Demo mode (`isMissingTable` on the first query): scripted pools — 3 demo people (reuse seeded demo names/photos pattern from `DEMO_MATCH`) attached to two `DEMO_PLACES`, one with `member_group: "resident"`.

- [ ] **Step 3: Retire `/discover`**

`src/app/discover/page.tsx` becomes:

```tsx
import { redirect } from "next/navigation";
export default function DiscoverRedirect() {
  redirect("/people");
}
```
Update every `/discover` link to `/people` (grep until only the redirect file remains); DemoButton's post-login destination becomes `/places` (the new first action).

- [ ] **Step 4: Verify + commit**

Run: `npm run test && npm run lint && npm run build` — green. Manual demo pass: `/people` locked state without likes; after liking demo places, sections + resident badge render; pass/like work; `/discover` redirects.

```bash
git add -A src/
git commit -m "Add People page: per-place pools, fallbacks, resident badges; retire Discover"
```

---

## Task 12: Profile housing card

**Files:**
- Modify: `src/app/profile/page.tsx`

**Interfaces:**
- Consumes: `places` table (Task 6). Writes `profiles.place_id`, `looking_for_roommate`, `people_visible` (NOT protected columns — normal update policy applies).

- [ ] **Step 1: Add a "Housing" card** to the profile form (follow the existing card/section styling):
- **Where I live:** search input filtering a fetched `places` list by name (same picker interaction as Task 8's post form — extract to `src/components/PlacePicker.tsx` if you're touching both; otherwise copy), with a clear (×) button. Stores `place_id`.
- **Looking for a roommate** toggle — disabled with hint text until a place is set.
- **Show me to people who like the same places** toggle (`people_visible`), sub-text: "Off means you can still see pools, but you won't appear in them."
- Include all three in the existing profile save handler's `update` payload and initial load select.

- [ ] **Step 2: Verify + commit**

Run: `npm run test && npm run lint && npm run build` — green. Manual: toggles persist across reload (real DB) / render sanely in demo.

```bash
git add src/app/profile/page.tsx src/components/PlacePicker.tsx 2>/dev/null || git add src/app/profile/page.tsx
git commit -m "Profile: where-I-live, looking-for-roommate, people-visibility"
```

---

## Task 13: Seed expansion — reactions + residents

**Files:**
- Modify: `supabase/seed.sql`

**Interfaces:** consumes seeded sample users (`sample.*@roomly.test`) and Task 6's curated places.

- [ ] **Step 1: Seed place likes** — idempotent inserts giving ~8 seeded users likes spread over the directory so `sample.maya` shares 2+ places with others. Pattern:

```sql
insert into public.place_reactions (user_id, place_id, reaction)
select u.id, p.id, 'like'
from auth.users u, public.places p
where u.email = 'sample.jordan@roomly.test' and p.name = 'The Triangle'
  and not exists (select 1 from public.place_reactions r
                  where r.user_id = u.id and r.place_id = p.id);
```
Give maya likes on The Triangle + Hyde Park Commons; ensure at least 3 other users like The Triangle and 2 like Hyde Park Commons; scatter the rest.

- [ ] **Step 2: Seed residents** — two users (pick from the seeded Austin profiles, not maya) get:

```sql
update public.profiles set place_id = p.id, looking_for_roommate = true
from public.places p
where public.profiles.id = (select id from auth.users where email = 'sample.riley@roomly.test')
  and p.name = 'The Triangle';
```
(Direct SQL bypasses the Task 2 trigger only for verification columns — these columns are unprotected; still fine.)

- [ ] **Step 3: Verify + commit** — read seed.sql fully: idempotent, ASCII, no em dashes.

```bash
git add supabase/seed.sql
git commit -m "Seed place likes and residents for the Austin demo"
```

---

## Task 14: Landing copy, polish pass, docs, final verification

**Files:**
- Modify: `src/app/page.tsx` (landing pitch → place-first loop), `README.md` (feature list), `docs/deploy.md` (add "re-run schema.sql then seed.sql" step), `SETUP.md` if it references old routes

**Steps:**

- [ ] **Step 1: Landing copy** — hero/pitch describes the new loop: "Swipe places. Meet the people who want them too." Demo CTA unchanged; step list on the landing updated (find apartment → see people → match).
- [ ] **Step 2: Impeccable polish pass** — invoke the `impeccable` skill scoped to the NEW surfaces only (deck, Browse places cards, place detail, People page, housing card, consent note): hierarchy, empty states, copy, touch states, reduced motion.
- [ ] **Step 3: Docs** — README features section reflects places/People; deploy.md gains: "After pulling this release: SQL editor → run `supabase/schema.sql`, then `supabase/seed.sql` (both idempotent)."
- [ ] **Step 4: Final verification** — `npm run test && npm run lint && npm run build` green; full demo-mode walkthrough in the preview browser: landing → demo login → lands on `/places` deck → like 2 places (consent note once) → `/people` shows pools incl. a resident → like → match overlay → Matches/chat → Together intact → profile housing card renders.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "Landing copy, polish, docs for apartment-first v2"`.

---

## Manual RLS matrix (Rad runs after pasting schema.sql + seed.sql into the SQL editor)

Using two demo accounts (e.g. maya + jordan) in two browsers:
1. Raw self-verify blocked: in devtools run a `profiles` update setting `verification_status='verified'` → must error "verification fields can only be set by Roomly".
2. `/verify` completion works (RPC path) and grants the badge.
3. Unmatch from a conversation → other side can't message; other side re-liking alone does NOT re-match; both re-liking DOES.
4. After unmatch, the ex cannot see your Together reactions.
5. Block → likes/messages both directions fail.
6. Pass someone in People → gone after reload.
7. In devtools, `select * from place_reactions` as another user → only own rows.
8. People pool hides a user who sets `people_visible=false`, still shows residents with the toggle on.

## Self-review (completed during planning)

- Spec coverage: 4.1→T2, 4.2→T1+T3, 4.3/4.4→T4, 4.5→T5, 4.6→T1, 4.7→T1 (drag-reorder already merged pre-plan), §5→T6, §6→T10, §7.1→T7/T11, §7.2→T7/T8/T9, §7.3→T11, §7.4→T9/T12, §7.5→T6–T11 demo steps, §8→T6/T13, §9→isMissingTable+PGRST202 (T6) and per-page fallbacks, §10→lib tests T6/T9/T11 + matrix above, §11→Global Constraints.
- Type consistency: `member_group` name/values match between both RPCs and `PoolPerson`; `unmatch_user(other_id)` param name matches the `.rpc()` calls; localStorage keys consistent (`roomly_demo_place_reactions`, `roomly_people_consent_seen`).
- No placeholders: area-RPC step explicitly instructs writing the full column list; UI tasks reference concrete existing patterns by file/function name.
