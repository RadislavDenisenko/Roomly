"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

// Fallback shared demo account (created by supabase/seed.sql + README setup),
// used only if the per-visitor throwaway signup fails (e.g. rate limits).
const DEMO_EMAIL = "sample.maya@roomly.test";
const DEMO_PASSWORD = "Sample123!";

type Option = { value: string | number | boolean; emoji: string; label: string };
type Question = {
  key: string; // profiles column, or "budget" (expands to budget_min/max)
  title: string;
  sub?: string;
  options: Option[];
};

// One awkward conversation per screen. Order is momentum-first: easy identity
// questions open, the kitchen cluster lands mid-quiz, dealbreakers close.
const QUESTIONS: Question[] = [
  {
    key: "sleep_schedule",
    title: "It's Saturday, 8 a.m. Where are you?",
    options: [
      { value: "early_bird", emoji: "☀️", label: "Already up — mornings are mine" },
      { value: "night_owl", emoji: "😴", label: "Asleep. 8 a.m. is basically midnight" },
      { value: "flexible", emoji: "🎲", label: "Different every week" },
    ],
  },
  {
    key: "weekend_style",
    title: "Friday night, ideal version:",
    options: [
      { value: "out", emoji: "🪩", label: "Out out. Home at 3" },
      { value: "host", emoji: "🍕", label: "A few people over at ours" },
      { value: "home", emoji: "🛋️", label: "Couch, snacks, something good on" },
      { value: "depends", emoji: "📅", label: "Depends what week it's been" },
    ],
  },
  {
    key: "home_noise",
    title: "You're home, music's on. How?",
    options: [
      { value: "speakers", emoji: "🔊", label: "Speakers — the place has a soundtrack" },
      { value: "headphones", emoji: "🎧", label: "Headphones, mostly" },
      { value: "quiet", emoji: "🤫", label: "What music? I live for quiet" },
    ],
  },
  {
    key: "food_sharing",
    title: "The fridge. What's the rule?",
    sub: "The conversation nobody wants to have in person.",
    options: [
      { value: "share", emoji: "🧺", label: "Shared groceries, shared everything" },
      { value: "ask", emoji: "🤝", label: "Ask first and we're totally fine" },
      { value: "separate", emoji: "🏷️", label: "My shelf, your shelf. I've been burned" },
    ],
  },
  {
    key: "dishes",
    title: "A dirty pan lands in the sink. Its life expectancy?",
    options: [
      { value: "now", emoji: "⚡", label: "Zero minutes. Wash as you go" },
      { value: "same_day", emoji: "🌙", label: "Gone by the end of the day" },
      { value: "soaking", emoji: "🫧", label: "It's “soaking” — don't judge" },
      { value: "eventually", emoji: "♾️", label: "Until someone cracks" },
    ],
  },
  {
    key: "chores",
    title: "Trash is full. In your ideal home:",
    options: [
      { value: "rota", emoji: "📋", label: "We have a chore schedule that works" },
      { value: "whoever", emoji: "👀", label: "Whoever notices it, handles it" },
      { value: "cleaner", emoji: "🧹", label: "We split a cleaner" },
      { value: "eventually", emoji: "🐢", label: "It gets done… eventually" },
    ],
  },
  {
    key: "cleanliness",
    title: "Be honest. Your place usually looks:",
    options: [
      { value: 5, emoji: "✨", label: "Guest-ready, always" },
      { value: 4, emoji: "🧼", label: "Tidy most days" },
      { value: 3, emoji: "🙂", label: "Lived-in but clean" },
      { value: 2, emoji: "🌪️", label: "Creative chaos — I know where everything is" },
    ],
  },
  {
    key: "overnight_guests",
    title: "Partners and sleepovers at your place:",
    options: [
      { value: "never", emoji: "🚪", label: "Rarely — home is my bubble" },
      { value: "weekends", emoji: "📆", label: "Weekends? Sure" },
      { value: "often", emoji: "🔁", label: "A few nights a week is normal" },
      { value: "partner", emoji: "💞", label: "My partner's here a lot" },
    ],
  },
  {
    key: "pets",
    title: "Furry roommates?",
    options: [
      { value: true, emoji: "🐾", label: "Yes — mine's moving in too" },
      { value: false, emoji: "🥰", label: "None, but I love them" },
      { value: false, emoji: "🙅", label: "None, and I prefer it that way" },
    ],
  },
  {
    key: "smoking",
    title: "Smoking or vaping?",
    options: [
      { value: false, emoji: "🚭", label: "Nope" },
      { value: true, emoji: "🌬️", label: "Sometimes, outside only" },
      { value: true, emoji: "🚬", label: "Yes" },
    ],
  },
  {
    key: "budget",
    title: "Last one — your monthly rent zone?",
    options: [
      { value: "500-800", emoji: "💵", label: "Under $800" },
      { value: "800-1200", emoji: "💰", label: "$800 – $1,200" },
      { value: "1200-1600", emoji: "🏦", label: "$1,200 – $1,600" },
      { value: "1600-2400", emoji: "💎", label: "$1,600+" },
    ],
  },
];

type Phase = "intro" | "quiz" | "finishing" | "error";

export default function DemoQuizPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null); // option index mid-flash
  const [answers, setAnswers] = useState<Record<string, string | number | boolean>>({});
  const [chosenIdx, setChosenIdx] = useState<Record<string, number>>({});
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const q = QUESTIONS[step];

  function choose(optionIndex: number) {
    if (picked !== null) return; // ignore double-taps during the flash
    setPicked(optionIndex);
    const next = { ...answers, [q.key]: q.options[optionIndex].value };
    setAnswers(next);
    setChosenIdx((m) => ({ ...m, [q.key]: optionIndex }));
    timer.current = window.setTimeout(() => {
      setPicked(null);
      advance(next);
    }, 220);
  }

  function skip() {
    const next = { ...answers };
    delete next[q.key];
    setAnswers(next);
    setChosenIdx((m) => {
      const copy = { ...m };
      delete copy[q.key];
      return copy;
    });
    advance(next);
  }

  function back() {
    if (step === 0) setPhase("intro");
    else setStep((s) => s - 1);
  }

  function advance(finalAnswers: Record<string, string | number | boolean>) {
    if (step < QUESTIONS.length - 1) setStep(step + 1);
    else void finish(finalAnswers);
  }

  async function finish(finalAnswers: Record<string, string | number | boolean>) {
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
    const { budget, ...profileFields } = finalAnswers;
    const update: Record<string, string | number | boolean> = { ...profileFields };
    if (typeof budget === "string") {
      const [min, max] = budget.split("-").map(Number);
      update.budget_min = min;
      update.budget_max = max;
    }
    if (Object.keys(update).length > 0) {
      // Non-fatal: the demo still works on seeded values if this write fails.
      await supabase.from("profiles").update(update).eq("id", userId);
    }
    router.push("/places");
  }

  const answered = Object.keys(answers).length;

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
      {/* Top bar: back, progress, skip */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={back}
          aria-label="Back"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ←
        </button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-brick-600 transition-all duration-300"
            style={{ width: `${(step / QUESTIONS.length) * 100}%` }}
          />
        </div>
        <button
          type="button"
          onClick={skip}
          className="shrink-0 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          Skip
        </button>
      </div>

      {/* keyed so each question re-runs the card-in animation */}
      <div key={step} className="roomly-card-in mt-10 flex flex-1 flex-col">
        <p className="text-sm font-semibold uppercase tracking-widest text-brick-600 dark:text-brick-400">
          {step + 1} of {QUESTIONS.length}
        </p>
        <h1 className="mt-2 text-2xl font-bold leading-snug tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
          {q.title}
        </h1>
        {q.sub && <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{q.sub}</p>}

        <div className="mt-8 space-y-3">
          {q.options.map((opt, i) => {
            const isPicked = picked === i || (picked === null && chosenIdx[q.key] === i);
            return (
              <button
                key={`${q.key}-${i}`}
                type="button"
                onClick={() => choose(i)}
                className={`flex w-full items-center gap-4 rounded-2xl border-2 px-5 py-4 text-left text-base font-medium transition-all duration-150 active:scale-[0.98] ${
                  isPicked
                    ? "border-brick-600 bg-brick-50 text-brick-800 dark:bg-brick-950 dark:text-brick-100"
                    : "border-zinc-200 bg-white/80 text-zinc-800 hover:border-brick-300 hover:bg-brick-50/40 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-100 dark:hover:border-brick-700"
                }`}
              >
                <span className="text-2xl" aria-hidden>{opt.emoji}</span>
                {opt.label}
              </button>
            );
          })}
        </div>

        <p className="mt-auto pt-8 text-center text-xs text-zinc-400 dark:text-zinc-500">
          {answered} answered · your answers power who you match with
        </p>
      </div>
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
