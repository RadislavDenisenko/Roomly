"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { isVerified } from "@/lib/verification";
import { ProfileDetail, type ProfileFull } from "@/components/ProfileDetail";
import { mainPhoto } from "@/lib/photos";
import { relativeTime } from "@/lib/format";

type Profile = ProfileFull;

export default function MatchesPage() {
  // Seed from supabaseConfigured (a stable build-time constant) so we never need a
  // synchronous setLoading(false) in the effect when accounts aren't connected.
  const [loading, setLoading] = useState(supabaseConfigured);
  const [authed, setAuthed] = useState(false);
  const [rows, setRows] = useState<{ profile: Profile; last: { body: string; created_at: string } | null }[]>([]);
  const [detail, setDetail] = useState<Profile | null>(null);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = createClient();
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) { setLoading(false); return; }
      setAuthed(true);
      const uid = userData.user.id;

      const { data: matchRows } = await supabase
        .from("matches")
        .select("user_a, user_b, last_message_at, created_at, status")
        .eq("status", "active");
      const matchData = (matchRows ?? []) as { user_a: string; user_b: string; last_message_at: string | null; created_at: string }[];
      const otherIds = matchData.map((m) => (m.user_a === uid ? m.user_b : m.user_a));

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
          const at = a.last?.created_at ?? matchData.find((r) => r.user_a === a.profile.id || r.user_b === a.profile.id)?.created_at ?? "";
          const bt = b.last?.created_at ?? matchData.find((r) => r.user_a === b.profile.id || r.user_b === b.profile.id)?.created_at ?? "";
          return bt.localeCompare(at);
        });
      setRows(decorated);
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
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/places" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            Places
          </Link>
          <Link href="/people" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            People
          </Link>
        </nav>
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
        ) : rows.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">No matches yet.</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Like people in People — when they like you back, they show up here.</p>
            <Link href="/people" className="roomly-btn mt-6 h-11 px-6 text-sm">
              Go to People
            </Link>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {rows.map(({ profile: m, last }, i) => (
              <li
                key={m.id}
                style={{ animationDelay: `${i * 60}ms` }}
                className="roomly-card-in roomly-tilt flex items-center gap-4 rounded-3xl border border-zinc-200 bg-white/80 p-4 backdrop-blur hover:border-violet-200 hover:shadow-lg hover:shadow-violet-500/10 active:scale-[0.98] dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-violet-900"
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
