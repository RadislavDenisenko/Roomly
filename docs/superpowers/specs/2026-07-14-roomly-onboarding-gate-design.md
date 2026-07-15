# Roomly — Required-profile onboarding + gender-aware matching

**Date:** 2026-07-14
**Status:** Approved by Rad (3 design sections approved in session)
**Branch:** `feat/onboarding-gate` (off `main` @ bdb3e57)

## 1. Goal

Nobody swipes places or sees people until their profile carries the
information other people actually match on. A 3-step onboarding wizard
collects it; the swipe deck, Browse reactions, and People pools are gated on
completeness (server-enforced for pools); a male/female/either roommate
preference becomes a hard, mutual filter; the remaining new fields feed the
compatibility score so results rank closest-first and widen gracefully.

## 2. Non-goals (parked)

- Religion, diet, politics, or language fields (deliberately excluded for MVP).
- Income verification (income is self-reported, optional, display-only).
- Any change to the identity-verification gate (verify flow stays as-is).
- Editing the fold/3D work on `feat/visual-3d` (independent branch).
- Paid features; $0 rule stays.

## 3. Key decisions

- **Wizard over form-gate** (Rad's pick): `/onboarding`, three steps, in the
  existing design language.
- **Gender preference is a hard, MUTUAL filter** that never widens: person P
  appears for caller C only if (C's pref is 'any' OR P.gender = C's pref)
  AND (P's pref is 'any' OR C.gender = P's pref). Nonbinary/other users are
  matched by the 'any' preference only — stated plainly in the toggle's
  helper copy.
- **Everything else ranks and widens** (Rad: "first people you match with…
  then farther and farther"): compat-score sort within a pool, then the
  existing place → neighborhood → city tiers, with honest copy at each
  widening step. No other hard filters added.
- **Completeness is server-enforced where it matters:** the people RPCs
  refuse ineligible callers and exclude incomplete profiles from pools.
  Place-reaction gating is client-side only (bypassing it is harmless).
- **Existing users** (including seeded demo users pre-seed-update) hit the
  gate once and fill only missing fields — the wizard pre-fills everything
  it can.
- **Income** is optional, monthly, self-reported; shown ONLY on the full
  ProfileDetail sheet and only when provided.

## 4. Data model (`supabase/schema.sql`, idempotent)

### 4.1 `profiles` additions

```sql
alter table public.profiles
  add column if not exists gender text
    check (gender in ('male','female','nonbinary','other')),
  add column if not exists roommate_gender_pref text
    check (roommate_gender_pref in ('male','female','any')),
  add column if not exists roommates_wanted int
    check (roommates_wanted between 1 and 3),   -- 3 renders as "3+"
  add column if not exists work_schedule text
    check (work_schedule in ('day','night','wfh','flexible')),
  add column if not exists income_monthly int
    check (income_monthly is null or income_monthly between 0 and 100000),
  add column if not exists overnight_guests text
    check (overnight_guests in ('rarely','sometimes','often')),
  add column if not exists noise_level int
    check (noise_level is null or noise_level between 1 and 5);
```

All new columns are outside the verification-protection trigger's column set
— ordinary profile updates keep working.

### 4.2 `profile_complete(uid)` function

`security definer stable, set search_path = public`, EXECUTE to
`authenticated`. Returns true when ALL of these are non-null:
`full_name, age, city, gender, roommate_gender_pref, budget_min, budget_max,
roommates_wanted, work_schedule, cleanliness, sleep_schedule, smoking, pets,
guests`. (`income_monthly`, `overnight_guests`, `noise_level`,
`move_in_date`, `bio`, photos are NOT required.)

## 5. Completeness gating

### 5.1 Client lib — `src/lib/completeness.ts` (+ tests)

- `REQUIRED_PROFILE_FIELDS` (the §4.2 list, single source of truth for the client)
- `isProfileComplete(p): boolean`
- `missingProfileFields(p): string[]` (human labels, drives wizard copy like
  "2 quick things left")

### 5.2 Where the gate appears

- `/places` (swipe deck): if authed but incomplete → a friendly lock card:
  "Finish your profile so people can match with you — takes 2 minutes" → CTA
  `/onboarding`. (The deck deliberately does NOT require verification —
  unchanged from the v2 decision; verification still gates People, likes,
  and messaging.)
- `/people`: existing verify-gate keeps precedence, then the completeness
  lock card.
- `/places/browse` and place detail: pages stay browsable; the Like/Pass
  controls redirect to `/onboarding` when incomplete (browsing is the hook,
  reacting requires skin in the game).
- RPC guard: `people_for_place` / `people_for_area` add
  `profile_complete(auth.uid())` to their caller guards, and pool membership
  (both seekers and residents) additionally requires the member's profile to
  be complete.

### 5.3 Fail-open on missing columns

If reading the new columns fails because the live DB hasn't run the new
`schema.sql` yet (missing-column error, same family as `isMissingTable`),
the gate treats the profile as complete and shows the standard "run
schema.sql" banner instead of locking users out of a demo they can't fix
from the UI.

## 6. Matching changes

### 6.1 RPCs (`people_for_place`, `people_for_area`)

Add to the membership predicate (both functions, same shape):

```sql
and public.profile_complete(p.id)
and ( (select c.roommate_gender_pref from public.profiles c where c.id = auth.uid()) = 'any'
      or p.gender = (select roommate_gender_pref from public.profiles c where c.id = auth.uid()) )
and ( p.roommate_gender_pref = 'any'
      or p.roommate_gender_pref = (select gender from public.profiles c where c.id = auth.uid()) )
```

(Implementation may hoist the caller row into variables/CTE; semantics as
above.)

### 6.2 City-wide fallback (client query in `people/page.tsx`)

Apply the same mutual-gender + completeness filtering client-side (profiles
are already readable; the query already filters `people_visible`).

### 6.3 Compatibility score (`src/lib/compat.ts` + tests)

Current weights total 100 (cleanliness 25, sleep 15, smoking 15, pets 10,
guests 10, budget 15, city 10). Rebalance to make room, keeping 100 max:

| Factor | New weight |
|---|---|
| cleanliness distance | 20 |
| sleep schedule | 12 |
| smoking match | 12 |
| pets match | 8 |
| guests distance | 8 |
| budget overlap | 12 |
| same city | 8 |
| **work schedule** (equal = full; either 'flexible' = half) | **8** |
| **roommates_wanted** (equal = full; off-by-one = half) | **6** |
| **overnight_guests distance** (only when both set) | **3** |
| **noise_level distance** (only when both set) | **3** |

`reasons()` gains work-schedule and overnight-guests lines (good and bad
variants); headline logic unchanged. Optional factors contribute 0 (not a
penalty) when either side hasn't set them. All existing tests updated to the
new weights + new cases for the four factors.

### 6.4 Display

`ProfileDetail` adds: gender chip (subtle, next to age), "Looking for
N roommates" tile, work-schedule chip, overnight-guests + noise chips when
set, and "~$X/mo income" in the budget tile only when provided. Person cards
in People stay clean (no new chips there).

## 7. The wizard — `/onboarding`

- Three steps with progress dots, one screen each, design-system styled
  (`.roomly-page`, `.roomly-btn`, card entrance, reduced-motion gates):
  1. **You** — full name, age, gender, city.
  2. **Your place** — budget range (the min/max inputs `/profile` already
     uses, extracted and reused), how many
     roommates (1 / 2 / 3+ segmented), looking-for toggle
     (male / female / either, with the nonbinary helper copy), optional
     income field ("Optional — shown on your profile if you fill it").
  3. **Your habits** — cleanliness (1–5), sleep schedule, work schedule,
     smoking, pets, friends over, plus optional overnight-guests and noise
     (grouped under "Optional, but helps").
- Each step saves on Next (partial progress survives refresh); required
  fields validate per step; Finish → `/places` (the deck). If profile is
  already complete on entry → redirect `/places`.
- Entry points: signup success chain (signup → verify → onboarding), every
  gate card from §5.2, and the verify page's completion CTA points here when
  the profile is incomplete.
- Field inputs are extracted as shared components (`ProfileFields.tsx`) and
  reused on `/profile`, which gains all new fields in its existing sections
  (single edit surface, no drift).

## 8. Seeds & demo

- `seed.sql`: idempotent updates give every seeded/sample user the new
  required fields with a deliberate mix of genders and preferences such that
  `sample.maya` (female, pref 'any') still sees ≥2 people on The Triangle
  after mutual filtering, and at least one seeded pair demonstrates the
  filter (e.g. a male-only-pref user invisible to a female caller). ASCII
  only.
- Demo constants (People demo pools, DEMO profiles) gain the new fields so
  demo mode renders chips and ranking realistically.
- Demo-mode wizard: works against the live `profiles` table when columns
  exist; missing columns → §5.3 fail-open + banner.

## 9. Error handling & edge cases

- Age 18–99, budget min ≤ max (swap on save if inverted), income clamps to
  the check range, roommates_wanted 1–3.
- Gate precedence: not configured → not authed → not verified → incomplete.
- Wizard step save failure surfaces inline ("Couldn't save — try again"),
  never advances silently.
- A user who un-fills a required field later via /profile (clearing city,
  say) simply re-hits the gate next visit — no special handling.
- RPC callers that fail `profile_complete` get empty results (locked UI
  state), never an error toast.

## 10. Testing

- Vitest: completeness helpers (complete/incomplete/missing-labels), compat
  reweighting (totals ≤100, each new factor's full/half/absent cases,
  optional-factor neutrality), wizard step-validation helper if extracted.
- Existing suites stay green; `npm run test && npm run lint && npm run build`
  per task.
- Manual matrix additions (two demo accounts, live DB): incomplete profile
  can't fetch pools and never appears in one; mutual gender filter blocks
  both directions; wizard gate flow end-to-end; fail-open banner pre-SQL.

## 11. Implementation constraints

Same as the v2 round: branch `feat/onboarding-gate`; `schema.sql` stays ONE
idempotent file; ASCII seeds; $0; no push/deploy/live-DB (Rad runs SQL and
pushes via GitHub Desktop — hand him the exact re-run list); demo-mode
parity; impeccable skill on the wizard UI; subagent-driven execution with
per-task review.

## 12. Open questions

None blocking. (Income display copy fixed as "~$X/mo income"; nonbinary
handling fixed as 'any'-only visibility with explicit helper copy.)
