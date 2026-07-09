# Roomly v2 kickoff prompt (apartment-first matching)

Copy everything below the line and send it as a message to start the build round.

---

We're restarting Roomly and taking it seriously. The core loop changes from people-first to **apartment-first**. Brainstorm → spec → plan → build, with review checkpoints like the last two rounds.

## The new core loop

1. **Places first.** After signup/verify/profile (all existing), the primary action is swiping **places** in your city — like/pass on apartment complexes and listings. This already exists as `listing_reactions` but is buried inside the "Together" page; promote it to the main flow with a proper swipe deck.
2. **People unlock from places.** Once I've liked at least one place, a **People** section appears. For each place I liked, it shows two groups:
   - **Also wants this place** — other verified users who liked the same place, ranked by the existing compatibility score. If the pool is empty, fall back to people who liked places in the same neighborhood, then city-wide, and say so in the UI ("Nobody else has swiped on this place yet — here are people looking nearby").
   - **Lives here, wants a roommate** — verified users who marked this place as where they live and toggled "looking for a roommate."
3. **Matching stays as-is.** Swiping people works like today: mutual like → match → chat → shared shortlist (the Together page now fits naturally as a post-match tool).
4. **Money later.** Sponsored placement for complexes/landlords and ads are the eventual model. Build nothing for it now; just don't design the data model in a way that blocks a `sponsored` flag on places later.

## Locked decisions

- **Match at the building/complex level, not per-unit.** A unit listing belongs to a place (complex/building). People pools form around places — bigger pools, survives unit turnover. Add a `places` table; listings get a `place_id`.
- **Residents self-declare** their place + a "looking for a roommate" toggle on their profile. No proof-of-residency for MVP (add later); the existing identity verification still gates them.
- **Privacy:** being visible in a place's People list requires my consent — one clear opt-in (default on, plain-language copy) covering "people who like the same places can see me." Residents are opt-in by definition (the toggle).
- **Real listings for MVP:** hand-curated directory of real Austin complexes/neighborhoods (name, area, photos, rent range) seeded by us. No scraping (ToS problems), no paid listing APIs yet. Owner-posted listings stay as a second source.
- **Keep the UX simple and pretty** — progressive disclosure like Discover, easy to follow, focused on what the customer needs. Use the impeccable skill on new UI.

## Fix first (from the July 9 2026 code review) — before new features

1. **Self-verification hole:** the `profiles` UPDATE policy lets any user set their own `verification_status='verified'` / `id_verified=true` via the API, which defeats the whole trust gate. Move verification state out of user-writable columns (separate table or trigger that rejects client changes to those columns).
2. **Unmatch isn't durable:** either party can UPDATE `matches.status` back to `'active'`, and `handle_new_like` re-activates an unmatched pair on a delete+re-like. Unmatch should stick unless *both* re-like.
3. **`listing_reactions` SELECT policy uses raw mutual likes** — after an unmatch or block the other person can still read all my apartment reactions. It should require an active match and no block.
4. **Together page derives matches from raw `likes`** instead of the `matches` table — unmatched/blocked people still appear in its match picker.
5. **Discover passes aren't persisted** — passed people reappear on every reload. Store passes (e.g. reuse likes table with a direction/type, or a `passes` table) and filter them out.
6. **Housekeeping:** delete the stray `Roomly/` folder at the repo root (abandoned `git init`, only `.git` + `.gitattributes`); decide fate of the unmerged `feat/photo-drag-reorder` branch; delete merged branches `feat/apartments` and `feat/collab-search`.

## Constraints (same as previous rounds)

- $0 budget: no paid ID/SMS providers, stay on free tiers.
- Work on a branch off `main`; build + lint + test green before merge; no push/deploy/live-DB changes without me (I push via GitHub Desktop).
- Any schema change goes in `supabase/schema.sql`, idempotent, and you tell me exactly what to re-run in the Supabase SQL editor.
- Demo mode must keep working (tables-missing fallback), and the Austin seed should be extended so the new apartment-first flow demos well (seeded users with reactions on seeded places, at least one seeded resident).

Start with brainstorming to settle anything still ambiguous, then spec, then plan. Flag anything above you disagree with instead of silently building it.
