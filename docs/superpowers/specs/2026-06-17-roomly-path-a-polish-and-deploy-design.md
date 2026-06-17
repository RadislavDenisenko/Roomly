# Roomly — Path A: polished, deployed, free demo (with a B-readiness map)

- **Date:** 2026-06-17
- **Status:** Approved design (pending user review of this spec)
- **Branch:** `main` (work will happen on a new feature branch)

## 1. Goal

Turn Roomly from a locally-running MVP into a **polished, publicly deployed,
$0 demo** that anyone (a recruiter, a friend, future-Rad) can open via a real
URL and immediately experience the core loop — verify → discover → match →
message — against a believable, populated app. Plus a written map of exactly
what it would take and cost to flip to **Path B** (real users) later.

This is a learning/portfolio outcome. It deliberately avoids the cold-start
problem, paid services, and legal overhead until/unless Path B is chosen.

## 2. Non-goals (parked)

- The immersive 3D "paper-pull" hero look.
- Swipe gestures / animation polish.
- Deeper matching signals (move-in timing weighting, etc.).
- Real KYC provider (gov-ID/selfie stays a labeled placeholder).
- Real SMS provider for phone OTP (stays graceful-degrade).
- Acquiring real users (that's Path B).

## 3. Key decisions

| Decision | Choice |
|----------|--------|
| Path | A now (polished + deployed + free); B mapped, not built |
| Demo access | Both: one-tap demo login AND rich seed data |
| Market density | One city (Austin, TX — already the seed city) so it feels real |
| Hosting | Vercel Hobby (free) + Supabase free tier = $0 |
| Cost guardrail | Never enable paid ID checks or paid SMS (the only things that cost money) |

## 4. Component 1 — Demo experience

### 4.1 One-tap demo login
- A **"Try the demo"** button on the landing page (`/`) and the login page
  (`/login`).
- It signs the visitor into a fixed, pre-seeded **demo account** via
  `supabase.auth.signInWithPassword` with a known demo credential, then routes
  to `/discover`.
- The demo account is a verified, populated profile in the seed city with
  existing matches and a clean sample conversation, so the visitor lands in a
  live-feeling app.
- Tradeoff (accepted): the demo account is shared, so visitors share its state
  and can leave junk. Acceptable for low-traffic portfolio use; state is reset
  by re-running the seed. (Per-visitor throwaway accounts are explicitly out of
  scope for now.)
- The demo credential living in client code is acceptable because it only
  unlocks a disposable demo account.

### 4.2 Rich seed data (one city)
- A reproducible SQL seed (e.g. `supabase/seed.sql`, runnable in the Supabase
  SQL editor) that creates **~12–20 believable profiles**, all
  `verification_status = 'verified'`, in **one city (Austin, TX)**, each with
  name, age, bio, lifestyle answers, budget, and deterministic stock photos
  (the existing `lib/photos.ts` randomuser.me + picsum approach).
- A handful of **listings** beyond the current 3 demo listings.
- A few **pre-made matches** for the demo account plus **one clean sample
  conversation**, so Matches and Messaging look alive.
- The seed must create the backing `auth.users` rows the `profiles` foreign key
  requires (the implementation plan resolves the exact Supabase-safe SQL for
  this — it is the main technical wrinkle of this component).
- The seed is idempotent / safe to re-run (also serves as the demo reset).

## 5. Component 2 — Deploy live (free)

- Push the repo to a **free GitHub repo**, connect it to a **Vercel** project
  (Hobby/free), deploy → live `*.vercel.app` URL.
- Set Supabase env vars in Vercel: `NEXT_PUBLIC_SUPABASE_URL` and the
  publishable/anon key (same values as `.env.local`).
- In Supabase Auth settings, add the Vercel URL as an allowed Site URL /
  redirect URL so login works in production.
- Confirm `next build` passes for the production build (it does today).
- **Cost: $0.** Vercel Hobby is free for non-commercial use; Supabase free tier
  (500MB DB, 1GB storage, ample auth MAU) covers a demo comfortably. The free
  `*.vercel.app` subdomain avoids even a domain cost.
- Prerequisite: a GitHub account and a Vercel account (user has both). If a step
  fails for account reasons, that's the fallback to handle.

## 6. Component 3 — Polish pass (scoped)

Targeted fixes only — not an open-ended redesign:
- **Landing page (`/`):** clearly state in one line what Roomly is, lead with
  the verified/trust hook, and make the **"Try the demo"** button the primary
  CTA. Reassess the existing animated landing scene — keep if it helps the
  pitch, simplify if it distracts.
- **`/verify`:** clearly label the gov-ID step as a demo placeholder so it reads
  as intentional, not broken.
- **Data cleanup:** finish removing offensive/test message text (scoped delete).
- **Click-through sweep:** walk the core loop (demo login → discover → like →
  match → message; and verify, profile, apartments) and fix any obvious errors
  or broken states surfaced.

## 7. Component 4 — "What Path B would take" map (written deliverable)

A short doc (`docs/superpowers/roomly-path-b-readiness.md`) listing what flipping
to real users requires and costs:
- Real ID verification: Stripe Identity or Persona (~$1.50/check) replacing the
  placeholder.
- Real phone OTP: an SMS provider (Twilio) wired into Supabase (per-text cost +
  number rental).
- Optional custom domain (~$12/yr).
- Vercel Pro ($20/mo) only if usage becomes commercial.
- Privacy policy + terms; basic moderation/abuse handling; support channel.
- The non-code crux: **cold-start** — pick one campus/city and recruit the first
  ~50–100 real people simultaneously; the app is useless below that density.

## 8. Verification / testing

- Local: demo-login button signs into the demo account and lands on a populated
  `/discover`; a fresh real signup also sees the seeded population.
- `npm run build` and `npm run lint` pass; `npm test` (existing 10 unit tests)
  passes.
- Browser walk-through of the core loop with no console/runtime errors.
- After deploy: the live URL loads, demo login works in production, and auth
  redirects succeed.
- Seed SQL re-runs without error (idempotent) and resets demo state.

## 9. Implementation constraints

- Per `AGENTS.md`: read the relevant guide in `node_modules/next/dist/docs/`
  before route/config changes.
- Keep the existing patterns: `roomly-*` classes, fuchsia→violet brand,
  `supabaseConfigured` demo fallback, idempotent SQL.
- Do not enable any paid service. Gov-ID and SMS remain placeholders.

## 10. Open questions

- Exact count/personas for seed profiles (decide during the plan; ~15 is the
  target).
- Whether to keep or simplify the current animated landing scene (decide when
  polishing the landing, based on whether it helps the pitch).
