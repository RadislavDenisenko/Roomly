"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/places", label: "Swipe" },
  { href: "/places/browse", label: "Browse" },
  { href: "/places/saved", label: "Saved" },
  { href: "/places/together", label: "Together" },
];

export function PlacesNav() {
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
                ? "bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white shadow-sm"
                : "border border-zinc-200 text-zinc-600 hover:border-violet-300 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-violet-700"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
