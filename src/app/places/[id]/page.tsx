"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { TrailDivider } from "@/components/MapMotif";
import {
  type Place,
  placePhotos,
  formatRentRange,
  DEMO_PLACES,
} from "@/lib/places";
import {
  type Listing,
  listingMainPhoto,
  formatRent,
  bedBath,
  DEMO_LISTINGS,
  getDemoSaved,
  setDemoSaved,
  isMissingTable,
} from "@/lib/listings";

// Demo listings have no place_id, so in demo mode we hand-assign a coherent
// subset of DEMO_LISTINGS to each DEMO_PLACES id for this page only.
const DEMO_PLACE_LISTING_IDS: Record<string, string[]> = {
  "demo-place-1": ["demo-1", "demo-4"],
  "demo-place-2": ["demo-2"],
};

export default function PlaceDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(supabaseConfigured);
  const [authed, setAuthed] = useState(false);
  const [place, setPlace] = useState<Place | null>(null);
  const [unitListings, setUnitListings] = useState<Listing[]>([]);
  const [myReaction, setMyReaction] = useState<"like" | "pass" | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [missing, setMissing] = useState(false);
  const [demo, setDemo] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [peopleCount, setPeopleCount] = useState<number | null>(null);
  const [peopleCountLoading, setPeopleCountLoading] = useState(false);

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

      const { data, error } = await supabase.from("places").select("*").eq("id", id).single();
      if (error || !data) {
        const demoPlace = DEMO_PLACES.find((dp) => dp.id === id);
        if (demoPlace) {
          setPlace(demoPlace);
          setDemo(true);
          const listingIds = DEMO_PLACE_LISTING_IDS[id] ?? [];
          setUnitListings(DEMO_LISTINGS.filter((l) => listingIds.includes(l.id)));
          setSaved(getDemoSaved());
        } else {
          setMissing(true);
        }
        setLoading(false);
        return;
      }
      const p = data as Place;
      setPlace(p);

      const { data: listingRows } = await supabase
        .from("listings")
        .select("*")
        .eq("place_id", id)
        .order("created_at", { ascending: false });
      setUnitListings((listingRows ?? []) as Listing[]);

      const { data: reactionRow } = await supabase
        .from("place_reactions")
        .select("reaction")
        .eq("user_id", userData.user.id)
        .eq("place_id", id)
        .maybeSingle();
      setMyReaction((reactionRow as { reaction: "like" | "pass" } | null)?.reaction ?? null);

      const { data: savedRows } = await supabase
        .from("saved_listings")
        .select("listing_id")
        .eq("user_id", userData.user.id);
      setSaved(new Set((savedRows ?? []).map((r: { listing_id: string }) => r.listing_id)));
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    (async () => {
      if (myReaction !== "like" || !place) {
        setPeopleCount(null);
        return;
      }
      if (demo) {
        // Demo mode: curated demo places show a couple of scripted co-seekers.
        setPeopleCount(place.curated ? 2 : 0);
        return;
      }
      if (!myId) return;
      setPeopleCountLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase.rpc("people_for_place", { pid: place.id });
      if (error) {
        setPeopleCount(isMissingTable(error) ? (place.curated ? 2 : 0) : 0);
      } else {
        setPeopleCount((data ?? []).length);
      }
      setPeopleCountLoading(false);
    })();
  }, [myReaction, place, demo, myId]);

  async function react(reaction: "like" | "pass") {
    if (!place) return;
    const next = myReaction === reaction ? null : reaction;
    setMyReaction(next);
    if (demo) {
      // Demo reactions for places live in a separate localStorage map (see
      // Browse), but this page only needs the local "locked/unlocked" state
      // for the teaser, so no cross-page persistence call is required here
      // beyond what Browse already does for the demo place-reactions map.
      return;
    }
    if (!myId) return;
    const supabase = createClient();
    if (next === null) {
      await supabase.from("place_reactions").delete().eq("user_id", myId).eq("place_id", place.id);
    } else {
      await supabase.from("place_reactions").upsert({ user_id: myId, place_id: place.id, reaction: next });
    }
  }

  async function toggleSave(listingId: string) {
    const next = new Set(saved);
    const willSave = !next.has(listingId);
    if (willSave) next.add(listingId);
    else next.delete(listingId);
    setSaved(next);
    if (demo) {
      setDemoSaved(next);
      return;
    }
    if (!myId) return;
    const supabase = createClient();
    if (willSave) {
      await supabase.from("saved_listings").upsert({ user_id: myId, listing_id: listingId });
    } else {
      await supabase.from("saved_listings").delete().eq("user_id", myId).eq("listing_id", listingId);
    }
  }

  if (loading) return <Centered>Loading…</Centered>;
  if (!supabaseConfigured) return <Centered>Accounts aren&apos;t connected yet — see SETUP.md.</Centered>;
  if (!authed)
    return (
      <Centered>
        <p className="text-zinc-600 dark:text-zinc-400">Log in to view this place.</p>
        <Link href="/login" className="roomly-btn mt-4 h-11 px-6 text-sm">
          Go to log in
        </Link>
      </Centered>
    );
  if (missing || !place)
    return (
      <Centered>
        <p className="text-zinc-600 dark:text-zinc-400">This place isn&apos;t available.</p>
        <Link href="/places/browse" className="roomly-btn mt-4 h-11 px-6 text-sm">
          Back to places
        </Link>
      </Centered>
    );

  const photos = placePhotos(place);

  return (
    <main className="roomly-page flex flex-1 flex-col">
      <header className="sticky top-0 z-10 mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-3">
        <Link
          href="/places/browse"
          className="flex h-9 items-center gap-1 rounded-full bg-white/80 px-4 text-sm font-semibold text-zinc-700 backdrop-blur transition-colors hover:bg-white dark:bg-zinc-900/80 dark:text-zinc-200"
        >
          ← Places
        </Link>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 px-6 pb-16">
        {demo && (
          <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-200">
            ✨ Showing demo data. Run <code className="rounded bg-violet-100 px-1 py-0.5 font-mono text-xs dark:bg-violet-900/50">supabase/schema.sql</code> to switch to real, saved data.
          </div>
        )}

        {/* Gallery */}
        <div className="relative aspect-[4/3] w-full select-none overflow-hidden rounded-3xl bg-zinc-200 dark:bg-zinc-800">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photos[photoIdx]} alt={place.name} className="h-full w-full object-cover" />
          <button
            type="button"
            aria-label="Previous photo"
            onClick={() => setPhotoIdx((p) => (p - 1 + photos.length) % photos.length)}
            className="absolute inset-y-0 left-0 w-1/3 cursor-pointer focus:outline-none"
          />
          <button
            type="button"
            aria-label="Next photo"
            onClick={() => setPhotoIdx((p) => (p + 1) % photos.length)}
            className="absolute inset-y-0 right-0 w-2/3 cursor-pointer focus:outline-none"
          />
          <div className="pointer-events-none absolute inset-x-0 top-0 flex gap-1.5 p-2.5">
            {photos.map((_, i) => (
              <span
                key={i}
                className={`h-1 flex-1 rounded-full ${i === photoIdx ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
          {place.curated && (
            <div className="absolute bottom-3 left-3">
              <VerifiedBadge label="Curated" />
            </div>
          )}
        </div>

        {/* Headline */}
        <div className="mt-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{place.name}</h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {[place.neighborhood, place.city].filter(Boolean).join(", ") || "—"} · {place.kind}
            </p>
          </div>
          <p className="shrink-0 text-xl font-black text-violet-600 dark:text-violet-400">
            {formatRentRange(place.rent_min, place.rent_max)}
          </p>
        </div>

        {/* Like / Pass */}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => react("pass")}
            className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-colors ${
              myReaction === "pass"
                ? "bg-zinc-700 text-white"
                : "border border-zinc-200 text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            👎 Pass
          </button>
          <button
            type="button"
            onClick={() => react("like")}
            className={`flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-semibold transition-colors ${
              myReaction === "like"
                ? "bg-gradient-to-r from-fuchsia-500 to-violet-600 text-white"
                : "border border-zinc-200 text-zinc-700 hover:border-violet-400 dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            {myReaction === "like" ? "❤️ Liked" : "🤍 Like"}
          </button>
        </div>

        {/* People teaser: unlocks once you like the place. */}
        <section id="people-teaser" className="mt-6 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
          {myReaction !== "like" ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">🔒 Like this place to see who else wants it.</p>
          ) : peopleCountLoading || peopleCount === null ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Checking who else wants this place…</p>
          ) : peopleCount === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No one else has swiped here yet — you&apos;re early.
            </p>
          ) : (
            <Link
              href="/people"
              className="flex items-center justify-between text-sm font-semibold text-violet-600 hover:underline dark:text-violet-400"
            >
              <span>
                {peopleCount} {peopleCount === 1 ? "person" : "people"} also want this place
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </section>

        <TrailDivider variant="wave" height={48} className="mt-6 opacity-70" />

        {/* Unit listings at this place */}
        <section className="mt-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Available units
          </h2>
          {unitListings.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">No units posted here yet.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {unitListings.map((l) => (
                <Link
                  key={l.id}
                  href={`/places/unit/${l.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white/80 p-3 backdrop-blur transition-colors hover:border-violet-300 dark:border-zinc-800 dark:bg-zinc-900/80 dark:hover:border-violet-700"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-200 dark:bg-zinc-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={listingMainPhoto(l)} alt={l.title} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{l.title}</p>
                    <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                      {formatRent(l.rent)} · {bedBath(l)}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={saved.has(l.id) ? "Unsave" : "Save"}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleSave(l.id);
                    }}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg transition-transform hover:scale-110 active:scale-90"
                  >
                    {saved.has(l.id) ? "❤️" : "🤍"}
                  </button>
                </Link>
              ))}
            </div>
          )}
        </section>
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
