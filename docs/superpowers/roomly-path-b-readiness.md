# Roomly — Path B readiness map (going from demo → real users)

This is the reference for flipping Roomly from the polished free **demo (Path A)**
to a product **real people actually use (Path B)**. Nothing here is built yet —
it's the map of what it would take, what it costs, and what's already done.

## What's already B-ready (server-side trust)

The hard, security-critical parts already exist and are enforced in Postgres
RLS, not just the UI:
- **Verified-only gate:** only `verification_status = 'verified'` users can like
  or message (RLS policies in `supabase/schema.sql`).
- **Connect flow:** `matches` (trigger-created), `blocks`, and `reports` tables
  with RLS; messaging requires an active match and no block, both directions.
- **Identity flow shape:** `/verify` already walks email → phone → ID and writes
  `verification_status`. Only the *providers* are stubbed.

So Path B is mostly swapping stubs for real providers + the non-code work of
getting real users — not rebuilding the app.

## What changes from A → B (and what it costs)

| Change | What to do | Cost |
|---|---|---|
| **Real ID + selfie** | Replace the placeholder in `/verify` step 3 with Stripe Identity or Persona (their SDK/redirect + a webhook that sets `id_verified`). | ~$1.50 per verification |
| **Real phone OTP** | Configure an SMS provider (Twilio) in Supabase Auth; the `/verify` phone step already calls `updateUser({phone})` + `verifyOtp(...)`, so it starts working once SMS is enabled. | Per-text (~$0.0079) + ~$1–2/mo number rental |
| **Custom domain** | Optional: buy `roomly.app`/etc. and point it at Vercel. | ~$12/yr |
| **Vercel plan** | Hobby is free but **non-commercial**. If Roomly becomes commercial, upgrade. | Vercel Pro $20/mo |
| **Supabase plan** | Free tier is fine until you outgrow 500MB DB / 1GB storage / bandwidth. | Supabase Pro $25/mo when needed |
| **Transactional email** | At volume, add a real email sender (Resend/Postmark) for confirmations/notifications. | Free tiers exist; paid at volume |

**Bottom line on cost:** A is $0. B's first real costs are ID checks and SMS —
both pay-per-use, so they scale with usage, not upfront.

## Legal / safety before real users (non-negotiable)

- **Privacy policy + terms of service** (you're collecting personal data + IDs).
- **Moderation:** actually monitor the `reports` table; have a way to suspend/ban.
- **Support contact:** a real email/route for problems.
- **Keep the existing guardrails:** no DIY criminal/background checks, no
  criminal-history filters (FCRA / Fair Housing risk), never paywall safety,
  don't custody money (use Stripe if payments ever happen), don't store raw IDs
  (let the verification vendor hold them).

## The real crux: cold start (this kills most apps like this)

Roomly is a two-sided marketplace. It is **useless** below a critical mass of
real people **in one city/campus at the same time** — roughly **50–100**. A
roommate app with 8 scattered users helps nobody, and they leave.

This is a community/marketing problem, **not** a code problem. The plan:
1. **Pick one beachhead** — a single campus, subreddit, or city Discord. Not
   "a city" in the abstract; a specific community you can reach.
2. **Recruit the first cohort simultaneously** — ~50–100 people in a 1–2 week
   window so early users find matches immediately. Posts, flyers, campus groups,
   word of mouth. Seed it manually if you have to.
3. **Only expand after density holds** in beachhead #1.

If you skip this, every other improvement is wasted — there's nothing to match.

## Suggested order if/when you go for B

1. Recruit beachhead cohort (do this first — validate demand before spending).
2. Turn on real phone OTP (cheap, easy, big trust bump).
3. Add ToS + privacy policy + a moderation/suspend path.
4. Add real ID verification (Stripe Identity / Persona).
5. Custom domain; upgrade Vercel/Supabase only when limits are actually hit.
