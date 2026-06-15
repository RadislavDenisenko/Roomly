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
  budget_min: number | null;
  budget_max: number | null;
  cleanliness: number | null;
  sleep_schedule: string | null;
  smoking: boolean | null;
  pets: boolean | null;
  guests: string | null;
  email_verified: boolean | null;
};

type MyProfile = Profile & {
  db_nonsmokers_only: boolean | null;
  db_no_pet_owners: boolean | null;
  db_budget_overlap_only: boolean | null;
};

const sleepLabel: Record<string, string> = {
  early_bird: "Early bird",
  night_owl: "Night owl",
  flexible: "Flexible",
};
const cleanLabel = ["", "Relaxed", "Easygoing", "Tidy", "Very tidy", "Spotless"];

function budgetsOverlap(me: Profile, them: Profile) {
  return (
    Math.min(me.budget_max ?? 99999, them.budget_max ?? 99999) >=
    Math.max(me.budget_min ?? 0, them.budget_min ?? 0)
  );
}

function compatibility(me: Profile, them: Profile): number {
  let s = 0;
  s += 25 * (1 - Math.abs((me.cleanliness ?? 3) - (them.cleanliness ?? 3)) / 4);
  if (me.sleep_schedule === them.sleep_schedule) s += 15;
  else if (me.sleep_schedule === "flexible" || them.sleep_schedule === "flexible") s += 7.5;
  if ((me.smoking ?? false) === (them.smoking ?? false)) s += 15;
  s += (me.pets ?? false) === (them.pets ?? false) ? 10 : 4;
  const g = ["rarely", "sometimes", "often"];
  const gi = Math.abs(g.indexOf(me.guests ?? "sometimes") - g.indexOf(them.guests ?? "sometimes"));
  s += 10 * (1 - gi / 2);
  if (budgetsOverlap(me, them)) s += 15;
  if (me.city && them.city && me.city.toLowerCase() === them.city.toLowerCase()) s += 10;
  return Math.max(0, Math.min(100, Math.round(s)));
}

type Reason = { good: boolean; text: string };
function reasons(me: Profile, them: Profile): Reason[] {
  const r: Reason[] = [];
  if (them.sleep_schedule && me.sleep_schedule === them.sleep_schedule)
    r.push({ good: true, text: `Both ${sleepLabel[them.sleep_schedule].toLowerCase()}s` });
  if ((me.smoking ?? false) === (them.smoking ?? false))
    r.push({ good: true, text: them.smoking ? "Both smokers" : "Both non-smokers" });
  else r.push({ good: false, text: them.smoking ? "They smoke, you do not" : "You smoke, they do not" });
  if ((me.pets ?? false) === (them.pets ?? false))
    r.push({ good: true, text: them.pets ? "Both have pets" : "Neither has pets" });
  const cd = Math.abs((me.cleanliness ?? 3) - (them.cleanliness ?? 3));
  if (cd <= 1) r.push({ good: true, text: "Similar tidiness" });
  else
    r.push({
      good: false,
      text: (them.cleanliness ?? 3) > (me.cleanliness ?? 3) ? "They are tidier than you" : "You are tidier than them",
    });
  r.push(
    budgetsOverlap(me, them)
      ? { good: true, text: "Budgets overlap" }
      : { good: false, text: "Budgets do not overlap" },
  );
  return r.slice(0, 4);
}

export default function DiscoverPage() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [cards, setCards] = useState<{ profile: Profile; score: number; why: Reason[] }[]>([]);
  const [index, setIndex] = useState(0);
  const [match, setMatch] = useState<Profile | null>(null);
  const [myId, setMyId] = useState<string | null>(null);

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
      setMyId(uid);

      const { data: meRow } = await supabase.from("profiles").select("*").eq("id", uid).single();
      const me = (meRow ?? { id: uid }) as MyProfile;

      const { data: myLikes } = await supabase.from("likes").select("liked_id").eq("liker_id", uid);
      const liked = new Set((myLikes ?? []).map((l: { liked_id: string }) => l.liked_id));

      const { data: others } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", uid)
        .not("full_name", "is", null);

      const filtered = ((others ?? []) as Profile[]).filter((p) => {
        if (liked.has(p.id)) return false;
        if (me.db_nonsmokers_only && p.smoking) return false;
        if (me.db_no_pet_owners && p.pets) return false;
        if (me.db_budget_overlap_only && !budgetsOverlap(me, p)) return false;
        return true;
      });

      const scored = filtered
        .map((p) => ({ profile: p, score: compatibility(me, p), why: reasons(me, p) }))
        .sort((a, b) => b.score - a.score);
      setCards(scored);
      setLoading(false);
    })();
  }, []);

  async function onLike(them: Profile) {
    if (!myId) return;
    const supabase = createClient();
    await supabase.from("likes").upsert({ liker_id: myId, liked_id: them.id });
    const { data: back } = await supabase
      .from("likes")
      .select("liker_id")
      .eq("liker_id", them.id)
      .eq("liked_id", myId)
      .maybeSingle();
    if (back) setMatch(them);
    else setIndex((i) => i + 1);
  }

  if (loading) return <Centered>Finding your matches…</Centered>;
  if (!supabaseConfigured)
    return <Centered>Accounts aren&apos;t connected yet — see SETUP.md.</Centered>;
  if (!authed)
    return (
      <Centered>
        <p className="text-zinc-600 dark:text-zinc-400">Log in to discover roommates.</p>
        <Link href="/login" className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700">
          Go to log in
        </Link>
      </Centered>
    );

  const current = cards[index];

  return (
    <main className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">R</span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Roomly</span>
        </Link>
        <Link href="/matches" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
          Matches
        </Link>
      </header>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center px-6 pb-16">
        {match && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-3xl bg-emerald-600/95 px-8 text-center text-white backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-100">{"It's a match!"}</p>
            <Avatar name={match.full_name} url={match.avatar_url} large />
            <h2 className="mt-4 text-2xl font-bold">You and {match.full_name} liked each other 🎉</h2>
            <p className="mt-2 max-w-xs text-sm text-emerald-100">Start the conversation from your Matches.</p>
            <Link href="/matches" className="mt-6 flex h-12 w-full max-w-xs items-center justify-center rounded-full bg-white text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
              See your matches
            </Link>
            <button
              onClick={() => {
                setMatch(null);
                setIndex((i) => i + 1);
              }}
              className="mt-3 text-sm font-medium text-emerald-100 underline"
            >
              Keep swiping
            </button>
          </div>
        )}

        {!current ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">No more roommates to show right now.</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Check back soon as more people join.</p>
            <Link href="/matches" className="mt-6 inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700">
              See your matches
            </Link>
          </div>
        ) : (
          <>
            <div className="w-full rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center gap-4">
                <Avatar name={current.profile.full_name} url={current.profile.avatar_url} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-xl font-bold text-zinc-900 dark:text-zinc-50">
                      {current.profile.full_name}
                      {current.profile.age ? `, ${current.profile.age}` : ""}
                    </h2>
                    {current.profile.email_verified && <VerifiedBadge />}
                  </div>
                  {current.profile.city && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{current.profile.city}</p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${scoreColor(current.score)}`}>
                  {current.score}%
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {current.why.map((r, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                      r.good
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                    }`}
                  >
                    {r.good ? "✓" : "⚠"} {r.text}
                  </span>
                ))}
              </div>

              {current.profile.bio && (
                <p className="mt-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300">{current.profile.bio}</p>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {current.profile.budget_min || current.profile.budget_max ? (
                  <Chip>${current.profile.budget_min ?? "?"}–{current.profile.budget_max ?? "?"}/mo</Chip>
                ) : null}
                {current.profile.cleanliness ? <Chip>{cleanLabel[current.profile.cleanliness]}</Chip> : null}
                <Chip>{current.profile.pets ? "🐾 Has pets" : "No pets"}</Chip>
                <Chip>{current.profile.smoking ? "🚬 Smoker" : "Non-smoker"}</Chip>
              </div>
            </div>

            <div className="mt-6 flex w-full gap-4">
              <button
                onClick={() => setIndex((i) => i + 1)}
                className="flex h-14 flex-1 items-center justify-center rounded-full border border-zinc-300 text-base font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Pass
              </button>
              <button
                onClick={() => onLike(current.profile)}
                className="flex h-14 flex-1 items-center justify-center rounded-full bg-emerald-600 text-base font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                Like 💚
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function scoreColor(s: number) {
  if (s >= 70) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
  if (s >= 45) return "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
}

function Avatar({ name, url, large }: { name: string | null; url: string | null; large?: boolean }) {
  const size = large ? "h-20 w-20 text-3xl" : "h-14 w-14 text-xl";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name ?? "avatar"} className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-emerald-500 font-bold text-white`}>
      {(name ?? "?").charAt(0).toUpperCase()}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {children}
    </span>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-sm text-zinc-600 dark:text-zinc-400">{children}</div>
    </main>
  );
}
