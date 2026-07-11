# Deploying Roomly to Vercel (free)

Everything is pre-staged. This is a ~5-minute, $0 deploy. Do the steps in order.

## 0. Status (already done)
- Code is on GitHub: `https://github.com/RadislavDenisenko/Roomly` (branch `main`).
- `supabase/schema.sql` and `supabase/seed.sql` have been run against the live DB.
- App is verified working locally (demo login → populated discover/matches, no errors).

## After pulling this release (Supabase SQL editor)
This release adds the apartment-first core loop (places, People pools, durable
unmatch, etc). Before deploying it, paste + run these two files against the live
DB, in order — both are idempotent, safe to re-run:
1. `supabase/schema.sql` (tables, RLS, RPCs, triggers).
2. `supabase/seed.sql` (curated Austin places, demo place-likes, residents).

## 1. One-line cleanup (Supabase SQL editor)
The seeded sample message stored a mangled dash. Paste + Run this once to fix it:
```sql
update public.messages
set body = 'Hey! Saw we matched and your place sounds great. When are you hoping to move in?'
where body like 'Hey! Saw we matched%';
```

## 2. Import the repo into Vercel (browser)
1. Go to **https://vercel.com/new**.
2. Import the GitHub repo **RadislavDenisenko/Roomly** (connect GitHub if asked).
3. Vercel auto-detects **Next.js** — leave build settings as-is.
4. Expand **Environment Variables** and add these two (values from your `.env.local`):
   | Name | Value |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://pqgwwotaywbjexdnirug.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | _(the anon key from your `.env.local`)_ |
5. Click **Deploy**. **Stay on the Hobby (free) plan — do not add a payment method.**
6. When it finishes, copy the live URL (looks like `https://roomly-xxxx.vercel.app`).

## 3. Point Supabase auth at the live URL (browser)
Login won't work in production until you do this:
1. Supabase dashboard → **Authentication** → **URL Configuration**.
2. Set **Site URL** to your `https://...vercel.app` URL.
3. Add the same URL under **Redirect URLs**. Save.

## 4. Verify live
1. Open the `.vercel.app` URL.
2. Click **"Try the demo"** → you should land on a populated Places swipe deck.
3. Check Matches + open a chat. No errors = done. 🎉

## 5. After it's live
- Put the live URL into `README.md` (the "Live demo" line) and into the GitHub repo's "About" → Website field.
- Optional later: a custom domain, real ID/SMS providers — see
  `docs/superpowers/roomly-path-b-readiness.md`.
