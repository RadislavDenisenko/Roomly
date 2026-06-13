"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

type Profile = {
  id: string;
  full_name: string | null;
  age: number | null;
  city: string | null;
  bio: string | null;
  budget_min: number | null;
  budget_max: number | null;
  cleanliness: number | null;
  sleep_schedule: string | null;
  smoking: boolean | null;
  pets: boolean | null;
  guests: string | null;
};

function compatibility(me: Profile, them: Profile): number {
  let score = 0;
  score += 25 * (1 - Math.abs((me.cleanliness ?? 3) - (them.cleanliness ?? 3)) / 4);
  if (me.sleep_schedule === them.sleep_schedule) score += 15;
  else if (me.sleep_schedule === "flexible" || them.sleep_schedule === "flexible")
    score += 7.5;
  if ((me.smoking ?? false) === (them.smoking ?? false)) score += 15;
  score += (me.pets ?? false) === (them.pets ?? false) ? 10 : 4;
  const g = ["rarely", "sometimes", "often"];
  const gi = Math.abs(
    g.indexOf(me.guests ?? "sometimes") - g.indexOf(them.guests ?? "sometimes"),
  );
  score += 10 * (1 - gi / 2);
  const overlap =
    Math.min(me.budget_max ?? 99999, them.budget_max ?? 99999) >=
    Math.max(me.budget_min ?? 0, them.budget_min ?? 0);
  if (overlap) score += 15;
  if (me.city && them.city && me.city.toLowerCase() === them.city.toLowerCase())
    score += 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}

const sleepLabel: Record<string, string> = {
  early_bird: "Early bird",
  night_owl: "Night owl",
  flexible: "Flexible",
};
const cleanLabel = ["", "Relaxed", "Easygoing", "Tidy", "Very tidy", "Spotless"];

export default function DiscoverPage() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [cards, setCards] = useState<{ profile: Profile; score: number }[]>([]);
  const [index, setIndex] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

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
      const myId = userData.user.id;
      const { data: me } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", myId)
        .single();
      const { data: others } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", myId)
        .not("full_name", "is", null);
      const meSafe = (me ?? { id: myId }) as Profile;
      const scored = ((others ?? []) as Profile[])
        .map((p) => ({ profile: p, score: compatibility(meSafe, p) }))
        .sort((a, b) => b.score - a.score);
      setCards(scored);
      setLoading(false);
    })();
  }, []);

  function advance(like: boolean, name: string | null) {
    if (like) {
      setToast(`You liked ${name ?? "them"} 💚`);
      window.setTimeout(() => setToast(null), 1500);
    }
    setIndex((i) => i + 1);
  }

  if (loading) return <Centered>Finding your matches…</Centered>;
  if (!supabaseConfigured)
    return <Centered>Accounts aren&apos;t connected yet — see SETUP.md.</Centered>;
  if (!authed)
    return (
      <Centered>
        <p className="text-zinc-600 dark:text-zinc-400">
          Log in to discover roommates.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          Go to log in
        </Link>
      </Centered>
    );

  const current = cards[index];

  return (
    <main className="flex flex-1 flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">
            R
          </span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Roomly
          </span>
        </Link>
        <Link
          href="/profile"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          My profile
        </Link>
      </header>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center px-6 pb-16">
        {toast && (
          <div className="absolute top-2 z-10 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg">
            {toast}
          </div>
        )}

        {!current ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              No more roommates to show right now.
            </p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Check back soon as more people join.
            </p>
            <Link
              href="/profile"
              className="mt-6 inline-flex h-11 items-center justify-center rounded-full border border-zinc-300 px-6 text-sm font-semibold text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              Back to my profile
            </Link>
          </div>
        ) : (
          <>
            <div className="w-full rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {current.profile.full_name}
                    {current.profile.age ? `, ${current.profile.age}` : ""}
                  </h2>
                  {current.profile.city && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {current.profile.city}
                    </p>
                  )}
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-sm font-bold ${scoreColor(
                    current.score,
                  )}`}
                >
                  {current.score}% match
                </span>
              </div>

              {current.profile.bio && (
                <p className="mt-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                  {current.profile.bio}
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                {current.profile.budget_min || current.profile.budget_max ? (
                  <Chip>
                    ${current.profile.budget_min ?? "?"}–
                    {current.profile.budget_max ?? "?"}/mo
                  </Chip>
                ) : null}
                {current.profile.cleanliness ? (
                  <Chip>{cleanLabel[current.profile.cleanliness]}</Chip>
                ) : null}
                {current.profile.sleep_schedule ? (
                  <Chip>{sleepLabel[current.profile.sleep_schedule]}</Chip>
                ) : null}
                <Chip>{current.profile.pets ? "🐾 Has pets" : "No pets"}</Chip>
                <Chip>{current.profile.smoking ? "🚬 Smoker" : "Non-smoker"}</Chip>
                {current.profile.guests ? (
                  <Chip>Guests: {current.profile.guests}</Chip>
                ) : null}
              </div>
            </div>

            <div className="mt-6 flex w-full gap-4">
              <button
                onClick={() => advance(false, current.profile.full_name)}
                className="flex h-14 flex-1 items-center justify-center rounded-full border border-zinc-300 text-base font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Pass
              </button>
              <button
                onClick={() => advance(true, current.profile.full_name)}
                className="flex h-14 flex-1 items-center justify-center rounded-full bg-emerald-600 text-base font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                Like 💚
              </button>
            </div>

            <p className="mt-4 text-xs text-zinc-400">
              {cards.length - index} {cards.length - index === 1 ? "person" : "people"} left
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function scoreColor(s: number) {
  if (s >= 70)
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300";
  if (s >= 45)
    return "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300";
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
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
