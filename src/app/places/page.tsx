"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { PlacesNav } from "@/components/PlacesNav";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { isMissingTable } from "@/lib/listings";
import { peopleConsentSeen, markPeopleConsentSeen } from "@/lib/consent";
import {
  type Place,
  placeMainPhoto,
  formatRentRange,
  deckOrder,
  DEMO_PLACES,
  getDemoPlaceReactions,
  setDemoPlaceReactions,
} from "@/lib/places";

export default function PlacesSwipePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(supabaseConfigured);
  const [authed, setAuthed] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [index, setIndex] = useState(0);
  const [demo, setDemo] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [showConsent, setShowConsent] = useState(false);

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
      const uid = userData.user.id;
      setMyId(uid);

      const { data, error } = await supabase
        .from("places")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        if (isMissingTable(error)) {
          const reacted = getDemoPlaceReactions();
          setPlaces(deckOrder(DEMO_PLACES).filter((p) => !(p.id in reacted)));
          setDemo(true);
        }
        setLoading(false);
        return;
      }

      const { data: reactionRows } = await supabase
        .from("place_reactions")
        .select("place_id")
        .eq("user_id", uid);
      const reacted = new Set((reactionRows ?? []).map((r: { place_id: string }) => r.place_id));
      setPlaces(deckOrder((data ?? []) as Place[]).filter((p) => !reacted.has(p.id)));
      setLoading(false);
    })();
  }, []);

  async function react(place: Place, reaction: "like" | "pass") {
    if (demo) {
      setDemoPlaceReactions({ ...getDemoPlaceReactions(), [place.id]: reaction });
    } else if (myId) {
      const supabase = createClient();
      await supabase.from("place_reactions").upsert({ user_id: myId, place_id: place.id, reaction });
    }
    if (reaction === "like" && !peopleConsentSeen()) {
      setShowConsent(true);
      return;
    }
    setIndex((i) => i + 1);
  }

  function dismissConsent() {
    markPeopleConsentSeen();
    setShowConsent(false);
    setIndex((i) => i + 1);
  }

  if (loading) return <Centered>Loading places…</Centered>;
  if (!supabaseConfigured)
    return <Centered>Accounts aren&apos;t connected yet — see SETUP.md.</Centered>;
  if (!authed)
    return (
      <Centered>
        <p className="text-zinc-600 dark:text-zinc-400">Log in to swipe places.</p>
        <Link href="/login" className="roomly-btn mt-4 h-11 px-6 text-sm">
          Go to log in
        </Link>
      </Centered>
    );

  const current = places[index];

  return (
    <main className="roomly-page flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="roomly-mark h-8 w-8 text-sm">R</span>
          <span className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Roomly</span>
        </Link>
        <Link href="/matches" className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
          Matches
        </Link>
      </header>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center px-6 pb-16">
        <div className="w-full">
          <PlacesNav />
        </div>

        {demo && (
          <div className="mt-4 w-full rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-200">
            ✨ Showing demo places. Run <code className="rounded bg-violet-100 px-1 py-0.5 font-mono text-xs dark:bg-violet-900/50">supabase/schema.sql</code> to switch to real, saved data.
          </div>
        )}

        {showConsent && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-3xl bg-zinc-900/95 px-8 text-center text-white backdrop-blur">
            <span className="text-4xl" aria-hidden="true">🔓</span>
            <p className="mt-4 text-lg font-bold">People who like the same places can see your profile.</p>
            <p className="mt-2 max-w-xs text-sm text-zinc-300">Turn this off anytime in Profile.</p>
            <button onClick={dismissConsent} className="roomly-btn mt-6 h-11 w-full max-w-xs text-sm">
              Got it
            </button>
            <Link href="/profile" className="mt-3 text-sm font-medium text-zinc-300 underline">
              Manage in Profile
            </Link>
          </div>
        )}

        {!current ? (
          <div className="mt-10 flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              You&apos;ve seen every place for now.
            </p>
            <p className="mt-2 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
              Check Browse for the full directory, or see who else is looking.
            </p>
            <div className="mt-6 flex gap-3">
              <Link href="/places/browse" className="roomly-btn h-11 px-6 text-sm">
                Browse places
              </Link>
              <Link
                href="/people"
                className="flex h-11 items-center justify-center rounded-full border border-zinc-300 px-6 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
              >
                See people
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div
              key={current.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/places/${current.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/places/${current.id}`);
                }
              }}
              className="roomly-card-in mt-6 w-full cursor-pointer overflow-hidden rounded-3xl border border-zinc-200 bg-white/80 text-left shadow-sm backdrop-blur transition-shadow duration-300 hover:shadow-xl hover:shadow-violet-500/10 dark:border-zinc-800 dark:bg-zinc-900/80"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={placeMainPhoto(current)} alt={current.name} className="h-full w-full object-cover" />
                <div className="absolute left-3 top-3 flex items-center gap-1.5">
                  {current.curated && <VerifiedBadge label="Curated" />}
                  <span className="roomly-badge inline-flex items-center rounded-full bg-black/45 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur">
                    {current.kind}
                  </span>
                </div>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-12">
                  <h2 className="text-xl font-bold text-white">{current.name}</h2>
                  <p className="mt-0.5 text-sm text-zinc-200">
                    {[current.neighborhood, current.city].filter(Boolean).join(", ") || "—"}
                  </p>
                </div>
              </div>
              <div className="p-4">
                <p className="text-lg font-black text-violet-600 dark:text-violet-400">
                  {formatRentRange(current.rent_min, current.rent_max)}
                </p>
                <p className="mt-3 text-center text-xs font-medium text-violet-600 dark:text-violet-400">
                  Tap to see details →
                </p>
              </div>
            </div>

            <div className="mt-6 flex w-full gap-4">
              <button
                onClick={() => react(current, "pass")}
                className="flex h-14 flex-1 items-center justify-center rounded-full border border-zinc-300 text-base font-semibold text-zinc-700 transition-all duration-200 ease-out hover:bg-zinc-100 active:scale-95 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Pass 👎
              </button>
              <button onClick={() => react(current, "like")} className="roomly-btn h-14 flex-1 text-base">
                Like ❤️
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="roomly-page flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-sm text-zinc-600 dark:text-zinc-400">{children}</div>
    </main>
  );
}
