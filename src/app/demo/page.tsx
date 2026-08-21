"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { LifestyleQuiz, answersToProfileUpdate, type QuizAnswers } from "@/components/LifestyleQuiz";

// Fallback shared demo account (created by supabase/seed.sql + README setup),
// used only if the per-visitor throwaway signup fails (e.g. rate limits).
const DEMO_EMAIL = "sample.maya@roomly.test";
const DEMO_PASSWORD = "Sample123!";

type Phase = "intro" | "quiz" | "finishing" | "error";

export default function DemoQuizPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [answers, setAnswers] = useState<QuizAnswers>({});

  async function finish(finalAnswers: QuizAnswers) {
    setAnswers(finalAnswers);
    setPhase("finishing");
    if (!supabaseConfigured) {
      setPhase("error");
      return;
    }
    const supabase = createClient();

    // Each visitor gets their own throwaway demo account, so two people
    // demoing at once never overwrite each other's answers. start_demo()
    // (supabase/schema.sql) verifies it, seeds matches, and GCs old ones.
    let userId: string | null = null;
    const { data: signUp, error: signUpError } = await supabase.auth.signUp({
      email: `demo-${crypto.randomUUID().slice(0, 13)}@roomly.test`,
      password: crypto.randomUUID(),
    });
    if (signUpError) {
      console.warn("demo signup failed, falling back to shared account:", signUpError.message);
    } else if (signUp.user && signUp.session) {
      // Persist the fresh session before the RPC — right after signUp the
      // client can still send requests unauthenticated (or as a stale user).
      await supabase.auth.setSession({
        access_token: signUp.session.access_token,
        refresh_token: signUp.session.refresh_token,
      });
      const { error: demoError } = await supabase.rpc("start_demo");
      if (demoError) {
        console.warn("start_demo failed, falling back to shared account:", demoError.message);
      } else {
        userId = signUp.user.id;
      }
    }

    if (!userId) {
      // Fall back to the shared sample account rather than failing the demo.
      const { data, error } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
      if (error || !data.user) {
        setPhase("error");
        return;
      }
      userId = data.user.id;
    }

    // Apply the quiz to the demo profile so pools, scores, and "why you match"
    // reflect what was just answered. Skipped questions stay as seeded.
    const update = answersToProfileUpdate(finalAnswers);
    if (Object.keys(update).length > 0) {
      // Non-fatal: the demo still works on seeded values if this write fails.
      await supabase.from("profiles").update(update).eq("id", userId);
    }
    router.push("/places");
  }

  if (phase === "intro") {
    return (
      <Shell>
        <div className="roomly-card-in flex flex-1 flex-col items-center justify-center text-center">
          <span className="roomly-mark h-14 w-14 text-2xl">R</span>
          <h1 className="mt-6 max-w-sm text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            The 60-second roommate quiz
          </h1>
          <p className="mt-3 max-w-sm text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Fridge rules. Dishes. Sleepovers. Every awkward roommate conversation,
            answered once — so you never have to have them in person.
          </p>
          <button
            type="button"
            onClick={() => setPhase("quiz")}
            className="roomly-btn mt-8 h-13 px-10 text-base"
          >
            Let&apos;s go
          </button>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            No account needed — you&apos;ll land in a live demo.
          </p>
          <Link href="/" className="mt-8 text-sm font-medium text-zinc-400 underline-offset-2 hover:underline">
            ← Back to Roomly
          </Link>
        </div>
      </Shell>
    );
  }

  if (phase === "finishing") {
    return (
      <Shell>
        <div className="roomly-card-in flex flex-1 flex-col items-center justify-center text-center">
          <span className="animate-pulse text-5xl" aria-hidden>🏠</span>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Finding your people…
          </h1>
          <p className="mt-2 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
            Matching your answers against verified people in Austin.
          </p>
        </div>
      </Shell>
    );
  }

  if (phase === "error") {
    return (
      <Shell>
        <div className="roomly-card-in flex flex-1 flex-col items-center justify-center text-center">
          <span className="text-5xl" aria-hidden>😕</span>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            The demo couldn&apos;t start
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            {supabaseConfigured
              ? "We couldn't reach the demo account just now. Give it a few seconds and try again — your answers are saved."
              : "Accounts aren't connected on this install yet — see SETUP.md to finish the Supabase setup."}
          </p>
          {supabaseConfigured && (
            <button
              type="button"
              onClick={() => void finish(answers)}
              className="roomly-btn mt-6 h-12 px-8 text-sm"
            >
              Try again
            </button>
          )}
          <Link href="/" className="mt-4 text-sm font-medium text-zinc-400 underline-offset-2 hover:underline">
            ← Back to Roomly
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <LifestyleQuiz onComplete={(a) => void finish(a)} onLeave={() => setPhase("intro")} />
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
