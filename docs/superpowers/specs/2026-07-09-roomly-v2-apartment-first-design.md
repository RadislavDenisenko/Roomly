# Roomly v2 — Apartment-first matching

**Date:** 2026-07-09
**Status:** Approved by Rad (design sections 1–4 approved in session)
**Kickoff prompt:** `docs/roomly-v2-apartment-first-prompt.md`

## 1. Goal

Invert the core loop from people-first to **place-first**: users swipe on places
(apartment complexes/buildings) first; liking a place unlocks a **People**
section showing (a) other verified seekers who liked the same place and
(b) verified residents of that place looking for a roommate. Matching, chat,
and the shared shortlist stay as they are. Before any new feature, fix the six
trust/correctness flaws found in the 2026-07-09 code review.

## 2. Non-goals (parked)

- Monetization (sponsored places, ads). Only a dormant `sponsored` flag on
  places so the data model doesn't block it later.
- Proof of residency for residents (self-declared for MVP).
- Scraped or API-sourced listings (hand-curated Austin directory only).
- Paid providers of any kind ($0 rule stays: no SMS, no ID vendor).
- Pass expiry / "reset passes" UI (passes are permanent for MVP).
- Match expiry (already decided against in the June round).

## 3. Key decisions

- **Match at the place level** (complex/building), not per-unit. Listings
  belong to places. Bigger people-pools; survives unit turnover.
- **Swipe UX = deck + grid** (Rad's pick): a Tinder-style deck is the default
  Places experience; the existing filterable grid stays as Browse. Both write
  the same `place_reactions`.
- **People pools are computed by security-definer Postgres functions (RPCs)**,
  not by RLS-visible cross-user reads. Raw reaction data of other users is
  never selectable by clients. This same helper-function pattern fixes the
  pre-existing silent block-check bug (see 4.6).
- **Consent:** appearing in seeker pools requires `profiles.people_visible`
  (default true, one-time explanation on first place-like, toggle in Profile).
  For residents, the `looking_for_roommate` toggle *is* the consent.
- **Nav becomes Places · People · Matches · Profile.** Routes rename
  `/apartments/*` → `/places/*`, `/discover` → `/people` (redirect kept).
  Nothing is deployed publicly yet, so no external links break.
- **Demo-mode parity:** everything new degrades to demo data when tables/RPCs
  are missing (`isMissingTable` pattern), same as the existing pages.

## 4. Phase 0 — fixes before features

All schema changes are idempotent additions to `supabase/schema.sql`.

### 4.1 Verification columns become client-read-only

Problem: the `profiles` UPDATE policy lets any user set
`verification_status='verified'` / `id_verified` / `verified_at` /
`email_verified` / `phone_verified` directly via the API, defeating the gate
that likes and messages depend on.

Fix:
- Trigger `protect_verification_columns` (BEFORE UPDATE on `profiles`):
  if any of those five columns changed **and** `auth.uid()` is not null
  (i.e., the write comes from a client session, not the SQL editor/service
  role), raise an exception. Seed scripts and admin SQL keep working.
- New RPC `complete_verification()` (security definer): the only client path
  to verified. It checks `auth.uid()` is present, reads `auth.users`
  (`email_confirmed_at`, `phone_confirmed_at`), sets `email_verified`,
  `phone_verified` accordingly, and — **demo semantics, clearly commented** —
  sets `id_verified=true`, `verification_status='verified'`,
  `verified_at=now()`. Path B hardens this one function (require phone,
  ID-vendor webhook) instead of touching the app.
- `/verify` page: steps keep doing real auth work (email, phone OTP attempt),
  but the final write becomes a single `complete_verification()` call; remove
  all direct writes to the protected columns.

### 4.2 Durable unmatch

Problem: either party can UPDATE `matches.status` back to `'active'`, and
`handle_new_like`'s `on conflict do update set status='active'` re-activates
a match if one side deletes and re-inserts their like.

Fix:
- `matches` UPDATE policy gets `with check (status = 'unmatched')` — clients
  can unmatch, never re-activate.
- New RPC `unmatch_user(other_id uuid)` (security definer): sets the pair's
  match to `'unmatched'` **and deletes both directions' `likes` rows**. The
  existing trigger's re-activation is then legitimate: it only fires again
  when *both* people have re-liked each other. Conversation page switches its
  unmatch (and block, which also unmatches) to this RPC.
- `likes` INSERT policy additionally requires
  `not is_blocked_pair(auth.uid(), liked_id)` (helper from 4.6) so blocked
  pairs can't even like.

### 4.3 Reaction privacy after unmatch/block

Problem: `listing_reactions` SELECT policy grants access on raw mutual `likes`
rows, so after an unmatch or block the other person can still read all your
listing reactions.

Fix: policy becomes own rows OR
(`has_active_match(auth.uid(), user_id)` AND `not is_blocked_pair(...)`).

### 4.4 Together page uses the matches table

Problem: `/apartments/together` derives "your matches" from raw `likes`
intersection, so unmatched/blocked people still appear in the picker.

Fix: load partners from `matches` where `status='active'` (and profiles by
those ids), same as the Matches page.

### 4.5 Persisted people-passes

Problem: passing someone in Discover only bumps a local index; they reappear
on reload.

Fix: new `passes` table (`passer_id`, `passed_id`, `created_at`,
PK both, RLS: insert/select/delete own as passer). People UIs insert on Pass
and exclude passed ids on load. No expiry in MVP.

### 4.6 Security-definer helpers (and the silent block-check bug)

Postgres evaluates policy subqueries under the *querying user's* RLS on the
referenced tables. The `messages` INSERT policy checks "recipient hasn't
blocked me" against `blocks`, but the sender can only SELECT their **own**
block rows — so that half of the check always passes silently. Today it's
masked because blocking also unmatches, but the policy is broken as written.

Fix: two helpers, `security definer stable`, `set search_path = public`,
EXECUTE granted to `authenticated`:
- `has_active_match(a uuid, b uuid) returns boolean`
- `is_blocked_pair(a uuid, b uuid) returns boolean` (either direction)

Rewrite the block/match subqueries in the `messages` policy (and use them in
4.2/4.3) to go through these helpers.

### 4.7 Hygiene

- Delete the stray `Roomly/` folder at the repo root (abandoned `git init`;
  only `.git` + `.gitattributes`). Confirmed with Rad in kickoff.
- Delete merged local branches `feat/apartments`, `feat/collab-search`.
- `feat/photo-drag-reorder` is unmerged working code — leave it; Rad decides
  its fate separately (listed in Open questions).

## 5. Data model (new)

### 5.1 `places`

`id uuid pk`, `created_at`, `created_by uuid references auth.users` (null for
curated/SQL-seeded rows), `name text not null`, `kind text default 'complex'
check in ('complex','building','house','other')`, `city`, `neighborhood`,
`address`, `rent_min int`, `rent_max int`, `photos text[] default '{}'`,
`website`, `curated boolean default false`, `sponsored boolean default false`
(dormant).

RLS: SELECT for authenticated; INSERT with check
(`auth.uid() = created_by and curated = false and sponsored = false`);
UPDATE using `created_by = auth.uid() and curated = false`, with check
(`curated = false and sponsored = false`). Curated rows are managed via SQL.

### 5.2 `listings.place_id`

`alter table listings add column if not exists place_id uuid references
public.places`. Idempotent backfill: for each listing with null `place_id`,
create a place (`name` = listing title, `kind='other'`, city/neighborhood
copied, `curated=false`) and link it. Column stays nullable for safety; UI
treats null as "no place" (hides people-teaser). `/places/new` (the listing
post form) gains a required place picker: search existing places or create
one inline.

### 5.3 `place_reactions`

`user_id`, `place_id`, `reaction check in ('like','pass')`, `created_at`,
PK (`user_id`,`place_id`). RLS: **own rows only** for all operations —
cross-user visibility exists solely through the RPCs in §6.

`listing_reactions` is kept unchanged in purpose: post-match unit-level
shortlisting on Together (policy fixed per 4.3).

### 5.4 `profiles` additions

- `place_id uuid references public.places` — "where I live" (null = not set).
- `looking_for_roommate boolean default false`.
- `people_visible boolean default true`.

### 5.5 `passes`

Per 4.5.

## 6. People pools — RPC design

Two security-definer functions (`stable`, `set search_path = public`, EXECUTE
to `authenticated`). Both return a profile-shaped row set
(id, full_name, age, city, bio, avatar_url, photos, budget_min/max,
cleanliness, sleep_schedule, smoking, pets, guests, verification_status,
plus `member_group text` = `'seeker' | 'resident'`) so the client reuses the
existing compatibility scorer and `ProfileDetail` unchanged.

### 6.1 `people_for_place(pid uuid)`

Guards: caller authenticated + verified + is *eligible for pid* — has a
`'like'` reaction on it **or** lives there (`profiles.place_id = pid`).
Otherwise returns empty (no error — UI treats as locked).

Returns, excluding the caller, anyone in a blocked pair with the caller,
anyone the caller already liked or passed:
- **seekers:** users with a `'like'` on pid, `verification_status='verified'`,
  `people_visible = true`.
- **residents:** users with `profiles.place_id = pid`,
  `looking_for_roommate = true`, verified. (`looking_for_roommate` is the
  consent for residents; `people_visible` governs seeker-pool visibility only.)

### 6.2 `people_for_area(p_city text, p_neighborhood text)`

Fallback tier: same exclusions/consent rules; guard = caller authenticated +
verified + has a `'like'` on at least one place in the given area. Returns
verified seekers who liked **any** place matching the city (+ neighborhood
when non-null). Used
when a place pool is empty. Tier 3 (city-wide) reuses the existing
client-side Discover query over `profiles` — that read is already permitted
today and stays.

## 7. UX

### 7.1 Navigation & routes

Top nav everywhere: **Places · People · Matches · Profile**.
Renames: `src/app/apartments/*` → `src/app/places/*`; `/discover` →
`/people` with a redirect page left at `/discover`. Landing page copy updated
to pitch the place-first loop (polish phase).

### 7.2 Places

Tabs (`PlacesNav`): **Swipe** (`/places`, default) · **Browse**
(`/places/browse`) · **Saved** (`/places/saved`) · **Together**
(`/places/together`).
- **Swipe:** full-screen deck of places (photo, name, neighborhood, rent
  range, kind), Pass/Like buttons, tap for detail — mirrors the Discover deck
  patterns (`roomly-card-in`, active-press, reduced-motion). Deck order:
  curated first, then newest; excludes already-reacted places. No live
  people-counts on deck cards (perf); counts live on the detail page.
- **Browse:** the grid now lists **places**; the save-heart stays, cards gain
  Like/Pass actions writing `place_reactions`. Card rent = the place's
  `rent_min–rent_max` range, falling back to its cheapest listing's rent.
  Filters become search + max-rent + curated-only + sort; the beds/baths
  filters are dropped at place level (beds/baths remain visible on the unit
  listings inside place detail). Listing-level browsing happens inside the
  place detail page.
- **Place detail** (`/places/[id]`): place info, its unit listings, and a
  people teaser — "N people also want this place →" (count via
  `people_for_place`; shown only once the caller is eligible, else a lock
  line: "Like this place to see who else wants it").
- **Saved / Together:** unchanged behavior (Together partner list fixed per
  4.4; still unit-level reactions).

### 7.3 People (`/people`)

- Locked state (no place likes yet): friendly explainer + CTA to the Swipe
  deck. This *is* the unlock mechanic from the kickoff prompt.
- Unlocked: sections per liked place (most recently liked first): place
  header + person cards — seekers ranked by the existing compatibility score,
  residents badged **"Lives here"** listed first. A person appearing in
  several of the caller's places is deduped into the most recent one.
- Empty pool for a place → inline `people_for_area` fallback row with honest
  copy ("Nobody else has swiped on this place yet — people looking in
  {neighborhood}:"). All pools empty → city-wide fallback = the old Discover
  deck UI with copy ("Here's everyone verified on Roomly for now").
- Tapping a person opens `ProfileDetail` (Pass/Like footer). Like/match/chat
  flow untouched; Pass writes `passes`.

### 7.4 Profile additions & consent

- New "Housing" card on `/profile`: **Where I live** (place search picker,
  clearable), **Looking for a roommate** toggle (only meaningful with a place
  set — disabled until then), **Show me to people who like the same places**
  toggle (`people_visible`).
- First place-like shows a one-time dismissible note (localStorage flag):
  "People who like the same places can see your profile. Turn this off
  anytime in Profile."

### 7.5 Demo mode

`DEMO_PLACES` (~6 places incl. rent ranges), demo reactions in
localStorage, and a scripted demo People pool (2–3 demo people attached to
the demo places, one flagged resident) so the whole loop is walkable before
`schema.sql` is run. Same banner pattern as existing pages.

## 8. Seed (`supabase/seed.sql` + `schema.sql` demo inserts)

- 8–12 real Austin complexes as curated places (real names, realistic rent
  ranges, picsum photos — no scraped content), idempotent by name.
- Link the 3 existing demo listings to matching places.
- Spread place-likes across ~8 seeded users so `sample.maya` sees non-empty
  pools on 2+ places; give 1–2 seeded users `place_id` + `looking_for_roommate`
  so a resident appears.
- ASCII only (lesson from the June seed encoding bug).

## 9. Error handling & edge cases

- Missing tables/RPCs (`isMissingTable`, and PostgREST function-not-found
  `PGRST202`) → demo-mode fallback + "run schema.sql" banner, never a crash.
- RPC returns empty for ineligible callers (no place like) — UI shows locked
  state, not an error.
- Place picker with no results offers "create place" inline.
- Deck exhausted → empty state pointing to Browse and People.
- Unverified users: Places browsing/swiping is allowed (it feeds no one else's
  view until pools), but People pools, likes, and messaging stay
  verified-gated exactly as today; People shows the existing verify-gate.
- A user with `people_visible=false` still sees pools (visibility is about
  being seen, not seeing) — copy in Profile explains this.

## 10. Testing

- Vitest units for new pure logic: pool grouping/dedup, fallback tiering,
  place formatting, deck-order helper (curated-first), consent-flag helper.
- Existing tests keep passing; `npm run build` + lint green before merge.
- Manual RLS matrix (two demo accounts, documented in the plan): self-verify
  attempt via raw update fails; unmatch then re-like solo does NOT re-match
  (both re-like does); unmatched/blocked user cannot read my reactions; block
  in both directions kills messaging; passes persist across reload; place
  reactions are never readable cross-user.

## 11. Implementation constraints

- Branch `feat/v2-apartment-first` off `main`; no push/deploy/live-DB changes
  (Rad pushes via GitHub Desktop and runs SQL himself — give him an exact
  "re-run these" list at the end).
- `supabase/schema.sql` stays a single idempotent file, safe to re-run.
- $0: no paid providers enabled.
- New UI goes through the impeccable skill; follow the existing design system
  (`.roomly-mark/.roomly-btn/.roomly-page`, violet gradient, green verified
  badge exception, reduced-motion gates).
- Keep changes reviewable: subagent-driven tasks with per-task review, as in
  the June rounds.

## 12. Open questions

- ~~Fate of unmerged `feat/photo-drag-reorder`~~ — **Resolved 2026-07-09:**
  Rad chose merge; merged into `feat/v2-apartment-first` (tests/lint/build
  green), branch deleted.
