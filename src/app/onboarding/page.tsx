"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { LifestyleQuiz, answersToProfileUpdate, type QuizAnswers } from "@/components/LifestyleQuiz";

type Phase = "loading" | "name" | "quiz" | "saving" | "error";

// New-account onboarding: the same awkward-questions quiz the demo uses,
// prefaced by the one thing the demo doesn't need — your name.
export default function OnboardingPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>(supabaseConfigured ? "loading" : "error");
  const [uid, setUid] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [answers, setAnswers] = useState<QuizAnswers>({});

  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = createClient();
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/signup");
        return;
      }
      setUid(data.user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, city")
        .eq("id", data.user.id)
        .single();
      if (profile?.full_name) setName(profile.full_name);
      if (profile?.city) setCity(profile.city);
      setPhase("name");
    })();
  }, [router]);

  async function finish(finalAnswers: QuizAnswers) {
    setAnswers(finalAnswers);
    setPhase("saving");
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: name.trim() || null,
        city: city.trim() || null,
        ...answersToProfileUpdate(finalAnswers),
      })
      .eq("id", uid!);
    if (error) {
      setPhase("error");
      return;
    }
    router.push("/verify");
  }

  if (phase === "loading") {
    return (
      <Shell>
        <p className="m-auto text-sm text-zinc-500">Loading…</p>
      </Shell>
    );
  }

  if (phase === "error") {
    return (
      <Shell>
        <div className="roomly-card-in flex flex-1 flex-col items-center justify-center text-center">
          <span className="text-5xl" aria-hidden>😕</span>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            That didn&apos;t save
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {supabaseConfigured
              ? "Give it a second and try again — your answers are still here."
              : "Accounts aren't connected yet — see SETUP.md."}
          </p>
          {supabaseConfigured && (
            <button type="button" onClick={() => void finish(answers)} className="roomly-btn mt-6 h-12 px-8 text-sm">
              Try again
            </button>
          )}
        </div>
      </Shell>
    );
  }

  if (phase === "saving") {
    return (
      <Shell>
        <div className="roomly-card-in flex flex-1 flex-col items-center justify-center text-center">
          <span className="animate-pulse text-5xl" aria-hidden>🏠</span>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Setting up your profile…
          </h1>
        </div>
      </Shell>
    );
  }

  if (phase === "name") {
    return (
      <Shell>
        <div className="roomly-card-in flex flex-1 flex-col justify-center">
          <span className="roomly-mark h-12 w-12 text-xl">R</span>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Welcome to Roomly.
          </h1>
          <p className="mt-2 text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Two quick things, then the fun part — the awkward roommate questions
            you&apos;ll never have to ask in person.
          </p>
          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) setPhase("quiz");
            }}
          >
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Your name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Rivera"
                required
                autoFocus
                className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none focus:border-brick-500 focus:ring-2 focus:ring-brick-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">City you&apos;re looking in</span>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Austin, TX"
                className="h-12 w-full rounded-xl border border-zinc-300 bg-white px-4 text-base text-zinc-900 outline-none focus:border-brick-500 focus:ring-2 focus:ring-brick-500/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
            <button type="submit" className="roomly-btn h-13 w-full text-base">
              Start the quiz →
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-zinc-400 dark:text-zinc-500">
            11 questions, about a minute. You can change any answer later in your profile.
          </p>
          <Link href="/places" className="mt-6 text-center text-sm font-medium text-zinc-400 underline-offset-2 hover:underline">
            Skip for now
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <LifestyleQuiz onComplete={(a) => void finish(a)} onLeave={() => setPhase("name")} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="roomly-page flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-8">
        {children}
      </div>
    </main>
  );
}
