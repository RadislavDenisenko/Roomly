# Roomly — Setup (the one part that needs you)

Almost everything is built and runs locally. To turn on **real accounts, profiles, and saved data**, Roomly needs a free **Supabase** project (it handles logins + the database). Takes ~2 minutes, and only you can do it (it's your account).

## 1. Create a Supabase project
1. Go to https://supabase.com and sign up (free — GitHub or email).
2. Click **New project**.
3. Name it `roomly`, pick a region close to you, and set a **database password** (save it — you won't paste it here).
4. Click **Create new project** and wait ~2 minutes.

## 2. Get your two keys
In your project: **Project Settings → API**, then copy:
- **Project URL** — like `https://abcd1234.supabase.co`
- **anon public** key — a long string under "Project API keys"

✅ These two are safe to share with me — the `anon` key is meant for the browser.
⚠️ Do **not** share the `service_role` key or your database password.

## 3. Add them
Paste both here in chat (I'll add them), or edit `.env.local` and replace the placeholders.

## 4. Create the database tables
In Supabase, open the **SQL Editor**, paste everything from `supabase/schema.sql`, and click **Run**. (I can walk you through this.)

Once the keys are in, sign-up and login will work for real, and I'll wire up profiles next.
