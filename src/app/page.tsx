import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col bg-white dark:bg-zinc-950">
      {/* Top bar */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">
            R
          </span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Roomly
          </span>
        </div>
        <nav className="flex items-center gap-3 text-sm font-medium">
          <Link
            href="/safety"
            className="hidden text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 sm:block"
          >
            How we verify
          </Link>
          <Link
            href="/login"
            className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-zinc-900 px-4 py-2 text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Get started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-400">
          <CheckIcon />
          Every profile verified — free, for everyone
        </span>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl">
          Find a roommate you can{" "}
          <span className="text-emerald-600">trust</span>.
          <br className="hidden sm:block" /> Then find a place — together.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Match with verified roommates near you, then swipe, save, and tour
          apartments side by side. No scammers, no fake listings — just real
          people and real places.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="flex h-12 items-center justify-center rounded-full bg-emerald-600 px-7 text-base font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            Get started — free
          </Link>
          <Link
            href="/safety"
            className="flex h-12 items-center justify-center rounded-full border border-zinc-300 px-7 text-base font-semibold text-zinc-800 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            How verification works
          </Link>
        </div>

        {/* Feature row */}
        <div className="mt-16 grid w-full gap-4 sm:grid-cols-3">
          <Feature
            title="Verified profiles"
            desc="Email and phone confirmed for everyone, with a trust badge. The thing other apps make you pay for."
          />
          <Feature
            title="Smart matching"
            desc="Matched on budget, location, schedule, cleanliness, and lifestyle — not just looks."
          />
          <Feature
            title="Apartments together"
            desc="Once you match, hunt for a place as a team — share listings and shortlist favorites."
          />
        </div>
      </section>

      <footer className="mx-auto w-full max-w-6xl px-6 py-8 text-center text-sm text-zinc-500">
        Built to keep scammers out · 100% free to verify · You stay in control of
        your info
      </footer>
    </main>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-left dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
      </h3>
      <p className="mt-1.5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {desc}
      </p>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.3 6.8-6.8a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
