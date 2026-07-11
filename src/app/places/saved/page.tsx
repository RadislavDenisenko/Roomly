"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { DottedTrail } from "@/components/MapMotif";
import { PlacesNav } from "@/components/PlacesNav";
import {
  type Listing,
  listingMainPhoto,
  formatRent,
  bedBath,
  isMissingTable,
  DEMO_LISTINGS,
  getDemoSaved,
  setDemoSaved,
} from "@/lib/listings";

export default function SavedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(supabaseConfigured);
  const [authed, setAuthed] = useState(false);
  const [demo, setDemo] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Listing[]>([]);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const supabase = createClient();
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoading(false);
        return;
      }
      setAuthed(true);
      setMyId(userData.user.id);

      const { data, error } = await supabase
        .from("saved_listings")
        .select("listing_id, listings(*)")
        .eq("user_id", userData.user.id);

      if (error) {
        if (isMissingTable(error)) {
          setDemo(true);
          const ids = getDemoSaved();
          setSaved(DEMO_LISTINGS.filter((l) => ids.has(l.id)));
        }
        setLoading(false);
        return;
      }

      const rows = (data ?? []) as unknown as { listings: Listing | Listing[] | null }[];
      setSaved(
        rows
          .map((r) => (Array.isArray(r.listings) ? r.listings[0] : r.listings))
          .filter((l): l is Listing => !!l),
      );
      setLoading(false);
    })();
  }, []);

  async function unsave(id: string) {
    setSaved((s) => s.filter((l) => l.id !== id));
    if (demo) {
      const ids = getDemoSaved();
      ids.delete(id);
      setDemoSaved(ids);
      return;
    }
    if (!myId) return;
    const supabase = createClient();
    await supabase.from("saved_listings").delete().eq("user_id", myId).eq("listing_id", id);
  }

  return (
    <main className="roomly-page flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="roomly-mark h-8 w-8 text-sm">R</span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Roomly</span>
        </Link>
        <Link href="/places/new" className="roomly-btn px-4 py-2 text-sm">
          Post a place
        </Link>
      </header>

      <DottedTrail variant="arc" height={40} className="opacity-70" />

      <div className="mx-auto w-full max-w-2xl flex-1 px-6 pb-16">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Saved places</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Every apartment you&apos;ve hearted, in one spot.
        </p>
        <PlacesNav />

        {loading ? (
          <p className="mt-10 text-center text-sm text-zinc-500">Loading…</p>
        ) : !supabaseConfigured ? (
          <Note>Accounts aren&apos;t connected yet — see SETUP.md.</Note>
        ) : !authed ? (
          <div className="mt-10 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Log in to see your saved places.</p>
            <Link href="/login" className="roomly-btn mt-4 h-11 px-6 text-sm">Go to log in</Link>
          </div>
        ) : saved.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">No saved places yet.</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Tap the 🤍 on any place to keep it here.</p>
            <Link href="/places/browse" className="roomly-btn mt-6 h-11 px-6 text-sm">Browse places</Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {saved.map((l, i) => (
              <article
                key={l.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/places/unit/${l.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/places/unit/${l.id}`);
                  }
                }}
                style={{ animationDelay: `${i * 50}ms` }}
                className="roomly-card-in group cursor-pointer overflow-hidden rounded-3xl border border-zinc-200 bg-white/80 text-left shadow-sm backdrop-blur transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-500/10 dark:border-zinc-800 dark:bg-zinc-900/80"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={listingMainPhoto(l)}
                    alt={l.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute left-3 top-3">{l.verified && <VerifiedBadge label="Verified place" />}</div>
                  <button
                    type="button"
                    aria-label="Remove from saved"
                    onClick={(e) => {
                      e.stopPropagation();
                      unsave(l.id);
                    }}
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-lg backdrop-blur transition-transform hover:scale-110 active:scale-90"
                  >
                    ❤️
                  </button>
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-10">
                    <p className="text-lg font-bold text-white">{formatRent(l.rent)}</p>
                  </div>
                </div>
                <div className="p-4">
                  <h2 className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{l.title}</h2>
                  <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">
                    {[l.neighborhood, l.city].filter(Boolean).join(", ") || "—"}
                  </p>
                  <p className="mt-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">{bedBath(l)}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-10 rounded-3xl border border-zinc-200 bg-white/70 p-8 text-center text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400">
      {children}
    </div>
  );
}
