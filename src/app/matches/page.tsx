"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { VerifiedBadge } from "@/components/VerifiedBadge";

type Profile = {
  id: string;
  full_name: string | null;
  age: number | null;
  city: string | null;
  bio: string | null;
  avatar_url: string | null;
  email_verified: boolean | null;
};

export default function MatchesPage() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [matches, setMatches] = useState<Profile[]>([]);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoading(false);
        return;
      }
      setAuthed(true);
      const uid = userData.user.id;

      const { data: sent } = await supabase.from("likes").select("liked_id").eq("liker_id", uid);
      const { data: received } = await supabase.from("likes").select("liker_id").eq("liked_id", uid);
      const sentSet = new Set((sent ?? []).map((l: { liked_id: string }) => l.liked_id));
      const mutualIds = (received ?? [])
        .map((l: { liker_id: string }) => l.liker_id)
        .filter((id: string) => sentSet.has(id));

      if (mutualIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, age, city, bio, avatar_url, email_verified")
          .in("id", mutualIds);
        setMatches((profs ?? []) as Profile[]);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <main className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">R</span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Roomly</span>
        </Link>
        <Link href="/discover" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
          Discover
        </Link>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 px-6 pb-16">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Your matches</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          People you both liked. Messaging is coming next — for now, here is who you clicked with.
        </p>

        {loading ? (
          <p className="mt-10 text-center text-sm text-zinc-500">Loading…</p>
        ) : !authed ? (
          <div className="mt-10 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Log in to see your matches.</p>
            <Link href="/login" className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700">
              Go to log in
            </Link>
          </div>
        ) : matches.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">No matches yet.</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Like people in Discover — when they like you back, they show up here.</p>
            <Link href="/discover" className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700">
              Go to Discover
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {matches.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                {m.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatar_url} alt={m.full_name ?? "avatar"} className="h-14 w-14 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-xl font-bold text-white">
                    {(m.full_name ?? "?").charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
                      {m.full_name}
                      {m.age ? `, ${m.age}` : ""}
                    </p>
                    {m.email_verified && <VerifiedBadge />}
                  </div>
                  {m.city && <p className="text-sm text-zinc-500 dark:text-zinc-400">{m.city}</p>}
                </div>
                <button
                  disabled
                  className="shrink-0 rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
                >
                  Message
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
