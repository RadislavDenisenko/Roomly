# Verified-only gate + connect-flow rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Roomly matching verified-only and turn matches into real conversations (match records, message previews, icebreakers, unmatch/block/report).

**Architecture:** Add a `verification_status` to profiles and gate likes + messaging in Postgres RLS (the real boundary), mirrored in the UI. Replace the client-side like-intersect with a real `matches` table written by a DB trigger. Keep the existing weighted compatibility engine and the Supabase demo-fallback pattern untouched.

**Tech Stack:** Next.js 16 (App Router, `src/`), React 19, TypeScript, Tailwind v4, Supabase (auth + Postgres + RLS + storage). New dev dep: Vitest (pure-logic unit tests only).

**Spec:** `docs/superpowers/specs/2026-06-16-roomly-verified-gate-and-connect-flow-design.md`

## Global Constraints

- **Read the docs first.** Per `AGENTS.md`: this project's Next.js has breaking changes from common knowledge. Before writing any route/page code, read the relevant guide in `node_modules/next/dist/docs/`.
- **Brand:** fuchsia→violet gradient. Reuse `roomly-mark`, `roomly-btn`, `roomly-page`, `roomly-card-in`, `roomly-badge` from `globals.css`. Do not re-inline gradients.
- **Verified badge stays GREEN** (deliberate exception, see `VerifiedBadge.tsx`). Do not recolor it to brand violet.
- **Demo fallback:** every page must keep working when `supabaseConfigured` is false or tables are missing. Treat demo profiles as verified so the UI is not empty.
- **SQL is idempotent:** all schema changes use `add column if not exists`, `create table if not exists`, `drop policy if exists` + `create policy`, `create or replace function`, `drop trigger if exists` + `create trigger`. Re-running `supabase/schema.sql` must not error.
- **RLS is the real gate.** UI checks are for UX only; never rely on them for security.
- **No match expiry** (decided against).
- **Motion respects `prefers-reduced-motion`** (already handled by `globals.css` classes).

## Testing approach (read before starting)

This codebase has **no test runner** and is SQL/RLS/React-heavy. We apply tests where they genuinely fit:

- **Pure logic** (Task 1) → real Vitest unit tests (TDD).
- **SQL/RLS** (Tasks 2–3) → verified by construction (idempotent), `npm run build` still passing, plus **documented manual SQL checks** Rad runs in the Supabase SQL editor (he already must run `schema.sql` there).
- **React/UI** (Tasks 4–9) → `npm run build` (typecheck + lint must pass) + a **documented manual walkthrough** with the existing test accounts (`sample.*@roomly.test` / `Sample123!`).

Every task ends with `npm run build` passing. Do not mark a task done if build fails.

---

## Task 1: Pure helper library + Vitest

**Files:**
- Modify: `package.json` (add Vitest dev dep + `test` scripts)
- Create: `src/lib/verification.ts`, `src/lib/verification.test.ts`
- Create: `src/lib/matchUtil.ts`, `src/lib/matchUtil.test.ts`
- Create: `src/lib/format.ts`, `src/lib/format.test.ts`
- Create: `src/lib/icebreakers.ts`, `src/lib/icebreakers.test.ts`

**Interfaces:**
- Produces:
  - `type VerificationStatus = "unverified" | "pending" | "verified"`
  - `deriveVerificationStatus(steps: { email: boolean; phone: boolean; id: boolean }): VerificationStatus`
  - `isVerified(p: { verification_status?: VerificationStatus | null }): boolean`
  - `orderedPair(a: string, b: string): [string, string]`
  - `relativeTime(iso: string | null, now?: Date): string`
  - `ICEBREAKERS: string[]`, `pickIcebreakers(n?: number): string[]`

- [ ] **Step 1: Add Vitest + scripts**

In `package.json`, add to `scripts`:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```
Then install:
```bash
npm install -D vitest@^2
```

- [ ] **Step 2: Write failing tests for verification**

Create `src/lib/verification.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { deriveVerificationStatus, isVerified } from "./verification";

describe("deriveVerificationStatus", () => {
  it("is verified only when all three steps are done", () => {
    expect(deriveVerificationStatus({ email: true, phone: true, id: true })).toBe("verified");
  });
  it("is pending when some but not all steps are done", () => {
    expect(deriveVerificationStatus({ email: true, phone: false, id: false })).toBe("pending");
    expect(deriveVerificationStatus({ email: true, phone: true, id: false })).toBe("pending");
  });
  it("is unverified when no steps are done", () => {
    expect(deriveVerificationStatus({ email: false, phone: false, id: false })).toBe("unverified");
  });
});

describe("isVerified", () => {
  it("true only for verified status", () => {
    expect(isVerified({ verification_status: "verified" })).toBe(true);
    expect(isVerified({ verification_status: "pending" })).toBe(false);
    expect(isVerified({ verification_status: null })).toBe(false);
    expect(isVerified({})).toBe(false);
  });
});
```

- [ ] **Step 3: Run, verify it fails**

Run: `npm test -- verification`
Expected: FAIL (cannot import from `./verification`).

- [ ] **Step 4: Implement verification helper**

Create `src/lib/verification.ts`:
```ts
export type VerificationStatus = "unverified" | "pending" | "verified";

export function deriveVerificationStatus(steps: {
  email: boolean;
  phone: boolean;
  id: boolean;
}): VerificationStatus {
  if (steps.email && steps.phone && steps.id) return "verified";
  if (steps.email || steps.phone || steps.id) return "pending";
  return "unverified";
}

export function isVerified(p: {
  verification_status?: VerificationStatus | null;
}): boolean {
  return p.verification_status === "verified";
}
```

- [ ] **Step 5: Run, verify it passes**

Run: `npm test -- verification`
Expected: PASS.

- [ ] **Step 6: Write failing tests for the remaining helpers**

Create `src/lib/matchUtil.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { orderedPair } from "./matchUtil";

describe("orderedPair", () => {
  it("returns the two ids sorted ascending regardless of input order", () => {
    expect(orderedPair("b", "a")).toEqual(["a", "b"]);
    expect(orderedPair("a", "b")).toEqual(["a", "b"]);
  });
});
```

Create `src/lib/format.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { relativeTime } from "./format";

const now = new Date("2026-06-16T12:00:00Z");

describe("relativeTime", () => {
  it("returns empty string for null", () => {
    expect(relativeTime(null, now)).toBe("");
  });
  it("returns 'just now' under a minute", () => {
    expect(relativeTime("2026-06-16T11:59:30Z", now)).toBe("just now");
  });
  it("returns minutes, hours, days", () => {
    expect(relativeTime("2026-06-16T11:30:00Z", now)).toBe("30m ago");
    expect(relativeTime("2026-06-16T09:00:00Z", now)).toBe("3h ago");
    expect(relativeTime("2026-06-14T12:00:00Z", now)).toBe("2d ago");
  });
});
```

Create `src/lib/icebreakers.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ICEBREAKERS, pickIcebreakers } from "./icebreakers";

describe("pickIcebreakers", () => {
  it("returns 3 by default", () => {
    expect(pickIcebreakers()).toHaveLength(3);
  });
  it("returns the requested count, capped at the list length", () => {
    expect(pickIcebreakers(2)).toHaveLength(2);
    expect(pickIcebreakers(99).length).toBe(ICEBREAKERS.length);
  });
});
```

- [ ] **Step 7: Run, verify all three fail**

Run: `npm test`
Expected: FAIL (missing modules).

- [ ] **Step 8: Implement the three helpers**

Create `src/lib/matchUtil.ts`:
```ts
export function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
```

Create `src/lib/format.ts`:
```ts
export function relativeTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (isNaN(then)) return "";
  const diff = Math.max(0, now.getTime() - then);
  const MIN = 60_000, HR = 3_600_000, DAY = 86_400_000;
  if (diff < MIN) return "just now";
  if (diff < HR) return `${Math.floor(diff / MIN)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HR)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(iso).toLocaleDateString();
}
```

Create `src/lib/icebreakers.ts`:
```ts
export const ICEBREAKERS = [
  "What's your move-in timeline?",
  "Early bird or night owl?",
  "Which neighborhoods are you considering?",
  "What's your ideal monthly budget?",
  "Any dealbreakers I should know about?",
];

export function pickIcebreakers(n = 3): string[] {
  return ICEBREAKERS.slice(0, Math.min(n, ICEBREAKERS.length));
}
```

- [ ] **Step 9: Run all tests + build**

Run: `npm test` → Expected: PASS (all suites).
Run: `npm run build` → Expected: success.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json src/lib/verification.ts src/lib/verification.test.ts src/lib/matchUtil.ts src/lib/matchUtil.test.ts src/lib/format.ts src/lib/format.test.ts src/lib/icebreakers.ts src/lib/icebreakers.test.ts
git commit -m "Add verification/match/format/icebreaker helpers + Vitest

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Verification columns + like gating (schema)

**Files:**
- Modify: `supabase/schema.sql` (after the existing `profiles` alter blocks, ~line 42; and replace the `"Like as yourself"` policy ~line 87–89)

**Interfaces:**
- Produces (DB): `profiles.verification_status`, `profiles.id_verified`, `profiles.verified_at`; a like-insert policy that requires the liker to be verified.

- [ ] **Step 1: Add verification columns**

In `supabase/schema.sql`, after the `photos` alter block (the `add column if not exists photos ...`), add:
```sql
-- Identity verification (email + phone + gov-ID/selfie). Source of truth for gating.
alter table public.profiles
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified')),
  add column if not exists id_verified boolean default false,
  add column if not exists verified_at timestamptz;
```

- [ ] **Step 2: Gate likes to verified users**

Replace the existing `"Like as yourself"` policy block with:
```sql
drop policy if exists "Like as yourself" on public.likes;
create policy "Like as yourself" on public.likes
  for insert with check (
    auth.uid() = liker_id
    and (select verification_status from public.profiles where id = auth.uid()) = 'verified'
  );
```

- [ ] **Step 3: Verify idempotency + build**

Run: `npm run build` → Expected: success (SQL is not compiled, but confirms nothing else broke).
Manual (Rad, in Supabase SQL editor): paste the full `schema.sql` and Run; then **Run it a second time** — Expected: no errors either time.

- [ ] **Step 4: Manual gate check (document for Rad)**

In Supabase SQL editor, with an unverified test user's JWT, attempting `insert into likes ...` must be rejected by RLS; with `verification_status = 'verified'` it succeeds. Record this in the PR description as the manual check performed.

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql
git commit -m "Add profile verification columns + gate likes to verified users

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Matches table, blocks, reports, triggers + message gating (schema)

**Files:**
- Modify: `supabase/schema.sql` (add new tables/triggers after the `messages` block; replace the `"Message your matches"` policy ~line 111–117)

**Interfaces:**
- Produces (DB): `matches(user_a,user_b,status,last_message_at,created_at)`, `blocks`, `reports`; trigger `on_like_created` (creates/reactivates a match on reciprocal like); trigger `on_message_sent` (touches `last_message_at`); message-insert policy requiring both verified + active match + not blocked.

- [ ] **Step 1: Create the matches table + RLS**

In `supabase/schema.sql`, after the `messages` policies, add:
```sql
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
create policy "Update own matches" on public.matches
  for update using (auth.uid() = user_a or auth.uid() = user_b);
```

- [ ] **Step 2: Trigger — create/reactivate a match on reciprocal like**

Add:
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

- [ ] **Step 3: Trigger — touch last_message_at on new message**

Add:
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

- [ ] **Step 4: Blocks + reports tables + RLS**

Add:
```sql
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
```

- [ ] **Step 5: Replace messaging gate (verified + active match + not blocked)**

Replace the existing `"Message your matches"` policy block with:
```sql
drop policy if exists "Message your matches" on public.messages;
drop policy if exists "Message your active matches" on public.messages;
create policy "Message your active matches" on public.messages
  for insert with check (
    auth.uid() = sender_id
    and (select verification_status from public.profiles where id = auth.uid()) = 'verified'
    and (select verification_status from public.profiles where id = recipient_id) = 'verified'
    and exists (
      select 1 from public.matches m
      where m.status = 'active'
        and m.user_a = least(auth.uid(), recipient_id)
        and m.user_b = greatest(auth.uid(), recipient_id)
    )
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = recipient_id and b.blocked_id = auth.uid())
         or (b.blocker_id = auth.uid() and b.blocked_id = recipient_id)
    )
  );
```

- [ ] **Step 6: Backfill matches from existing reciprocal likes**

Add (idempotent — `on conflict do nothing`):
```sql
-- Backfill matches for pairs that already liked each other before the trigger existed.
insert into public.matches (user_a, user_b)
select least(l1.liker_id, l1.liked_id), greatest(l1.liker_id, l1.liked_id)
from public.likes l1
join public.likes l2 on l2.liker_id = l1.liked_id and l2.liked_id = l1.liker_id
on conflict (user_a, user_b) do nothing;
```

- [ ] **Step 7: Verify idempotency + build**

Run: `npm run build` → Expected: success.
Manual (Rad): run full `schema.sql` twice in Supabase — Expected: no errors. Then verify Maya↔Priya (the seeded mutual match) now have exactly one row in `matches`.

- [ ] **Step 8: Commit**

```bash
git add supabase/schema.sql
git commit -m "Add matches/blocks/reports + triggers and gate messaging to verified active matches

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Verified badge reflects verification_status everywhere

**Files:**
- Modify: `src/components/VerifiedBadge.tsx`
- Modify: `src/components/ProfileDetail.tsx:7-24` (add field to `ProfileFull`) and `:152` (badge condition)
- Modify: `src/app/discover/page.tsx:10-26` (add field to `Profile`) and `:239` (badge condition)

**Interfaces:**
- Consumes: `isVerified`, `VerificationStatus` from `@/lib/verification` (Task 1).
- Produces: `VerifiedBadge` accepts optional `status?: "verified" | "pending"`; all profile types carry `verification_status?: VerificationStatus | null`.

- [ ] **Step 1: Extend VerifiedBadge with an optional pending state**

Replace the body of `src/components/VerifiedBadge.tsx` with:
```tsx
export function VerifiedBadge({
  label = "Verified",
  status = "verified",
}: {
  label?: string;
  status?: "verified" | "pending";
}) {
  if (status === "pending") {
    return (
      <span className="roomly-badge inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-600/20 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-400/25">
        Verifying…
      </span>
    );
  }
  return (
    <span className="roomly-badge inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-950/50 dark:text-green-300 dark:ring-green-400/25">
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
        <circle cx="10" cy="10" r="9" className="fill-green-600 dark:fill-green-400" />
        <path d="M8.6 13.4 5.2 10l1.3-1.3 2.1 2.1 4.9-4.9L14.8 7.2z" className="fill-white dark:fill-green-950" />
      </svg>
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Add `verification_status` to `ProfileFull`**

In `src/components/ProfileDetail.tsx`, add the import and the field. After line 5 imports add:
```tsx
import type { VerificationStatus } from "@/lib/verification";
import { isVerified } from "@/lib/verification";
```
In the `ProfileFull` type, replace `email_verified: boolean | null;` with:
```tsx
  email_verified: boolean | null;
  verification_status?: VerificationStatus | null;
```
Change the badge at line 152 from `{profile.email_verified && <VerifiedBadge />}` to:
```tsx
{isVerified(profile) && <VerifiedBadge />}
```

- [ ] **Step 3: Add `verification_status` to discover's `Profile` + badge**

In `src/app/discover/page.tsx`, add to the imports:
```tsx
import { isVerified, type VerificationStatus } from "@/lib/verification";
```
In the `Profile` type, replace `email_verified: boolean | null;` with:
```tsx
  email_verified: boolean | null;
  verification_status?: VerificationStatus | null;
```
Change the badge at line 239 from `{current.profile.email_verified && <VerifiedBadge />}` to:
```tsx
{isVerified(current.profile) && <VerifiedBadge />}
```

- [ ] **Step 4: Update Matches badge condition**

In `src/app/matches/page.tsx`, add `import { isVerified } from "@/lib/verification";` and change line 111 from `{m.email_verified && <VerifiedBadge />}` to `{isVerified(m) && <VerifiedBadge />}`. (`ProfileFull` already includes the new field via Task 4 Step 2.)

- [ ] **Step 5: Build + manual**

Run: `npm run build` → Expected: success (no type errors).
Manual: with demo fallback, confirm badges still render for demo profiles (Task 7 marks demo profiles verified; until then they may not show — that's expected and fixed in Task 7).

- [ ] **Step 6: Commit**

```bash
git add src/components/VerifiedBadge.tsx src/components/ProfileDetail.tsx src/app/discover/page.tsx src/app/matches/page.tsx
git commit -m "Badge + profile types reflect verification_status

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `/verify` page — 3-step identity stepper

**Files:**
- Create: `src/app/verify/page.tsx`

**Interfaces:**
- Consumes: `deriveVerificationStatus` from `@/lib/verification`; `createClient`, `supabaseConfigured` from `@/lib/supabase/client`.
- Produces: a page that writes `email_verified`, `phone_verified`, `id_verified`, `verification_status`, `verified_at` to the current user's `profiles` row.

- [ ] **Step 1: Read the Next.js docs**

Read the App Router page/client-component guidance in `node_modules/next/dist/docs/` (routing + client components) before writing the route. Confirm the `"use client"` + `app/<route>/page.tsx` convention this project uses (see existing `src/app/discover/page.tsx`).

- [ ] **Step 2: Create the verify page**

Create `src/app/verify/page.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { deriveVerificationStatus } from "@/lib/verification";

type Steps = { email: boolean; phone: boolean; id: boolean };

export default function VerifyPage() {
  const [loading, setLoading] = useState(supabaseConfigured);
  const [authed, setAuthed] = useState(false);
  const [steps, setSteps] = useState<Steps>({ email: false, phone: false, id: false });
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [phoneSent, setPhoneSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { setLoading(false); return; }
      setAuthed(true);
      const { data: p } = await supabase.from("profiles").select("email_verified, phone_verified, id_verified").eq("id", data.user.id).single();
      setSteps({
        email: !!data.user.email_confirmed_at || !!p?.email_verified,
        phone: !!p?.phone_verified,
        id: !!p?.id_verified,
      });
      setLoading(false);
    })();
  }, []);

  async function persist(next: Steps) {
    setSteps(next);
    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const status = deriveVerificationStatus(next);
    await supabase.from("profiles").upsert({
      id: data.user.id,
      email_verified: next.email,
      phone_verified: next.phone,
      id_verified: next.id,
      verification_status: status,
      verified_at: status === "verified" ? new Date().toISOString() : null,
    });
  }

  async function sendPhoneCode() {
    setBusy(true); setNote(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ phone });
    setBusy(false);
    if (error) { setNote("Phone verification isn't enabled on this project yet — add an SMS provider in Supabase to turn it on."); return; }
    setPhoneSent(true);
  }

  async function confirmPhoneCode() {
    setBusy(true); setNote(null);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: "phone_change" });
    setBusy(false);
    if (error) { setNote("That code didn't match. Try again."); return; }
    await persist({ ...steps, phone: true });
  }

  async function completeId() {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 600)); // placeholder for a real provider check
    await persist({ ...steps, id: true });
    setBusy(false);
  }

  if (loading) return <Centered>Loading…</Centered>;
  if (!supabaseConfigured) return <Centered>Accounts aren&apos;t connected yet — see SETUP.md.</Centered>;
  if (!authed) return (
    <Centered>
      <p className="text-zinc-600 dark:text-zinc-400">Log in to verify your identity.</p>
      <Link href="/login" className="roomly-btn mt-4 h-11 px-6 text-sm">Go to log in</Link>
    </Centered>
  );

  const status = deriveVerificationStatus(steps);

  return (
    <main className="roomly-page flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="roomly-mark h-8 w-8 text-sm">R</span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Roomly</span>
        </Link>
        <Link href="/discover" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">Discover</Link>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 px-6 pb-16">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Get verified</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Roomly is verified-only. Finish all three steps to start matching and messaging.
        </p>

        <div className="mt-6 space-y-3">
          <StepCard n={1} title="Email" done={steps.email}>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {steps.email ? "Your email is confirmed." : "Confirm your email from the link we sent at sign-up, then refresh."}
            </p>
          </StepCard>

          <StepCard n={2} title="Phone" done={steps.phone}>
            {steps.phone ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Phone verified.</p>
            ) : !phoneSent ? (
              <div className="flex gap-2">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" className="h-11 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
                <button type="button" disabled={busy || !phone} onClick={sendPhoneCode} className="roomly-btn h-11 px-4 text-sm">Send code</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" className="h-11 flex-1 rounded-lg border border-zinc-300 bg-white px-3 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
                <button type="button" disabled={busy || !code} onClick={confirmPhoneCode} className="roomly-btn h-11 px-4 text-sm">Confirm</button>
              </div>
            )}
          </StepCard>

          <StepCard n={3} title="Photo ID + selfie" done={steps.id}>
            {steps.id ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Identity confirmed.</p>
            ) : (
              <>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Secure identity check — provider coming soon. For now this completes instantly.</p>
                <button type="button" disabled={busy} onClick={completeId} className="roomly-btn mt-3 h-11 px-4 text-sm">Run identity check</button>
              </>
            )}
          </StepCard>
        </div>

        {note && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{note}</p>}

        {status === "verified" && (
          <div className="mt-6 rounded-2xl bg-green-50 px-4 py-4 text-center dark:bg-green-950/40">
            <p className="font-semibold text-green-700 dark:text-green-300">You&apos;re verified! 🎉</p>
            <Link href="/discover" className="roomly-btn mt-3 inline-flex h-11 items-center px-6 text-sm">Start matching</Link>
          </div>
        )}
      </div>
    </main>
  );
}

function StepCard({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-zinc-200 bg-white/80 p-5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="mb-2 flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-green-600 text-white" : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"}`}>
          {done ? "✓" : n}
        </span>
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="roomly-page flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-sm text-zinc-600 dark:text-zinc-400">{children}</div>
    </main>
  );
}
```

- [ ] **Step 3: Build + manual**

Run: `npm run build` → Expected: success.
Manual: log in as a test account, visit `/verify`, run the ID step (and email; phone shows the "not enabled" note unless SMS is configured) and confirm `verification_status` flips to `verified` in the DB.

- [ ] **Step 4: Commit**

```bash
git add src/app/verify/page.tsx
git commit -m "Add /verify identity stepper (email, phone OTP, ID placeholder)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Verification status card on the profile page

**Files:**
- Modify: `src/app/profile/page.tsx` (the `verified` state + the `{verified && ...}` block at lines 53, 70, 254–258)

**Interfaces:**
- Consumes: `verification_status` from the loaded profile.
- Produces: a status card linking to `/verify`.

- [ ] **Step 1: Load verification_status into state**

In `src/app/profile/page.tsx`, replace the `const [verified, setVerified] = useState(false);` line with:
```tsx
  const [vStatus, setVStatus] = useState<"unverified" | "pending" | "verified">("unverified");
```
In the effect, replace `setVerified(!!data.user.email_confirmed_at);` with a read of the profile (move it below the profile fetch). After the `const { data: profile } = ...single();` line, add:
```tsx
      setVStatus((profile?.verification_status as "unverified" | "pending" | "verified") ?? "unverified");
```

- [ ] **Step 2: Replace the email-verified badge block with a status card**

Replace the block at lines 254–258 (`{verified && (...VerifiedBadge label="Email verified".../>)}`) with:
```tsx
        <Link
          href="/verify"
          className="mt-5 flex items-center justify-between rounded-2xl border border-zinc-200 bg-white/80 px-5 py-4 backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-md hover:shadow-violet-500/10 dark:border-zinc-800 dark:bg-zinc-900/80"
        >
          <span className="flex items-center gap-3">
            <span aria-hidden="true" className="text-xl">{vStatus === "verified" ? "✅" : "🛡️"}</span>
            <span>
              <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {vStatus === "verified" ? "You're verified" : "Get verified"}
              </span>
              <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                {vStatus === "verified" ? "You can match and message." : "Required to match and message on Roomly."}
              </span>
            </span>
          </span>
          <span aria-hidden="true" className="text-violet-600 dark:text-violet-400">→</span>
        </Link>
```

- [ ] **Step 3: Build + manual**

Run: `npm run build` → Expected: success (the `VerifiedBadge` import becomes unused — remove it from the import line at the top of the file to avoid a lint error).
Manual: profile page shows "Get verified" → links to `/verify`; after verifying, shows "You're verified".

- [ ] **Step 4: Commit**

```bash
git add src/app/profile/page.tsx
git commit -m "Show verification status + link to /verify on profile

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Discover — verified-only gate + progressive-disclosure card

**Files:**
- Modify: `src/app/discover/page.tsx` (effect fetch/filter ~99–138; the card JSX ~218–281)

**Interfaces:**
- Consumes: `isVerified` (Task 1/4); `blocks` table (Task 3).
- Produces: Discover only shows verified, non-blocked profiles; unverified viewer sees a verify-gate; the card surfaces one headline reason + a hook, details behind the tap.

- [ ] **Step 1: Track my verification + fetch blocks; filter the deck**

In the effect, after `const me = (meRow ?? { id: uid }) as MyProfile;` add:
```tsx
      const meVerified = me.verification_status === "verified";

      const { data: blockRows } = await supabase
        .from("blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);
      const blocked = new Set(
        (blockRows ?? []).map((b: { blocker_id: string; blocked_id: string }) =>
          b.blocker_id === uid ? b.blocked_id : b.blocker_id,
        ),
      );
```
Add `meVerified` to component state: near the other `useState` calls add `const [meVerified, setMeVerified] = useState(false);` and set it in the effect with `setMeVerified(meVerified);` right after computing it.

In the `filtered` filter callback, add at the top of the predicate:
```tsx
        if (!isVerified(p)) return false;
        if (blocked.has(p.id)) return false;
```

- [ ] **Step 2: Add a headline helper**

Near the other top-level helpers in the file, add:
```tsx
function headline(score: number, why: Reason[]): string {
  const top = why.find((r) => r.good);
  return top ? top.text : `${score}% match`;
}
```

- [ ] **Step 3: Gate the unverified viewer**

In the render, right after the `const current = cards[index];` line, add an early gate inside the returned JSX. Replace the opening of the deck container (the `<div className="relative mx-auto ...">` block) so that when `!meVerified` it shows the gate instead of cards:
```tsx
        {!meVerified ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <span className="text-4xl" aria-hidden="true">🛡️</span>
            <p className="mt-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Get verified to start matching</p>
            <p className="mt-2 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">Roomly only shows you verified people — and only verified people see you. It takes a minute.</p>
            <Link href="/verify" className="roomly-btn mt-6 h-11 px-6 text-sm">Verify my identity</Link>
          </div>
        ) : !current ? (
```
(Keep the existing `!current` branch and the matched/cards branches that follow; this adds the `!meVerified` branch in front of them. Ensure the ternary chain and closing braces stay balanced.)

- [ ] **Step 4: Slim the card to progressive disclosure**

Replace the card inner content (the block from the `<div className="flex items-center gap-4">` identity row through the closing of the chips `<div>` and the "Tap to view full profile" paragraph, ~231–280) with:
```tsx
              <div className="flex items-center gap-4">
                <Avatar name={current.profile.full_name} url={mainPhoto(current.profile)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-xl font-bold text-zinc-900 dark:text-zinc-50">
                      {current.profile.full_name}
                      {current.profile.age ? `, ${current.profile.age}` : ""}
                    </h2>
                    {isVerified(current.profile) && <VerifiedBadge />}
                  </div>
                  {current.profile.city && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{current.profile.city}</p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${scoreColor(current.score)}`}>
                  {current.score}%
                </span>
              </div>

              <p className="mt-4 text-base font-medium text-zinc-800 dark:text-zinc-200">
                ✨ {headline(current.score, current.why)}
              </p>

              {current.profile.bio && (
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {current.profile.bio}
                </p>
              )}

              <p className="mt-4 text-center text-xs font-medium text-violet-600 dark:text-violet-400">
                Tap to see why you match →
              </p>
```

- [ ] **Step 5: Treat demo profiles as verified**

The demo path (`!supabaseConfigured`) and any demo profiles must render. If the file has a demo-profiles constant used in Discover, set `verification_status: "verified"` on each; if Discover has no demo profiles (it requires auth), no change is needed — confirm by reading the file. Document which applies.

- [ ] **Step 6: Build + manual**

Run: `npm run build` → Expected: success.
Manual: unverified account sees the gate; verified account sees only verified people; card shows one headline + bio teaser; tapping opens the full profile with all reasons/chips.

- [ ] **Step 7: Commit**

```bash
git add src/app/discover/page.tsx
git commit -m "Gate Discover to verified-only + slim card to progressive disclosure

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Matches page — read matches table + previews + new-match pill

**Files:**
- Modify: `src/app/matches/page.tsx` (effect ~20–48; row JSX ~92–123)

**Interfaces:**
- Consumes: `matches` table (Task 3), `messages` table; `relativeTime` (Task 1); `isVerified` (Task 4).
- Produces: matches list backed by the `matches` table with last-message preview, relative time, and a "New match" pill.

- [ ] **Step 1: Load matches + last messages**

Replace the effect body (the IIFE inside `useEffect`) with:
```tsx
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setLoading(false); return; }
      setAuthed(true);
      const uid = userData.user.id;

      const { data: matchRows } = await supabase
        .from("matches")
        .select("user_a, user_b, last_message_at, created_at, status")
        .eq("status", "active");
      const rows = (matchRows ?? []) as { user_a: string; user_b: string; last_message_at: string | null; created_at: string }[];
      const otherIds = rows.map((m) => (m.user_a === uid ? m.user_b : m.user_a));

      if (otherIds.length === 0) { setLoading(false); return; }

      const { data: profs } = await supabase.from("profiles").select("*").in("id", otherIds);
      const { data: msgs } = await supabase
        .from("messages")
        .select("sender_id, recipient_id, body, created_at")
        .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
        .order("created_at", { ascending: false });

      const lastByOther = new Map<string, { body: string; created_at: string }>();
      for (const m of (msgs ?? []) as { sender_id: string; recipient_id: string; body: string; created_at: string }[]) {
        const other = m.sender_id === uid ? m.recipient_id : m.sender_id;
        if (!lastByOther.has(other)) lastByOther.set(other, { body: m.body, created_at: m.created_at });
      }

      const decorated = ((profs ?? []) as Profile[])
        .map((p) => ({ profile: p, last: lastByOther.get(p.id) ?? null }))
        .sort((a, b) => {
          const at = a.last?.created_at ?? rows.find((r) => r.user_a === a.profile.id || r.user_b === a.profile.id)?.created_at ?? "";
          const bt = b.last?.created_at ?? rows.find((r) => r.user_a === b.profile.id || r.user_b === b.profile.id)?.created_at ?? "";
          return bt.localeCompare(at);
        });
      setRows(decorated);
      setLoading(false);
```
Change the matches state to hold the decorated shape. Replace `const [matches, setMatches] = useState<Profile[]>([]);` with:
```tsx
  const [rows, setRows] = useState<{ profile: Profile; last: { body: string; created_at: string } | null }[]>([]);
```
Add the import: `import { relativeTime } from "@/lib/format";`.

- [ ] **Step 2: Update the empty/list conditions + row markup**

Change `matches.length === 0` to `rows.length === 0`. Replace the `<ul>` list body (the `{matches.map(...)}`) with:
```tsx
          <ul className="mt-6 space-y-3">
            {rows.map(({ profile: m, last }, i) => (
              <li
                key={m.id}
                style={{ animationDelay: `${i * 60}ms` }}
                className="roomly-card-in flex items-center gap-4 rounded-3xl border border-zinc-200 bg-white/80 p-4 backdrop-blur transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-500/10 dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-violet-900"
              >
                <button type="button" onClick={() => setDetail(m)} className="flex min-w-0 flex-1 items-center gap-4 text-left">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mainPhoto(m)} alt={m.full_name ?? "avatar"} className="h-14 w-14 shrink-0 rounded-full object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
                        {m.full_name}{m.age ? `, ${m.age}` : ""}
                      </p>
                      {isVerified(m) && <VerifiedBadge />}
                    </div>
                    {last ? (
                      <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                        {last.body} · <span className="text-zinc-400">{relativeTime(last.created_at)}</span>
                      </p>
                    ) : (
                      <span className="mt-0.5 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">New match</span>
                    )}
                  </div>
                </button>
                <Link href={`/messages/${m.id}`} className="roomly-btn shrink-0 px-4 py-2 text-sm">Message</Link>
              </li>
            ))}
          </ul>
```

- [ ] **Step 3: Build + manual**

Run: `npm run build` → Expected: success.
Manual: a brand-new match shows "New match"; after a message, the row shows the preview + relative time and sorts to the top.

- [ ] **Step 4: Commit**

```bash
git add src/app/matches/page.tsx
git commit -m "Back Matches with matches table + previews and new-match pill

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Conversation — icebreakers + unmatch/block/report

**Files:**
- Modify: `src/app/messages/[id]/page.tsx` (empty state ~131–134; header ~113–128; add a menu + actions)

**Interfaces:**
- Consumes: `pickIcebreakers` (Task 1); `orderedPair` (Task 1); `matches`/`blocks`/`reports` tables (Task 3).
- Produces: tappable icebreakers in empty chats; a header menu with Unmatch, Block, Report.

- [ ] **Step 1: Imports + state**

Add imports:
```tsx
import { useRouter } from "next/navigation";
import { pickIcebreakers } from "@/lib/icebreakers";
import { orderedPair } from "@/lib/matchUtil";
```
Add to component state:
```tsx
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reportReason, setReportReason] = useState("");
```

- [ ] **Step 2: Action handlers**

Add inside the component (above the `if (loading)` returns):
```tsx
  async function unmatch() {
    if (!me) return;
    const supabase = createClient();
    const [a, b] = orderedPair(me, otherId);
    await supabase.from("matches").update({ status: "unmatched" }).eq("user_a", a).eq("user_b", b);
    router.push("/matches");
  }

  async function block() {
    if (!me) return;
    const supabase = createClient();
    await supabase.from("blocks").insert({ blocker_id: me, blocked_id: otherId });
    const [a, b] = orderedPair(me, otherId);
    await supabase.from("matches").update({ status: "unmatched" }).eq("user_a", a).eq("user_b", b);
    router.push("/matches");
  }

  async function submitReport() {
    if (!me) return;
    const supabase = createClient();
    await supabase.from("reports").insert({ reporter_id: me, reported_id: otherId, reason: reportReason || "unspecified" });
    setReporting(false);
    setMenuOpen(false);
  }
```

- [ ] **Step 3: Header menu**

In the header, after the `<span>{other?.full_name ...}</span>`, add a kebab menu on the right:
```tsx
        <div className="relative ml-auto">
          <button type="button" aria-label="Conversation options" onClick={() => setMenuOpen((o) => !o)} className="px-2 text-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">⋯</button>
          {menuOpen && (
            <div className="absolute right-0 top-9 z-20 w-40 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <button type="button" onClick={unmatch} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">Unmatch</button>
              <button type="button" onClick={block} className="block w-full px-4 py-2.5 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800">Block</button>
              <button type="button" onClick={() => { setReporting(true); setMenuOpen(false); }} className="block w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">Report</button>
            </div>
          )}
        </div>
```

- [ ] **Step 4: Icebreakers in the empty state**

Replace the empty-state paragraph (the `{messages.length === 0 ? (<p>Say hi...</p>) : (...)}`) so the empty branch is:
```tsx
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-zinc-400">Break the ice 👋</p>
            <div className="flex flex-col gap-2">
              {pickIcebreakers(3).map((q) => (
                <button key={q} type="button" onClick={() => setText(q)} className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300">{q}</button>
              ))}
            </div>
          </div>
```

- [ ] **Step 5: Report modal (normal-flow overlay)**

Before the closing `</main>`, add:
```tsx
      {reporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={() => setReporting(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 dark:bg-zinc-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">Report {other?.full_name ?? "this person"}</h3>
            <textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} rows={3} placeholder="What's going on?" className="mt-3 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100" />
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setReporting(false)} className="h-10 flex-1 rounded-full border border-zinc-300 text-sm font-semibold dark:border-zinc-700">Cancel</button>
              <button type="button" onClick={submitReport} className="roomly-btn h-10 flex-1 text-sm">Send report</button>
            </div>
            <p className="mt-3 text-center text-xs text-zinc-400">See our <Link href="/safety" className="underline">safety guidelines</Link>.</p>
          </div>
        </div>
      )}
```

- [ ] **Step 6: Build + manual**

Run: `npm run build` → Expected: success.
Manual (two test accounts): empty chat shows icebreakers that prefill the box; Unmatch returns to `/matches` and blocks further messaging (RLS); Report writes a row to `reports`.

- [ ] **Step 7: Commit**

```bash
git add src/app/messages/[id]/page.tsx
git commit -m "Add icebreakers + unmatch/block/report to conversations

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-review (completed during planning)

- **Spec coverage:** verification fields (T2), matches/blocks/reports + triggers (T3), like gate (T2), message gate (T3), Discover UI gate (T7), verify flow (T5) + profile nudge (T6), verified badge (T4), matches page (T8), conversation icebreakers + unmatch/block/report (T9), Discover progressive disclosure (T7), pure helpers + tests (T1). All spec sections map to a task.
- **Placeholders:** the only intentional "placeholder" is the gov-ID step (a real, scoped design decision with working stub code in T5), not an unfilled plan gap.
- **Type consistency:** `VerificationStatus`, `isVerified`, `deriveVerificationStatus`, `orderedPair`, `relativeTime`, `pickIcebreakers`, `headline` are defined in T1/T4/T7 and consumed with matching signatures in T5–T9.
- **Known follow-ups (out of scope, noted):** real KYC + SMS providers; swipe/animation polish; deeper matching signals.
