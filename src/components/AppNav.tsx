"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserCircleIcon } from "@phosphor-icons/react";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";

const STEPS = [
  { key: "places", href: "/places", n: 1, label: "Places" },
  { key: "people", href: "/people", n: 2, label: "People" },
  { key: "matches", href: "/matches", n: 3, label: "Matches" },
] as const;

export type Step = (typeof STEPS)[number]["key"];

/**
 * The one nav for the whole journey. Three steps in the order the product
 * wants you to move: match a place, meet its people, talk to your matches.
 */
export function AppNav({ active }: { active: Step }) {
  // Conversations needing attention (unread messages or unopened matches).
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase.rpc("unread_chats").then(({ data: n }) => setUnread((n as number) ?? 0));
    });
  }, []);

  return (
    <header className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-6 py-5">
      <Link href="/" aria-label="Roomly home" className="shrink-0">
        <span className="roomly-mark h-9 w-9 text-base">R</span>
      </Link>

      <nav aria-label="Your journey" className="flex items-center gap-1 sm:gap-2">
        {STEPS.map((s, i) => {
          const isActive = s.key === active;
          return (
            <span key={s.key} className="flex items-center gap-1 sm:gap-2">
              {i > 0 && (
                <span aria-hidden className="text-zinc-300 dark:text-zinc-700">
                  ›
                </span>
              )}
              <Link
                href={s.href}
                aria-current={isActive ? "step" : undefined}
                className={`flex items-center gap-1.5 rounded-full py-1.5 pl-1.5 pr-3 text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-brick-600 text-white shadow-sm shadow-brick-900/20"
                    : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                    isActive
                      ? "bg-white/25 text-white"
                      : "border border-zinc-300 text-zinc-500 dark:border-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {s.n}
                </span>
                {s.label}
                {s.key === "matches" && unread > 0 && (
                  <span
                    aria-label={`${unread} conversations need you`}
                    className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold ${
                      isActive ? "bg-white text-brick-700" : "bg-brick-600 text-white"
                    }`}
                  >
                    {unread}
                  </span>
                )}
              </Link>
            </span>
          );
        })}
      </nav>

      <Link
        href="/profile"
        aria-label="Your profile"
        className="shrink-0 text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <UserCircleIcon size={30} weight="duotone" />
      </Link>
    </header>
  );
}
