import Link from "next/link";
import {
  BuildingsIcon,
  UsersThreeIcon,
  ChatCircleDotsIcon,
  SealCheckIcon,
} from "@phosphor-icons/react/dist/ssr";

// Landing page in the portfolio's design language: bright paper ground, fern
// green leading with brick as the note, mono eyebrows, hairline borders, and
// the matte soft-dark apartment cards standing in for photography.

const STEPS = [
  {
    n: "01",
    icon: BuildingsIcon,
    title: "Match a place",
    body: "Swipe real apartments in your city. No scraped fakes, no bait pricing — like the ones you'd actually live in.",
  },
  {
    n: "02",
    icon: UsersThreeIcon,
    title: "Meet its people",
    body: "Liking a place flips it over: the verified people who want it too, ranked by how well you'd live together.",
  },
  {
    n: "03",
    icon: ChatCircleDotsIcon,
    title: "Move in together",
    body: "Match, chat, then hunt as a pair — a shared shortlist of places you both like, straight from the conversation.",
  },
];

const QUIZ_PREVIEW = [
  { emoji: "🧺", label: "Shared groceries, shared everything" },
  { emoji: "🤝", label: "Ask first and we're totally fine", on: true },
  { emoji: "🏷️", label: "My shelf, your shelf. I've been burned" },
];

export default function Home() {
  return (
    <main className="bg-[#faf7f2] text-stone-900">
      {/* Nav */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="roomly-mark h-9 w-9 text-base">R</span>
          <span className="font-display text-xl font-bold tracking-tight">Roomly</span>
        </div>
        <nav className="flex items-center gap-2 text-sm font-semibold sm:gap-5">
          <Link href="/safety" className="hidden text-stone-500 transition-colors hover:text-stone-900 sm:block">
            How we verify
          </Link>
          <Link href="/login" className="text-stone-500 transition-colors hover:text-stone-900">
            Log in
          </Link>
          <Link href="/signup" className="roomly-btn h-10 px-5 text-sm">
            Sign up free
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-20 pt-10 md:grid-cols-2 md:pt-16">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-brick-600">
            Apartment-first roommate matching
          </p>
          <h1 className="mt-4 max-w-[16ch] font-display text-5xl font-bold leading-[1.02] tracking-tight [text-wrap:balance] sm:text-6xl">
            Find the place.
            <br />
            Meet its <span className="text-emerald-700">people</span>.
          </h1>
          <p className="mt-5 max-w-[46ch] text-lg leading-8 text-stone-600">
            Swipe real apartments; liking one shows you the verified people who
            want it too — matched on the awkward stuff no one asks out loud.
            Fridge rules. Dishes. Sleepovers.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/demo"
              className="inline-flex h-13 items-center justify-center rounded-full bg-emerald-700 px-8 text-base font-bold text-white shadow-md shadow-emerald-900/20 transition-all duration-200 ease-out hover:scale-[1.02] hover:bg-emerald-800 active:scale-95"
            >
              Try the demo
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-13 items-center justify-center rounded-full border-2 border-stone-300 px-8 text-base font-semibold text-stone-800 transition-colors hover:border-stone-400 hover:bg-stone-100"
            >
              Sign up free
            </Link>
          </div>
          <p className="mt-4 text-sm text-stone-500">
            The demo is a 60-second quiz — no account needed.
          </p>
        </div>

        {/* Matte apartment-card stack (pure CSS, portfolio card language) */}
        <div className="relative mx-auto h-[420px] w-full max-w-sm" aria-hidden>
          {/* Brick card peeking from behind */}
          <div className="absolute left-0 top-10 h-72 w-56 -rotate-6 rounded-3xl bg-[linear-gradient(155deg,#6e3028_0%,#4a1f1a_55%,#2a100d_100%)] p-5 shadow-xl shadow-stone-900/15">
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/50">East Austin</p>
            <p className="mt-1 font-display text-lg font-bold text-white/90">East 6th Lofts</p>
            <p className="mt-0.5 text-xs text-white/60">$1,250–2,100/mo</p>
          </div>
          {/* Petrol card */}
          <div className="absolute right-0 top-0 h-72 w-56 rotate-3 rounded-3xl bg-[linear-gradient(155deg,#1c4247_0%,#122b30_55%,#0a1719_100%)] p-5 shadow-xl shadow-stone-900/15">
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/50">Hyde Park</p>
            <p className="mt-1 font-display text-lg font-bold text-white/90">Hyde Park Commons</p>
            <p className="mt-0.5 text-xs text-white/60">$1,100–1,800/mo</p>
          </div>
          {/* Forest card on top */}
          <div className="absolute left-1/2 top-24 h-80 w-64 -translate-x-1/2 rounded-3xl bg-[linear-gradient(155deg,#1a4630_0%,#113322_55%,#081a11_100%)] p-6 shadow-2xl shadow-stone-900/25">
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/50">Triangle State</p>
            <p className="mt-1 font-display text-2xl font-bold text-white">The Triangle</p>
            <p className="mt-1 text-sm text-white/60">$1,300–2,200/mo</p>
            <div className="mt-6 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-sm font-semibold text-white">3 people want this place too</p>
              <p className="mt-0.5 text-xs text-emerald-200">Top match: 92% · Great fit</p>
            </div>
            <p className="mt-4 text-center text-xs font-semibold text-emerald-200">
              Like it → meet them
            </p>
          </div>
        </div>
      </section>

      {/* The journey */}
      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            How Roomly works
          </p>
          <h2 className="mt-3 max-w-[24ch] font-display text-3xl font-bold tracking-tight [text-wrap:balance] sm:text-4xl">
            One direction: place, people, moved in.
          </h2>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-3xl border border-stone-200 bg-[#faf7f2] p-7">
                <div className="flex items-center justify-between">
                  <s.icon size={30} weight="duotone" className="text-emerald-700" aria-hidden />
                  <span className="font-mono text-sm font-bold text-stone-300">{s.n}</span>
                </div>
                <h3 className="mt-4 text-xl font-bold">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-stone-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The awkward questions */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-brick-600">
            The awkward questions
          </p>
          <h2 className="mt-3 max-w-[20ch] font-display text-3xl font-bold tracking-tight [text-wrap:balance] sm:text-4xl">
            The conversations nobody wants to have — answered before you ever meet.
          </h2>
          <p className="mt-4 max-w-[52ch] leading-7 text-stone-600">
            62% of roommates call dirty dishes the single most annoying habit.
            Food goes missing, chores go unfair, sleepovers go unspoken. Roomly
            asks all of it up front — one tap at a time — and only matches you
            with people whose answers actually fit yours.
          </p>
          <Link
            href="/demo"
            className="mt-6 inline-flex h-12 items-center justify-center rounded-full bg-emerald-700 px-7 text-sm font-bold text-white shadow-md shadow-emerald-900/20 transition-all duration-200 ease-out hover:scale-[1.02] hover:bg-emerald-800 active:scale-95"
          >
            Take the 60-second quiz
          </Link>
        </div>
        <div className="mx-auto w-full max-w-sm rounded-3xl border border-stone-200 bg-white p-6 shadow-sm" aria-hidden>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-stone-400">1 of 11</p>
          <p className="mt-2 font-display text-xl font-bold">The fridge. What&apos;s the rule?</p>
          <div className="mt-5 space-y-2.5">
            {QUIZ_PREVIEW.map((o) => (
              <div
                key={o.label}
                className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 text-sm font-medium ${
                  o.on
                    ? "border-emerald-700 bg-emerald-50 text-emerald-900"
                    : "border-stone-200 text-stone-700"
                }`}
              >
                <span className="text-xl">{o.emoji}</span>
                {o.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Verified */}
      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-16 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <div className="flex items-center gap-3">
              <SealCheckIcon size={30} weight="duotone" className="text-emerald-700" aria-hidden />
              <h2 className="font-display text-2xl font-bold tracking-tight">Verified, for free. For everyone.</h2>
            </div>
            <p className="mt-2 leading-7 text-stone-600">
              Every person is identity-verified before they can message you, and
              the database enforces it — not just the interface. The thing other
              apps paywall is the default here.
            </p>
          </div>
          <Link
            href="/safety"
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-full border-2 border-stone-300 px-6 text-sm font-semibold text-stone-800 transition-colors hover:border-stone-400 hover:bg-stone-100"
          >
            How we verify
          </Link>
        </div>
      </section>

      {/* CTA band — the forest card, section-sized */}
      <section className="mx-auto w-full max-w-6xl px-6 py-20">
        <div className="rounded-3xl bg-[linear-gradient(150deg,#1a4630_0%,#123524_55%,#0a1f14_100%)] px-8 py-16 text-center shadow-xl shadow-stone-900/15">
          <h2 className="mx-auto max-w-[20ch] font-display text-3xl font-bold tracking-tight text-white [text-wrap:balance] sm:text-4xl">
            Your people are already looking.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-emerald-100/80">
            Free verification, real listings, and roommates who actually fit how you live.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/demo"
              className="inline-flex h-13 items-center justify-center rounded-full bg-white px-9 text-base font-bold text-emerald-800 shadow-lg transition-transform hover:scale-[1.02] active:scale-95"
            >
              Try the demo
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-13 items-center justify-center rounded-full border-2 border-white/30 px-9 text-base font-semibold text-white transition-colors hover:border-white/60 hover:bg-white/10"
            >
              Sign up free
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-stone-200">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-8 text-sm text-stone-500">
          <div className="flex items-center gap-2">
            <span className="roomly-mark h-6 w-6 rounded-lg text-xs">R</span>
            <span className="font-semibold text-stone-600">Roomly</span>
          </div>
          <div className="flex items-center gap-5 font-medium">
            <Link href="/safety" className="transition-colors hover:text-stone-800">
              How we verify
            </Link>
            <Link href="/login" className="transition-colors hover:text-stone-800">
              Log in
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
