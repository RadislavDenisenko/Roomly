# Roomly

**Swipe real apartments. Meet the verified people who want them too.**

Roomly is a trust-first, apartment-first roommate-matching web app. You start by
swiping real places in your city; liking one unlocks the people who liked it too
(and anyone already living there looking for a roommate). Every profile is
verified, matches are ranked on what actually matters (budget, schedule,
cleanliness, lifestyle), and once you match you can chat and hunt for apartments
together. No scammers, no fake listings — the thing other apps make you pay for
is free here.

> **Live demo:** _add your Vercel URL here after deploying_
> Click **"Try the demo"** on the landing page — it drops you straight into a
> populated account (no signup needed).

## Why it's different

Most roommate apps either skip verification or hide it behind a paywall. Roomly
makes **identity verification free and mandatory for everyone**, and enforces it
in the database, not just the UI:

- Only **verified** users appear in discovery, and only verified users can like or message.
- Messaging is gated to an **active mutual match** with no block, enforced by Postgres Row-Level Security.
- Trust signals (verified badge) are front and center everywhere.

## Features

- **Places first** — swipe a curated Austin directory of real apartments/complexes (plus owner-posted listings), browse and filter, save units.
- **People pools** — liking a place unlocks who else wants it: co-seekers ranked by compatibility, and residents who already live there and are looking for a roommate. Empty pools fall back to nearby, then city-wide.
- **Verified-only matching** — a 3-step identity flow (email, phone, ID) and a verified gate over the People pools.
- **Compatibility scoring** — ranked matches with "why you match" reasons (cleanliness, sleep schedule, smoking, pets, guests, budget overlap, city) plus hard dealbreaker filters.
- **Matches & messaging** — real match records, message previews, "new match" prompts, tappable icebreakers, and unmatch / block / report safety actions.
- **Together** — a collaborative shared shortlist for matched roommates hunting for a place as a team.
- **Multi-photo profiles** and a unified fuchsia→violet design system.

## Tech stack

- **Next.js 16** (App Router) · **React 19** · **TypeScript**
- **Tailwind CSS v4**
- **Supabase** — Postgres, Auth, Storage, and Row-Level Security
- **Vitest** for unit tests · deployed on **Vercel**

## Local setup

1. Install deps:
   ```bash
   npm install
   ```
2. Create `.env.local` with your Supabase project values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   ```
3. In the Supabase SQL editor, run **`supabase/schema.sql`** (tables, RLS, triggers),
   then **`supabase/seed.sql`** (a populated Austin demo — verified profiles, matches,
   and a sample chat).
4. Run it:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

### Useful commands

```bash
npm run dev     # dev server
npm run build   # production build
npm run lint    # eslint
npm test        # vitest unit tests
```

### Demo accounts

After running the seed, sample accounts exist as `sample.<name>@roomly.test` with
password `Sample123!`. The landing page's **"Try the demo"** button logs in as one
of them automatically.

## Trust & safety notes

- Identity verification's **gov-ID/selfie step is a labeled placeholder** in this demo;
  it's built to plug in a real provider (Stripe Identity / Persona) later.
- Phone verification uses Supabase OTP and needs an SMS provider configured to send
  real codes (it degrades gracefully otherwise).
- Roomly deliberately does **not** run DIY criminal/background checks or criminal-history
  filters, and never paywalls safety.

## Status & roadmap

This is a polished, deployable demo (Path A). The plan for taking it to real users —
costs, legal prerequisites, and the cold-start strategy — is documented in
[`docs/superpowers/roomly-path-b-readiness.md`](docs/superpowers/roomly-path-b-readiness.md).
