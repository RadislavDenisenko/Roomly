"use client";

import { useEffect, useRef, useState } from "react";

type Option = { value: string | number | boolean; emoji: string; label: string };
type Question = {
  key: string; // profiles column, or "budget" (expands to budget_min/max)
  title: string;
  sub?: string;
  options: Option[];
};

// One awkward conversation per screen. Order is momentum-first: easy identity
// questions open, the kitchen cluster lands mid-quiz, dealbreakers close.
export const QUESTIONS: Question[] = [
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

export type QuizAnswers = Record<string, string | number | boolean>;

// Quiz answers -> profiles-table columns ("budget" expands to min/max).
export function answersToProfileUpdate(answers: QuizAnswers): QuizAnswers {
  const { budget, ...profileFields } = answers;
  const update: QuizAnswers = { ...profileFields };
  if (typeof budget === "string") {
    const [min, max] = budget.split("-").map(Number);
    update.budget_min = min;
    update.budget_max = max;
  }
  return update;
}

/**
 * The awkward-questions quiz, one screen at a time. Owns only the questions;
 * the host page owns what happens before (intro) and after (onComplete).
 */
export function LifestyleQuiz({
  onComplete,
  onLeave,
}: {
  onComplete: (answers: QuizAnswers) => void;
  // Called when Back is pressed on the first question (omit to hide Back there).
  onLeave?: () => void;
}) {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null); // option index mid-flash
  const [answers, setAnswers] = useState<QuizAnswers>({});
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
    if (step === 0) onLeave?.();
    else setStep((s) => s - 1);
  }

  function advance(finalAnswers: QuizAnswers) {
    if (step < QUESTIONS.length - 1) setStep(step + 1);
    else onComplete(finalAnswers);
  }

  const answered = Object.keys(answers).length;

  return (
    <>
      {/* Top bar: back, progress, skip */}
      <div className="flex items-center gap-4">
        {(step > 0 || onLeave) && (
          <button
            type="button"
            onClick={back}
            aria-label="Back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ←
          </button>
        )}
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
    </>
  );
}
