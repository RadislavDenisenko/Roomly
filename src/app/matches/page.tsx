"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ProfileDetail, type ProfileFull } from "@/components/ProfileDetail";
import { mainPhoto } from "@/lib/photos";

type Profile = ProfileFull;

export default function MatchesPage() {
  // Seed from supabaseConfigured (a stable build-time constant) so we never need a
  // synchronous setLoading(false) in the effect when accounts aren't connected.
  const [loading, setLoading] = useState(supabaseConfigured);
  const [authed, setAuthed] = useState(false);
  const [matches, setMatches] = useState<Profile[]>([]);
  const [detail, setDetail] = useState<Profile | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
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
          .select("*")
          .in("id", mutualIds);
        setMatches((profs ?? []) as Profile[]);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <main className="roomly-page flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="roomly-mark h-8 w-8 text-sm">R</span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Roomly</span>
        </Link>
        <Link href="/discover" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
          Discover
        </Link>
      </header>

      <div className="mx-auto w-full max-w-md flex-1 px-6 pb-16">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Your matches</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          People you both liked. Start a conversation whenever you&apos;re ready.
        </p>

        {loading ? (
          <p className="mt-10 text-center text-sm text-zinc-500">Loading…</p>
        ) : !authed ? (
          <div className="mt-10 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Log in to see your matches.</p>
            <Link href="/login" className="roomly-btn mt-4 h-11 px-6 text-sm">
              Go to log in
            </Link>
          </div>
        ) : matches.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">No matches yet.</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Like people in Discover — when they like you back, they show up here.</p>
            <Link href="/discover" className="roomly-btn mt-6 h-11 px-6 text-sm">
              Go to Discover
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {matches.map((m, i) => (
              <li
                key={m.id}
                style={{ animationDelay: `${i * 60}ms` }}
                className="roomly-card-in flex items-center gap-4 rounded-3xl border border-zinc-200 bg-white/80 p-4 backdrop-blur transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-500/10 dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-violet-900"
              >
                <button
                  type="button"
                  onClick={() => setDetail(m)}
                  className="flex min-w-0 flex-1 items-center gap-4 text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mainPhoto(m)} alt={m.full_name ?? "avatar"} className="h-14 w-14 shrink-0 rounded-full object-cover" />
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
                </button>
                <Link
                  href={`/messages/${m.id}`}
                  className="roomly-btn shrink-0 px-4 py-2 text-sm"
                >
                  Message
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {detail && (
        <ProfileDetail
          profile={detail}
          onClose={() => setDetail(null)}
          footer={
            <Link href={`/messages/${detail.id}`} className="roomly-btn h-12 w-full text-sm">
              Message {detail.full_name?.split(" ")[0] ?? ""}
            </Link>
          }
        />
      )}
    </main>
  );
}
