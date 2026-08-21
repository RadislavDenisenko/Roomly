"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { AppNav } from "@/components/AppNav";
import { PlacesTabs } from "@/components/PlacesTabs";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { isMissingTable } from "@/lib/listings";
import { peopleConsentSeen, markPeopleConsentSeen } from "@/lib/consent";
import { mainPhoto } from "@/lib/photos";
import {
  compatibility,
  passesDealbreakers,
  scoreTier,
  type CompatProfile,
  type Dealbreakers,
} from "@/lib/compat";
import type { PoolPerson } from "@/lib/people";
import {
  type Place,
  type SearchPrefs,
  placeMainPhoto,
  placeKindLabel,
  formatRentRange,
  deckOrder,
  personalizedDeck,
  hasSearchPrefs,
  matchedTagLabels,
  DEMO_PLACES,
  getDemoPlaceReactions,
  setDemoPlaceReactions,
} from "@/lib/places";

type MyProfile = CompatProfile &
  Dealbreakers & { pref_areas?: string[] | null; pref_tags?: string[] | null };

const NO_PREFS: SearchPrefs = { budget_min: null, budget_max: null, pref_areas: null, pref_tags: null };
type PoolPreview = { loading: boolean; count: number; top: (PoolPerson & { score: number })[] };

export default function PlacesSwipePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(supabaseConfigured);
  const [authed, setAuthed] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [index, setIndex] = useState(0);
  const [demo, setDemo] = useState(false);
  const [me, setMe] = useState<MyProfile | null>(null);
  const [meVerified, setMeVerified] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  // Set once a place is liked: the card flips to show who wants it too.
  const [flip, setFlip] = useState<PoolPreview | null>(null);
  const [prefs, setPrefs] = useState<SearchPrefs>(NO_PREFS);
  // True when the search filters matched nothing (vs. having swiped it all).
  const [filteredOut, setFilteredOut] = useState(false);

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

      const { data: meRow } = await supabase.from("profiles").select("*").eq("id", uid).single();
      const meProfile = (meRow ?? { id: uid }) as MyProfile;
      setMe(meProfile);
      setMeVerified(meProfile.verification_status === "verified");

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

      // The deck is your search, not a shuffle: filtered by budget + areas,
      // ranked by how many wanted amenities a place has.
      const myPrefs: SearchPrefs = {
        budget_min: meProfile.budget_min ?? null,
        budget_max: meProfile.budget_max ?? null,
        pref_areas: meProfile.pref_areas ?? null,
        pref_tags: meProfile.pref_tags ?? null,
      };
      setPrefs(myPrefs);
      const all = (data ?? []) as Place[];
      const personalized = personalizedDeck(all, myPrefs);
      setFilteredOut(all.length > 0 && personalized.length === 0);
      setPlaces(personalized.filter((p) => !reacted.has(p.id)));
      setLoading(false);
    })();
  }, []);

  async function loadPool(place: Place) {
    setFlip({ loading: true, count: 0, top: [] });
    const supabase = createClient();
    const { data, error } = await supabase.rpc("people_for_place", { pid: place.id });
    const pool = error || !me ? [] : ((data ?? []) as PoolPerson[]).filter((p) => passesDealbreakers(me, p));
    const scored = pool
      .map((p) => ({ ...p, score: compatibility(me as MyProfile, p) }))
      .sort((a, b) => b.score - a.score);
    setFlip({ loading: false, count: scored.length, top: scored.slice(0, 3) });
  }

  async function react(place: Place, reaction: "like" | "pass") {
    if (demo) {
      setDemoPlaceReactions({ ...getDemoPlaceReactions(), [place.id]: reaction });
      setIndex((i) => i + 1);
      return;
    }
    if (me) {
      const supabase = createClient();
      await supabase.from("place_reactions").upsert({ user_id: me.id, place_id: place.id, reaction });
    }
    if (reaction === "pass") {
      setIndex((i) => i + 1);
      return;
    }
    if (!peopleConsentSeen()) {
      setShowConsent(true);
      return;
    }
    void loadPool(place);
  }

  function dismissConsent() {
    markPeopleConsentSeen();
    setShowConsent(false);
    const current = places[index];
    if (current) void loadPool(current);
  }

  function keepSwiping() {
    setFlip(null);
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
      <AppNav active="places" />

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center px-6 pb-16">
        <div className="w-full">
          <PlacesTabs />
        </div>

        {/* Your-search summary: the deck is filtered by this, not random. */}
        {!demo && (
          <div className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white/70 px-4 py-2.5 text-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70">
            {hasSearchPrefs(prefs) ? (
              <span className="min-w-0 truncate text-zinc-600 dark:text-zinc-300">
                {[
                  prefs.budget_max != null ? `$${prefs.budget_min ?? 0}–${prefs.budget_max}` : null,
                  prefs.pref_areas && prefs.pref_areas.length > 0
                    ? prefs.pref_areas.slice(0, 2).join(", ") +
                      (prefs.pref_areas.length > 2 ? ` +${prefs.pref_areas.length - 2}` : "")
                    : "Anywhere in Austin",
                  prefs.pref_tags && prefs.pref_tags.length > 0
                    ? `${prefs.pref_tags.length} nearby ${prefs.pref_tags.length === 1 ? "need" : "needs"}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            ) : (
              <span className="text-zinc-500 dark:text-zinc-400">
                Showing everything — set your search to narrow it.
              </span>
            )}
            <Link
              href="/preferences"
              className="shrink-0 font-semibold text-brick-600 hover:underline dark:text-brick-400"
            >
              {hasSearchPrefs(prefs) ? "Edit" : "Set search"}
            </Link>
          </div>
        )}

        {demo && (
          <div className="mt-4 w-full rounded-2xl border border-brick-200 bg-brick-50 px-4 py-3 text-sm text-brick-800 dark:border-brick-900/50 dark:bg-brick-950/40 dark:text-brick-200">
            ✨ Showing demo places. Run <code className="rounded bg-brick-100 px-1 py-0.5 font-mono text-xs dark:bg-brick-900/50">supabase/schema.sql</code> to switch to real, saved data.
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
          filteredOut ? (
            <div className="mt-10 flex flex-1 flex-col items-center justify-center text-center">
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Nothing matches your search yet.
              </p>
              <p className="mt-2 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
                Your budget or areas are filtering everything out — loosen them a
                little and the deck fills back up.
              </p>
              <Link href="/preferences" className="roomly-btn mt-6 h-11 px-6 text-sm">
                Adjust my search
              </Link>
            </div>
          ) : (
            <div className="mt-10 flex flex-1 flex-col items-center justify-center text-center">
              <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                You&apos;ve seen every place in your search.
              </p>
              <p className="mt-2 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
                Widen your search, browse the full directory, or meet the people
                who want your liked places.
              </p>
              <div className="mt-6 flex gap-3">
                <Link href="/preferences" className="roomly-btn h-11 px-6 text-sm">
                  Widen search
                </Link>
                <Link
                  href="/places/browse"
                  className="flex h-11 items-center justify-center rounded-full border border-zinc-300 px-6 text-sm font-semibold text-zinc-700 transition-all duration-200 ease-out hover:bg-zinc-100 active:scale-95 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Browse all
                </Link>
              </div>
            </div>
          )
        ) : (
          <>
            {/* card-in lives on the scene, not the face — its transform
                animation would otherwise pin the face and block the flip */}
            <div className="roomly-flip-scene roomly-card-in mt-6 w-full">
              <div className={`roomly-flip ${flip ? "is-flipped" : ""}`}>
                {/* Front: the place */}
                <div
                  key={current.id}
                  role="button"
                  tabIndex={flip ? -1 : 0}
                  onClick={() => !flip && router.push(`/places/${current.id}`)}
                  onKeyDown={(e) => {
                    if (!flip && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      router.push(`/places/${current.id}`);
                    }
                  }}
                  className={`roomly-flip-front w-full cursor-pointer overflow-hidden rounded-3xl border border-zinc-200 bg-white/80 text-left shadow-sm backdrop-blur hover:shadow-xl hover:shadow-brick-500/10 dark:border-zinc-800 dark:bg-zinc-900/80 ${
                    flip ? "pointer-events-none" : ""
                  }`}
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={placeMainPhoto(current)} alt={current.name} className="h-full w-full object-cover" />
                    <div className="absolute left-3 top-3 flex items-center gap-1.5">
                      {current.curated && <VerifiedBadge label="Curated" />}
                      <span className="roomly-badge inline-flex items-center rounded-full bg-black/45 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur">
                        {placeKindLabel(current.kind)}
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
                    <p className="text-lg font-black text-brick-600 dark:text-brick-400">
                      {formatRentRange(current.rent_min, current.rent_max)}
                    </p>
                    {matchedTagLabels(current, prefs.pref_tags).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {matchedTagLabels(current, prefs.pref_tags).map((label) => (
                          <span
                            key={label}
                            className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                          >
                            ✓ {label}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-3 text-center text-xs font-medium text-brick-600 dark:text-brick-400">
                      Tap to see details →
                    </p>
                  </div>
                </div>

                {/* Back: who wants it too */}
                {flip && (
                  <div className="roomly-flip-back flex flex-col overflow-hidden rounded-3xl border border-emerald-200 bg-emerald-700 p-6 text-emerald-50 dark:border-emerald-900">
                    {flip.loading ? (
                      <div className="flex flex-1 flex-col items-center justify-center text-center">
                        <span className="animate-pulse text-4xl" aria-hidden>🔎</span>
                        <p className="mt-4 font-semibold">Checking who wants {current.name}…</p>
                      </div>
                    ) : !meVerified ? (
                      <div className="flex flex-1 flex-col items-center justify-center text-center">
                        <span className="text-4xl" aria-hidden>🛡️</span>
                        <p className="mt-4 text-xl font-bold">Liked! Now meet its people.</p>
                        <p className="mt-2 text-sm text-emerald-100">
                          Verify your identity (free, a minute) to see who wants {current.name} too.
                        </p>
                        <Link href="/verify" className="mt-5 flex h-12 w-full items-center justify-center rounded-full bg-white text-sm font-bold text-emerald-700 hover:bg-emerald-50">
                          Verify me
                        </Link>
                        <button type="button" onClick={keepSwiping} className="mt-3 text-sm font-medium text-emerald-100 underline">
                          Keep swiping
                        </button>
                      </div>
                    ) : flip.count === 0 ? (
                      <div className="flex flex-1 flex-col items-center justify-center text-center">
                        <span className="text-4xl" aria-hidden>🌱</span>
                        <p className="mt-4 text-xl font-bold">You&apos;re first in line.</p>
                        <p className="mt-2 text-sm text-emerald-100">
                          Nobody else has claimed {current.name} yet — when someone does,
                          they&apos;ll show up in your People step.
                        </p>
                        <button type="button" onClick={keepSwiping} className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-white text-sm font-bold text-emerald-700 hover:bg-emerald-50">
                          Keep swiping
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-1 flex-col">
                        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-200">
                          It&apos;s a place match
                        </p>
                        <h2 className="mt-1 text-2xl font-bold text-white">
                          {flip.count} {flip.count === 1 ? "person wants" : "people want"} {current.name} too
                        </h2>
                        <div className="mt-5 flex flex-1 flex-col justify-center gap-3">
                          {flip.top.map((p) => (
                            <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-white/10 p-2.5 backdrop-blur">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={mainPhoto(p)} alt={p.full_name ?? "Profile"} className="h-11 w-11 rounded-full object-cover" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-white">
                                  {p.full_name}
                                  {p.age ? `, ${p.age}` : ""}
                                </p>
                                <p className="text-xs text-emerald-200">
                                  {p.member_group === "resident" ? "Lives here · " : ""}
                                  {scoreTier(p.score)}
                                </p>
                              </div>
                              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-emerald-700">
                                {p.score}%
                              </span>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => router.push(`/people?place=${current.id}`)}
                          className="mt-4 flex h-12 w-full items-center justify-center rounded-full bg-white text-sm font-bold text-emerald-700 transition-transform hover:scale-[1.02] active:scale-95"
                        >
                          Meet them →
                        </button>
                        <button type="button" onClick={keepSwiping} className="mt-3 text-center text-sm font-medium text-emerald-100 underline">
                          Keep swiping
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {!flip && (
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
            )}
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
