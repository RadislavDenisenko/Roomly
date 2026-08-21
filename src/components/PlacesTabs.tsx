"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Sub-views of step 1 (Places). "Together" is deliberately not here — you
// reach it from a match's chat, because it needs a matched roommate first.
const TABS = [
  { href: "/places", label: "Swipe" },
  { href: "/places/browse", label: "Browse" },
  { href: "/places/saved", label: "Liked" },
];

export function PlacesTabs() {
  const pathname = usePathname();
  return (
    <nav className="mt-4 flex gap-2">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              active
                ? "bg-brick-600 text-white shadow-sm shadow-brick-900/20"
                : "border border-zinc-200 text-zinc-600 hover:border-brick-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-brick-700"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
