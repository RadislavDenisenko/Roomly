# Roomly — Required-profile Onboarding + Gender Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate swiping/pools behind a complete profile collected by a 3-step `/onboarding` wizard; add a hard mutual male/female/either filter and four new ranked compatibility factors.

**Architecture:** New `profiles` columns + a `profile_complete()` SQL function that the people RPCs enforce server-side; a client completeness lib drives lock cards and the wizard; shared field components keep `/onboarding` and `/profile` from drifting.

**Tech Stack:** Next.js App Router client pages, Supabase (`@supabase/ssr`), Tailwind + `.roomly-*` design system, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-14-roomly-onboarding-gate-design.md`

## Global Constraints

- Branch `feat/onboarding-gate` (off main @ bdb3e57); commit per task; NO push/deploy/live-DB (Rad runs SQL + pushes via GitHub Desktop).
- `supabase/schema.sql` stays ONE idempotent file, re-runnable top-to-bottom; objects created before first reference; ASCII-only comments. `seed.sql` idempotent + ASCII.
- Gender values: `'male'` / `'female'` ONLY; preference values `'male'`/`'female'`/`'any'`. The filter is mutual and NEVER widens.
- The swipe deck's gate requires a COMPLETE profile but NOT verification (v2 decision stands: verification gates People/likes/messaging only).
- Fail-open: missing new columns on the live DB must never lock anyone out — treat as complete + show the standard "run schema.sql" banner.
- Optional fields (`income_monthly`, `overnight_guests`, `noise_level`) never penalize the compat score when absent.
- Demo-mode parity via `isMissingTable`/`isMissingColumn`; design system classes reused; reduced-motion gates on any new animation; `hover:` paired with `active:`.
- Keep `/places/page.tsx` edits MINIMAL and additive (a gate block before the deck render) — `feat/visual-3d` rewrites that file's deck JSX and must rebase cleanly over this branch later.
- After every task: `npm run test && npm run lint && npm run build` green.
- SQL tasks can't run locally: verification = idempotency/ordering read-through + the Manual matrix (end of plan) Rad runs post-SQL.

---

## Task 1: Schema — columns, profile_complete(), RPC enforcement

**Files:**
- Modify: `supabase/schema.sql` (profiles section ~line 50; `people_for_place` body at ~534–575; `people_for_area` at ~577–622; new function before the RPCs)

**Interfaces:**
- Produces (SQL): the §4.1 columns verbatim from the spec; `public.profile_complete(uid uuid) returns boolean` (`stable security definer set search_path = public`, EXECUTE to `authenticated`); both RPCs gain caller guard + membership predicates.

- [ ] **Step 1: Columns** — add the spec §4.1 `alter table` block verbatim after the existing profiles alters.

- [ ] **Step 2: profile_complete()** — insert BEFORE the "People pools" section:

```sql
-- True when every field required for matching is filled (see onboarding spec).
create or replace function public.profile_complete(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid
      and p.full_name is not null and p.age is not null and p.city is not null
      and p.gender is not null and p.roommate_gender_pref is not null
      and p.budget_min is not null and p.budget_max is not null
      and p.roommates_wanted is not null and p.work_schedule is not null
      and p.cleanliness is not null and p.sleep_schedule is not null
      and p.smoking is not null and p.pets is not null and p.guests is not null
  );
$$;

grant execute on function public.profile_complete(uuid) to authenticated;
```

- [ ] **Step 3: RPC caller guards** — in BOTH `people_for_place` and `people_for_area`, after the existing verified-caller guard add:

```sql
  if not public.profile_complete(auth.uid()) then return; end if;
```

- [ ] **Step 4: RPC membership predicates** — declare in each function `c_gender text; c_pref text;`, populate once after the guards:

```sql
  select p.gender, p.roommate_gender_pref into c_gender, c_pref
    from public.profiles p where p.id = auth.uid();
```

then extend each function's membership `where` clause with:

```sql
    and public.profile_complete(p.id)
    and (c_pref = 'any' or p.gender = c_pref)
    and (p.roommate_gender_pref = 'any' or p.roommate_gender_pref = c_gender)
```

- [ ] **Step 5: Verify + commit** — read schema.sql top-to-bottom (ordering: `profile_complete` must precede both RPCs; columns precede the function), `npm run test && npm run lint && npm run build` green.

```bash
git add supabase/schema.sql
git commit -m "Schema: profile completeness function + mutual gender filter in people RPCs"
```

---

## Task 2: Completeness lib + missing-column detection (TDD)

**Files:**
- Create: `src/lib/completeness.ts`, `src/lib/completeness.test.ts`
- Modify: `src/lib/listings.ts` (add `isMissingColumn`)

**Interfaces:**
- Produces (consumed by Tasks 4–7):
  - `REQUIRED_PROFILE_FIELDS: { key: string; label: string }[]` — keys exactly: full_name, age, city, gender, roommate_gender_pref, budget_min, budget_max, roommates_wanted, work_schedule, cleanliness, sleep_schedule, smoking, pets, guests; labels human ("Your name", "Budget range", "Looking for", …).
  - `isProfileComplete(p: Record<string, unknown> | null): boolean` — false for null; a field counts filled when `!= null` (booleans false are FILLED — smoking:false is an answer; strings must be non-empty after trim).
  - `missingProfileFields(p): string[]` — labels of unfilled fields, REQUIRED_PROFILE_FIELDS order.
  - `isMissingColumn(error): boolean` in `src/lib/listings.ts` — true for code `42703`, code `PGRST204`, or message matching `/column .* does not exist|could not find the .* column/i`.

- [ ] **Step 1: Failing tests** — complete profile true; null false; boolean-false fields count as filled; empty-string name counts missing; missing-labels order; `isMissingColumn` for each trigger + false for unrelated errors. Style of `src/lib/places.test.ts`.
- [ ] **Step 2: Run — FAIL** (`npm test -- completeness`).
- [ ] **Step 3: Implement** per Interfaces.
- [ ] **Step 4: Run — PASS**, then full `npm run test && npm run lint && npm run build`.
- [ ] **Step 5: Commit** — `git add src/lib && git commit -m "Add profile-completeness lib and missing-column detection"`

---

## Task 3: Compat score reweighting (TDD)

**Files:**
- Modify: `src/lib/compat.ts`, `src/lib/compat.test.ts`

**Interfaces:**
- `CompatProfile` gains optional fields: `gender`, `roommate_gender_pref`, `roommates_wanted`, `work_schedule`, `income_monthly`, `overnight_guests`, `noise_level` (all `| null`).
- `compatibility(me, them)` uses the spec §6.3 weight table EXACTLY (sums to 100): cleanliness 20 (distance/4 scale), sleep 12 (flexible = half), smoking 12, pets 8 (mismatch keeps a small floor like today ~3), guests 8 (index distance /2), budget 12, city 8, work_schedule 8 (equal full, either `'flexible'` half), roommates_wanted 6 (equal full, off-by-one half), overnight_guests 3 (index distance /2, only when both set), noise_level 3 (|diff|/4 scale, only when both set).
- `reasons()` adds: work-schedule good/bad line ("Both work days" / "You work days, they work nights"; wfh = "works from home") and overnight-guests lines when both set. Cap stays `.slice(0, 4)`.

- [ ] **Step 1: Update tests first** — adjust existing weight expectations; add: identical-profiles = 100; work-schedule full/half/mismatch; roommates off-by-one; optional factors absent → identical score to both-unset baseline (neutrality); reasons include work-schedule line. Run — FAIL.
- [ ] **Step 2: Implement**; run — PASS; full suite + lint + build.
- [ ] **Step 3: Commit** — `git commit -m "Compat: add work schedule, roommate count, overnight guests, noise factors"`

---

## Task 4: Shared profile field components + /profile adopts new fields

**Files:**
- Create: `src/components/ProfileFields.tsx`
- Modify: `src/app/profile/page.tsx` (741 lines — form state ~14–42, load ~94–108, `handleSave` ~219–260, JSX sections below)

**Interfaces:**
- Produces controlled components (consumed by Task 5's wizard), each `{ value, onChange }` props, styled from the existing profile inputs they replace:
  - `GenderSelect` (male/female segmented), `LookingForSelect` (male/female/either segmented, label "Show me"), `RoommatesWantedSelect` (1/2/3+ segmented mapping 3+→3), `WorkScheduleSelect` (day/night/wfh/flexible), `BudgetRangeInputs` (min/max, extracted from profile), `CleanlinessSlider`, `SleepScheduleSelect`, `SmokingToggle`, `PetsToggle`, `GuestsSelect` (extracted), `IncomeInput` (optional, "$/month, optional — shown on your profile"), `OvernightGuestsSelect` (optional), `NoiseSlider` (optional).

- [ ] **Step 1: Extract** the existing budget/cleanliness/sleep/smoking/pets/guests inputs from `/profile` into `ProfileFields.tsx` with identical rendering; profile page consumes them (pure refactor — page renders pixel-identical; verify by eye in dev if quick).
- [ ] **Step 2: Add the new fields** to profile form state/load/save (`gender`, `roommate_gender_pref`, `roommates_wanted`, `work_schedule`, `income_monthly`, `overnight_guests`, `noise_level`) rendered via the new components: gender+looking-for in the basics card, roommates_wanted+income in the budget card, work_schedule+overnight+noise in lifestyle. Save payload parses ints null-safe like `budget_min` (~line 236); budget min>max swaps on save (spec §9).
- [ ] **Step 3:** `npm run test && npm run lint && npm run build` green; commit `"Extract shared profile fields; profile gains matching fields"`.

---

## Task 5: The /onboarding wizard

**Files:**
- Create: `src/app/onboarding/page.tsx`
- Modify: `src/app/signup/page.tsx:38` (`router.push("/profile")` → `router.push("/verify")`), `src/app/verify/page.tsx` (its finish/next CTA → `/onboarding` when `!isProfileComplete(profile)`, else `/places`)

**Interfaces:**
- Consumes: `ProfileFields` components (Task 4), `isProfileComplete`/`missingProfileFields`/`isMissingColumn` (Task 2).
- Route: `/onboarding`, steps in-page state (`?step=` optional deep-link), progress dots, `roomly-page`/`roomly-card-in` styling.

- [ ] **Step 1: Build the wizard.** Load own profile; if `isProfileComplete` → `router.replace("/places")`. If the profile select errors with `isMissingColumn` → render the standard "run schema.sql" banner state (no wizard). Steps per spec §7: (1) You — name, age, GenderSelect, city; (2) Your place — BudgetRangeInputs, RoommatesWantedSelect, LookingForSelect, IncomeInput; (3) Your habits — CleanlinessSlider, SleepScheduleSelect, WorkScheduleSelect, SmokingToggle, PetsToggle, GuestsSelect + an "Optional, but helps" group (OvernightGuestsSelect, NoiseSlider). Each step: required-field inline validation (age 18–99, budget min≤max with swap), Next persists that step's fields via `profiles` update, error surfaces inline and does NOT advance. Finish → `/places`. Header copy uses `missingProfileFields` count when arriving partially complete ("Just N quick things").
- [ ] **Step 2: Entry chain** — signup redirect + verify CTA edits above.
- [ ] **Step 3:** test/lint/build green; manual dev pass of all three steps; commit `"Add 3-step onboarding wizard; signup/verify chain into it"`.

---

## Task 6: Gates on deck, browse/detail reactions, People

**Files:**
- Modify: `src/app/places/page.tsx` (main's version — additive only), `src/app/places/browse/page.tsx`, `src/app/places/[id]/page.tsx`, `src/app/people/page.tsx` (verify gate ~99–122)

**Interfaces:** consumes Task 2 lib. Gate card copy everywhere: "Finish your profile so people can match with you — takes 2 minutes." CTA `roomly-btn` → `/onboarding`.

- [ ] **Step 1: Deck** — in the load effect, fetch own profile (`select("*")`); `isMissingColumn(error)` → proceed ungated + demo-style banner; else `!isProfileComplete` → render the lock card INSTEAD of the deck (before the `!current` branch; keep the diff small — one state flag + one early-return block in the JSX).
- [ ] **Step 2: Browse + place detail** — same completeness state; incomplete → Like/Pass handlers `router.push("/onboarding")` instead of writing (buttons stay visible; a small "Finish your profile to react" hint appears near the controls on first attempt).
- [ ] **Step 3: People** — after the verify gate block, incomplete → lock card (same copy) instead of pools.
- [ ] **Step 4:** test/lint/build; manual demo-mode pass (pre-SQL fail-open shows banner, nothing locks); commit `"Gate reactions and pools behind profile completeness"`.

---

## Task 7: Fallback filter parity + ProfileDetail display

**Files:**
- Modify: `src/app/people/page.tsx` (city-wide fallback query ~194–197 + its client filter), `src/components/ProfileDetail.tsx`

- [ ] **Step 1: City fallback** — extend the fallback's client-side predicate with mutual gender logic (`myPref === 'any' || p.gender === myPref`, `p.roommate_gender_pref === 'any' || p.roommate_gender_pref === myGender`) AND `isProfileComplete(p)`. (RPC tiers already enforce server-side from Task 1.)
- [ ] **Step 2: ProfileDetail** — add per spec §6.4: gender chip next to age ("Male"/"Female", subtle zinc chip), "Looking for N roommate(s)" tile (3 → "3+"), work-schedule chip (Day worker / Night worker / Works from home / Flexible), overnight-guests + noise chips only when set, income line in the budget tile only when `income_monthly != null` ("~$X/mo income", `toLocaleString`).
- [ ] **Step 3:** test/lint/build; commit `"Mutual gender filter in city fallback; richer ProfileDetail"`.

---

## Task 8: Seeds, demo constants, docs, final pass

**Files:**
- Modify: `supabase/seed.sql`, `src/app/people/page.tsx` (DEMO people constants ~lines 30–50), `src/lib/places.ts` only if demo profiles live there (they don't — verify), `docs/deploy.md`, `README.md`

- [ ] **Step 1: Seed updates** — idempotent `update public.profiles set ... where id = (select id from auth.users where email = '...') and gender is null` blocks giving EVERY seeded/sample user: gender (mix), roommate_gender_pref (mostly 'any'; at least one 'male'-only and one 'female'-only), roommates_wanted (1–3), work_schedule (mix incl. one 'wfh'), and 2–3 users with income/overnight/noise. REQUIRED outcome (state it in a seed comment): `sample.maya` (female, pref 'any') still sees ≥2 people on The Triangle after mutual filtering; one seeded user is invisible to her because of THEIR pref (demonstrates mutuality). ASCII only.
- [ ] **Step 2: Demo constants** — the scripted People demo pool + any demo profiles gain the new fields so chips render.
- [ ] **Step 3: Docs** — deploy.md: re-run schema.sql then seed.sql note for this release; README feature list gains onboarding + gender preference lines.
- [ ] **Step 4: Final verification** — full suite/lint/build; impeccable-skill polish pass scoped to the wizard + lock cards; demo-mode walkthrough: fresh demo login → wizard gate → fill 3 steps → deck unlocks → People pools reflect gender toggle.
- [ ] **Step 5: Commit** — `"Seed matching fields; onboarding docs + polish"`.

---

## Manual matrix additions (Rad, after running schema.sql + seed.sql)

1. Fresh/incomplete account: `/places` and `/people` show the lock card; wizard fills; deck unlocks without re-login.
2. Devtools RPC call as an incomplete profile → empty result (no error).
3. Maya (pref 'any') sees mixed genders; a male-only-pref account never appears for a female caller and vice versa — check BOTH directions.
4. Incomplete profiles appear in no pool and no city fallback.
5. Pre-SQL client (old DB): no lockout — banner shows, everything behaves like before this round.

## Self-review (completed during planning)

- Spec coverage: §4→T1, §5.1→T2, §5.2→T6, §5.3→T2/T5/T6 (fail-open in each gate), §6.1→T1, §6.2→T7, §6.3→T3, §6.4→T7, §7→T4/T5, §8→T8, §9→T5/T6 validations, §10→T2/T3 tests + matrix.
- Type consistency: field keys identical across REQUIRED_PROFILE_FIELDS (T2), ProfileFields (T4), wizard saves (T5), seed columns (T8); `roommates_wanted` 3 = "3+" everywhere; `isMissingColumn` name consistent T2/T5/T6.
- No placeholders: every SQL/step carries its content or an exact extraction source (file:line).
