"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import {
  type Listing,
  listingMainPhoto,
  formatRent,
  bedBath,
  isMissingTable,
} from "@/lib/listings";

export default function ApartmentsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(supabaseConfigured);
  const [authed, setAuthed] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [needsSetup, setNeedsSetup] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);

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
        .from("listings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        if (isMissingTable(error)) setNeedsSetup(true);
        setLoading(false);
        return;
      }
      setListings((data ?? []) as Listing[]);

      const { data: savedRows } = await supabase
        .from("saved_listings")
        .select("listing_id")
        .eq("user_id", userData.user.id);
      setSaved(new Set((savedRows ?? []).map((r: { listing_id: string }) => r.listing_id)));
      setLoading(false);
    })();
  }, []);

  async function toggleSave(id: string) {
    if (!myId) return;
    const supabase = createClient();
    const isSaved = saved.has(id);
    setSaved((s) => {
      const next = new Set(s);
      if (isSaved) next.delete(id);
      else next.add(id);
      return next;
    });
    if (isSaved) {
      await supabase.from("saved_listings").delete().eq("user_id", myId).eq("listing_id", id);
    } else {
      await supabase.from("saved_listings").upsert({ user_id: myId, listing_id: id });
    }
  }

  return (
    <main className="roomly-page flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="roomly-mark h-8 w-8 text-sm">R</span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Roomly</span>
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/discover" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
            Discover
          </Link>
          <Link href="/apartments/new" className="roomly-btn px-4 py-2 text-sm">
            Post a place
          </Link>
        </nav>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-6 pb-16">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Apartments</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Verified places posted right here on Roomly — no scraped listings, no fakes.
        </p>

        {loading ? (
          <p className="mt-10 text-center text-sm text-zinc-500">Loading places…</p>
        ) : !supabaseConfigured ? (
          <Empty title="Accounts aren't connected yet" body="Finish the Supabase setup in SETUP.md." />
        ) : !authed ? (
          <div className="mt-10 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Log in to browse apartments.</p>
            <Link href="/login" className="roomly-btn mt-4 h-11 px-6 text-sm">
              Go to log in
            </Link>
          </div>
        ) : needsSetup ? (
          <Empty
            title="Apartments aren't set up yet"
            body="Run the latest supabase/schema.sql in your Supabase SQL editor to create the listings tables."
          />
        ) : listings.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">No places listed yet.</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Be the first — post a place for roommates to find.</p>
            <Link href="/apartments/new" className="roomly-btn mt-6 h-11 px-6 text-sm">
              Post a place
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {listings.map((l, i) => (
              <article
                key={l.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/apartments/${l.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/apartments/${l.id}`);
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
                  <div className="absolute left-3 top-3">
                    {l.verified && <VerifiedBadge label="Verified place" />}
                  </div>
                  <button
                    type="button"
                    aria-label={saved.has(l.id) ? "Unsave" : "Save"}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSave(l.id);
                    }}
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-lg backdrop-blur transition-transform hover:scale-110 active:scale-90"
                  >
                    {saved.has(l.id) ? "❤️" : "🤍"}
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

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-10 rounded-3xl border border-zinc-200 bg-white/70 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/70">
      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{title}</p>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{body}</p>
    </div>
  );
}
