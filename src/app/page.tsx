import Link from "next/link";
import { DemoButton } from "@/components/DemoButton";

export default function Home() {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-gradient-to-b from-violet-50 via-fuchsia-50/60 to-white dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-950">
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-base font-black text-white shadow-lg shadow-violet-500/30">
            R
          </span>
          <span className="text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50">
            Roomly
          </span>
        </div>
        <nav className="flex items-center gap-2 text-sm font-semibold sm:gap-4">
          <Link href="/safety" className="hidden text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 sm:block">
            How we verify
          </Link>
          <Link href="/login" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            Log in
          </Link>
          <Link href="/signup" className="rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 px-5 py-2.5 text-white shadow-lg shadow-violet-500/30 transition-transform hover:scale-105">
            Get started
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center px-6 pb-12 pt-4 text-center">
        <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-white/70 px-4 py-1.5 text-sm font-bold text-fuchsia-700 backdrop-blur dark:border-fuchsia-900/50 dark:bg-fuchsia-950/40 dark:text-fuchsia-300">
          ✓ Every profile verified — free, for everyone
        </span>
        <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl">
          Find your{" "}
          <span className="bg-gradient-to-r from-fuchsia-500 to-violet-600 bg-clip-text text-transparent">
            person
          </span>
          .<br /> Then find your{" "}
          <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
            place
          </span>
          .
        </h1>
        <p className="mt-5 max-w-xl text-lg font-medium leading-8 text-zinc-600 dark:text-zinc-400">
          Swipe verified roommates, match on what actually matters, then walk into
          a new home together. No scammers, no fake listings — just real people.
        </p>

        <HouseScene />

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <DemoButton className="flex h-14 items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-600 px-8 text-base font-bold text-white shadow-xl shadow-violet-500/30 transition-transform hover:scale-105 disabled:opacity-70" />
          <Link href="/signup" className="flex h-14 items-center justify-center rounded-full border-2 border-zinc-200 bg-white/70 px-8 text-base font-bold text-zinc-800 backdrop-blur transition-colors hover:bg-white dark:border-zinc-800 dark:bg-transparent dark:text-zinc-100 dark:hover:bg-zinc-900">
            Sign up free
          </Link>
        </div>
        <p className="mt-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          No signup — jump straight into a live demo.{" "}
          <Link href="/safety" className="font-bold text-fuchsia-600 hover:underline dark:text-fuchsia-400">
            See how we verify
          </Link>
        </p>
      </section>

      <section className="relative z-10 mx-auto grid w-full max-w-4xl gap-4 px-6 pb-16 sm:grid-cols-3">
        <Feature emoji="🛡️" title="Verified profiles" desc="Everyone is confirmed — the thing other apps make you pay for." color="from-fuchsia-500 to-pink-500" />
        <Feature emoji="💜" title="Real compatibility" desc="Matched on budget, schedule, and cleanliness — not just looks." color="from-violet-500 to-indigo-500" />
        <Feature emoji="🎒" title="Find a place together" desc="Match first, then go find a home as a team." color="from-orange-400 to-pink-500" />
      </section>
    </main>
  );
}

function HouseScene() {
  return (
    <div className="mt-8 w-full max-w-xl">
      <svg
        viewBox="0 0 480 340"
        className="h-auto w-full"
        role="img"
        aria-label="A person with a backpack walking up to a cozy little house"
      >
        <defs>
          <radialGradient id="sky" cx="50%" cy="28%" r="85%">
            <stop offset="0%" stopColor="#fde9d9" />
            <stop offset="100%" stopColor="#f0dcf2" />
          </radialGradient>
          <linearGradient id="house" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fbf1de" />
            <stop offset="100%" stopColor="#ecd6b0" />
          </linearGradient>
          <linearGradient id="roof" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f2a184" />
            <stop offset="100%" stopColor="#d8623f" />
          </linearGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c4e6b2" />
            <stop offset="100%" stopColor="#9ed187" />
          </linearGradient>
          <linearGradient id="shirt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id="pack" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f4a261" />
            <stop offset="100%" stopColor="#e76f3c" />
          </linearGradient>
          <radialGradient id="win" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stopColor="#ffe9a8" />
            <stop offset="100%" stopColor="#f6c453" />
          </radialGradient>
          <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#5b3a8a" floodOpacity="0.18" />
          </filter>
        </defs>

        {/* sky */}
        <rect x="0" y="0" width="480" height="340" rx="28" fill="url(#sky)" />

        {/* clouds */}
        <g className="roomly-cloud" fill="#ffffff" opacity="0.85">
          <ellipse cx="95" cy="62" rx="34" ry="18" />
          <ellipse cx="126" cy="60" rx="24" ry="14" />
        </g>
        <g className="roomly-cloud" style={{ animationDelay: "-3s" }} fill="#ffffff" opacity="0.7">
          <ellipse cx="382" cy="46" rx="28" ry="15" />
          <ellipse cx="408" cy="48" rx="20" ry="12" />
        </g>

        {/* sun */}
        <circle cx="64" cy="60" r="26" fill="#ffd98a" opacity="0.9" />

        {/* ground */}
        <path d="M0 258 Q 240 232 480 258 L480 340 L0 340 Z" fill="url(#ground)" />
        <ellipse cx="150" cy="300" rx="60" ry="10" fill="#8cc476" opacity="0.5" />

        {/* house */}
        <g filter="url(#soft)">
          <rect x="258" y="150" width="150" height="120" rx="22" fill="url(#house)" />
          <path d="M242 158 Q 333 86 424 158 Q 333 134 242 158 Z" fill="url(#roof)" />
          <rect x="380" y="104" width="20" height="40" rx="7" fill="#c9553a" />
          <rect x="350" y="180" width="44" height="44" rx="13" fill="url(#win)" />
          <line x1="372" y1="180" x2="372" y2="224" stroke="#e0a83f" strokeWidth="3" />
          <line x1="350" y1="202" x2="394" y2="202" stroke="#e0a83f" strokeWidth="3" />
          <rect x="286" y="196" width="52" height="74" rx="20" fill="url(#shirt)" />
          <path d="M312 214 c -6 -8 -19 -2 -11 8 l 11 13 l 11 -13 c 8 -10 -5 -16 -11 -8 Z" fill="#ffd1e8" />
          <circle cx="328" cy="234" r="3.2" fill="#ffd1e8" />
        </g>

        {/* chimney smoke */}
        <circle className="roomly-smoke" cx="390" cy="100" r="6" fill="#d9c7d6" />
        <circle className="roomly-smoke" style={{ animationDelay: "-1.5s" }} cx="393" cy="100" r="5" fill="#d9c7d6" />

        {/* walking backpacker */}
        <g transform="translate(312, 270)" filter="url(#soft)">
          <g className="roomly-walker">
            <ellipse cx="0" cy="2" rx="20" ry="5" fill="#3a2a55" opacity="0.12" />
            <g className="roomly-bob">
              <rect className="roomly-leg-b" x="-9" y="-30" width="8" height="30" rx="4" fill="#5b4636" />
              <rect className="roomly-leg-a" x="1" y="-30" width="8" height="30" rx="4" fill="#6b5440" />
              <rect x="-21" y="-56" width="15" height="27" rx="7" fill="url(#pack)" />
              <rect x="-19" y="-50" width="4" height="16" rx="2" fill="#c9572a" />
              <rect x="-13" y="-58" width="22" height="33" rx="11" fill="url(#shirt)" />
              <rect x="7" y="-54" width="7" height="22" rx="3.5" fill="#8b5cf6" />
              <circle cx="1" cy="-69" r="12" fill="#f1c8a0" />
              <path d="M-11 -71 q 12 -18 24 0 q -6 -9 -12 -9 q -6 0 -12 9 Z" fill="#4a3526" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}

function Feature({
  emoji,
  title,
  desc,
  color,
}: {
  emoji: string;
  title: string;
  desc: string;
  color: string;
}) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white/80 p-6 text-left shadow-sm backdrop-blur transition-transform hover:-translate-y-1 dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${color} text-2xl shadow-lg`}>
        {emoji}
      </div>
      <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{desc}</p>
    </div>
  );
}
