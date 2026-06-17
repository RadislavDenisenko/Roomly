# Roomly — Verified-only trust gate + reworked connect flow

- **Date:** 2026-06-16
- **Status:** Approved design, ready for implementation plan
- **Branch context:** work currently on `feat/redesign-brush`

## 1. Goal

Make Roomly's matching trustworthy and make a match actually turn into a
conversation. Two locked goals this round:

1. **Verified-only trust gate** — a real identity-verification flow (email +
   phone working for real; gov-ID/selfie as a swappable placeholder), and gate
   discovery + messaging so only verified people can match and talk.
2. **Reworked connect flow** — turn the fragile "two reciprocal like rows"
   into a real match record, and make matches lead to conversation
   (message previews, icebreakers, unmatch/block/report).

The Discover page should feel **fun and informative without too much too
soon** — progressive disclosure, not a data dump.

## 2. Non-goals (explicitly parked)

- Swipe gestures / spring animation polish on Discover (parked by user).
- Deeper matching signals (move-in timing weighting, lease length,
  gender preference, must-have vs nice-to-have) — the existing weighted
  compatibility engine in `src/app/discover/page.tsx` stays as-is this round.
- Real KYC provider integration (Stripe Identity / Persona / Veriff). The
  gov-ID/selfie step is a labeled placeholder now, swappable later.
- Match expiry (Bumble-style countdown). Decided **against** — finding a
  roommate is a slower, higher-stakes decision than a date; a countdown adds
  anxiety without helping. Easy to add later if wanted.

## 3. Key decisions

| Decision | Choice |
|----------|--------|
| Trust level | Identity verification: email + phone + gov-ID/selfie |
| Build approach | Real gate now; paid ID provider swapped in later |
| Email / phone | Real (Supabase auth + OTP) |
| Gov-ID / selfie | Placeholder step (`pending → verified`), provider later |
| Match record | New `matches` table, written by a DB trigger |
| Match expiry | None |
| Discover info density | Progressive disclosure (curated card → full profile on tap) |

## 4. Data model changes (`supabase/schema.sql`)

All changes follow the file's existing idempotent style
(`add column if not exists`, `create table if not exists`,
`drop policy ... / create policy ...`).

### 4.1 `profiles` — verification fields

```sql
alter table public.profiles
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified')),
  add column if not exists id_verified boolean default false,
  add column if not exists verified_at timestamptz;
-- email_verified, phone_verified already exist.
```

`verification_status` is the source of truth used for gating. It is set by the
app as the user completes steps:
- `unverified` — no steps complete.
- `pending` — at least one step started/complete, but not all three.
- `verified` — `email_verified AND phone_verified AND id_verified`; also stamps
  `verified_at = now()`.

### 4.2 `matches` — real match record

```sql
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users on delete cascade,
  user_b uuid not null references auth.users on delete cascade,
  created_at timestamptz default now(),
  status text not null default 'active' check (status in ('active', 'unmatched')),
  last_message_at timestamptz,
  unique (user_a, user_b),
  check (user_a < user_b)            -- ordered pair, one row per pair
);
```

Trigger: when a like becomes reciprocal, create (or re-activate) the match.

```sql
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
```

Trigger: keep `last_message_at` fresh for previews/sorting.

```sql
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
```

RLS on `matches`: a user can see only rows they are part of; updates (unmatch)
allowed only by a participant.

### 4.3 `blocks` and `reports`

```sql
create table if not exists public.blocks (
  blocker_id uuid not null references auth.users on delete cascade,
  blocked_id uuid not null references auth.users on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users on delete cascade,
  reported_id uuid not null references auth.users on delete cascade,
  reason text,
  details text,
  created_at timestamptz default now()
);
```

RLS: users insert/select their own `blocks`; users insert their own `reports`
(no select needed client-side). `reports` feed the existing `/safety` page.

## 5. Gating rules

Enforced in **RLS first** (the real boundary) and mirrored in the UI for a
good experience.

- **Likes** — only a `verified` user may insert a like.
  `likes` insert policy adds:
  `(select verification_status from profiles where id = auth.uid()) = 'verified'`.
- **Messages** — sender and recipient both `verified`, an `active` match exists
  between them, and neither has blocked the other. Replaces the current
  mutual-like check in the `messages` insert policy.
- **Discover (UI)** — only fetch/show profiles where
  `verification_status = 'verified'`. If the current user is not verified, show
  a verify-gate over the deck ("Get verified to start matching") instead of
  cards.
- **Profiles select** — stays viewable to authenticated users (so the Matches
  page and conversation header can render a matched person). Gating happens at
  like/message, not profile read.

## 6. Verification flow

New route `/verify` (App Router page) plus a persistent nudge.

Three-step stepper with live status (done / in-progress / locked):

1. **Email** — real. Reflects Supabase auth email confirmation; set
   `email_verified = true` once confirmed.
2. **Phone** — real OTP via Supabase phone auth; set `phone_verified = true`.
3. **ID + selfie** — upload/capture UI labeled "secure identity check —
   provider coming soon". On submit, move to `pending`, then to `verified`
   (auto-approve placeholder). Sets `id_verified = true`. This is the only stub;
   it is isolated behind one function so a real provider drops in cleanly.

When all three are true: set `verification_status = 'verified'`,
`verified_at = now()`, unlock the badge.

Nudge: unverified users see a "Get verified to start matching" CTA on Discover
(as the gate) and a smaller prompt in their profile/header. Demo/`supabaseConfigured`
fallback paths keep working (treat demo profiles as verified for display).

## 7. Verified badge

Extend `src/components/VerifiedBadge.tsx` to reflect `verification_status`
rather than only `email_verified`:
- `verified` → full green check badge "Verified" (current visual).
- `pending` → muted "Verifying…" state (optional, low priority).
- otherwise → no badge.

Make the badge prominent on Discover cards, Matches list, and conversation
header.

## 8. Connect flow rework

### 8.1 Matches page (`src/app/matches/page.tsx`)
- Read from the `matches` table (status `active`) instead of fetching both like
  lists and intersecting client-side.
- Each row: avatar, name + age, **verified badge**, **last message preview +
  relative time**, and a **"New match"** pill when there are no messages yet.
- Sort by `last_message_at` desc, then `created_at` desc.

### 8.2 Conversation (`src/app/messages/[id]/page.tsx`)
- Empty state shows 2–3 tappable **icebreakers** that prefill the input, e.g.:
  "What's your move-in timeline?", "Early bird or night owl?",
  "Which neighborhoods are you considering?".
- Header gets a kebab menu: **Unmatch**, **Block**, **Report**.
  - Unmatch → set match `status = 'unmatched'`; hide the conversation; messaging
    blocked by RLS.
  - Block → insert into `blocks`; also unmatch; future discovery/messaging
    blocked.
  - Report → modal collects a reason; insert into `reports`; links to `/safety`.
- Keep the existing 3-second polling for now (realtime is out of scope).

## 9. Discover presentation — fun, informative, not too much too soon

Refine the existing card (do **not** add animation/swipe — parked). Card
surface shows only:
- Photo, name + age, city.
- **Prominent verified badge.**
- **One headline match line** (e.g. "82% match — you're both night owls"),
  drawn from the existing `compatibility()` + `reasons()` output (top reason).
- One inviting hook (a single short bio teaser or one personality chip).
- "Tap to see why you match →".

Everything else — all compatibility reasons, all lifestyle chips, full bio,
photo gallery — lives in the full profile (`ProfileDetail`) revealed on tap.
Copy tone is warm and a little playful. This polish is where the `impeccable`
skill is applied during implementation.

## 10. Error handling & edge cases

- Unverified user tries to like/message → RLS rejects; UI prevents it and shows
  the verify nudge (don't surface a raw error).
- Reciprocal like where one side later unmatches → match row exists with
  `status = 'unmatched'`; liking again re-activates it via the trigger's
  `on conflict do update set status = 'active'`.
- Blocked pair → excluded from Discover and messaging; block is one-directional
  in storage but enforced both ways for messaging.
- Demo / accounts-not-connected mode → all current fallbacks keep working;
  demo profiles render as verified so the UI isn't empty.
- Phone OTP not configured in the Supabase project → step shows a clear
  "phone verification not available yet" state rather than failing silently.

## 11. Testing strategy

- **Schema**: re-running `schema.sql` is idempotent (no errors on second run).
- **Trigger**: inserting reciprocal likes creates exactly one `matches` row with
  ordered pair; sending a message updates `last_message_at`.
- **Gating (RLS)**: unverified user cannot insert a like or a message;
  verified, matched, non-blocked users can; blocked pair cannot message.
- **Verification flow**: step transitions set the right booleans and roll up to
  `verification_status`.
- **Pure helpers**: unit-test any extracted pure functions (e.g. verification
  status derivation, match-pair ordering, relative-time formatting).
- **Manual**: walk Discover → like → match → message with two test accounts;
  confirm verify-gate blocks an unverified account.

## 12. Implementation constraints

- Per `AGENTS.md`: this project's Next.js has breaking changes from common
  knowledge. **Read the relevant guide in `node_modules/next/dist/docs/`**
  before writing route/page/handler code.
- Follow existing patterns: `roomly-*` utility classes, fuchsia→violet brand,
  `supabaseConfigured` demo fallback, idempotent SQL.
- Keep new units small and focused (verification logic, match queries,
  icebreakers, badge) so each is understandable and testable on its own.

## 13. Skill usage across phases

- **brainstorming** → this spec (done).
- **writing-plans** → next; converts this into ordered, reviewable steps.
- **impeccable / frontend-design** → during build, for the Discover card and
  verification UI (the "fun, informative, not too much" goal).
- **prompt-master** → only if/when we author an AI prompt (e.g. AI-generated
  icebreakers or ID-check copy). Not required for this round.

## 14. Open questions

- None blocking. Provider choice for real KYC (Stripe Identity vs Persona vs
  Veriff) is deferred to the future round that wires it in.
