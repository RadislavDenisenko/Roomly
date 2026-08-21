"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { DottedTrail } from "@/components/MapMotif";
import { AppNav } from "@/components/AppNav";
import { PlacesTabs } from "@/components/PlacesTabs";
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
import { type Place, placeMainPhoto, formatRentRange } from "@/lib/places";

export default function SavedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(supabaseConfigured);
  const [authed, setAuthed] = useState(false);
  const [demo, setDemo] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Listing[]>([]);
  const [likedPlaces, setLikedPlaces] = useState<Place[]>([]);

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

      // Places you liked while swiping — your matched apartments.
      const { data: likedRows } = await supabase
        .from("place_reactions")
        .select("place_id, created_at")
        .eq("user_id", userData.user.id)
        .eq("reaction", "like")
        .order("created_at", { ascending: false });
      const likedIds = (likedRows ?? []).map((r: { place_id: string }) => r.place_id);
      if (likedIds.length > 0) {
        const { data: placeRows } = await supabase.from("places").select("*").in("id", likedIds);
        const byId = new Map(((placeRows ?? []) as Place[]).map((p) => [p.id, p]));
        setLikedPlaces(likedIds.map((id) => byId.get(id)).filter(Boolean) as Place[]);
      }

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

  async function unlikePlace(id: string) {
    setLikedPlaces((s) => s.filter((p) => p.id !== id));
    if (demo || !myId) return;
    const supabase = createClient();
    await supabase.from("place_reactions").delete().eq("user_id", myId).eq("place_id", id);
  }

  return (
    <main className="roomly-page flex flex-1 flex-col">
      <AppNav active="places" />

      <DottedTrail variant="arc" height={40} className="opacity-70" />

      <div className="mx-auto w-full max-w-2xl flex-1 px-6 pb-16">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Liked</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          The places you&apos;ve matched with — each one is a door to its people.
        </p>
        <PlacesTabs />

        {loading ? (
          <p className="mt-10 text-center text-sm text-zinc-500">Loading…</p>
        ) : !supabaseConfigured ? (
          <Note>Accounts aren&apos;t connected yet — see SETUP.md.</Note>
        ) : !authed ? (
          <div className="mt-10 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Log in to see your liked places.</p>
            <Link href="/login" className="roomly-btn mt-4 h-11 px-6 text-sm">Go to log in</Link>
          </div>
        ) : likedPlaces.length === 0 && saved.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Nothing liked yet.</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              Swipe places you&apos;d live in — they land here, along with the people
              who want them too.
            </p>
            <Link href="/places" className="roomly-btn mt-6 h-11 px-6 text-sm">Swipe places</Link>
          </div>
        ) : (
          <>
            {likedPlaces.length > 0 && (
              <section className="mt-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Your matched places
                </h2>
                <div className="mt-3 space-y-3">
                  {likedPlaces.map((p, i) => (
                    <div
                      key={p.id}
                      style={{ animationDelay: `${i * 50}ms` }}
                      className="roomly-card-in flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white/80 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80"
                    >
                      <Link href={`/places/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={placeMainPhoto(p)} alt={p.name} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{p.name}</p>
                          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                            {[p.neighborhood, p.city].filter(Boolean).join(", ")} · {formatRentRange(p.rent_min, p.rent_max)}
                          </p>
                        </div>
                      </Link>
                      <Link
                        href={`/people?place=${p.id}`}
                        className="shrink-0 rounded-full bg-emerald-700 px-3.5 py-2 text-xs font-bold text-white transition-transform hover:scale-105 active:scale-95"
                      >
                        Meet people →
                      </Link>
                      <button
                        type="button"
                        aria-label={`Remove ${p.name} from liked`}
                        onClick={() => unlikePlace(p.id)}
                        className="shrink-0 px-1 text-zinc-400 transition-colors hover:text-zinc-700 dark:hover:text-zinc-200"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {saved.length > 0 && (
              <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Saved units
              </h2>
            )}
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
          </>
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
