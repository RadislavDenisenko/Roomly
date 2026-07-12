"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient, supabaseConfigured } from "@/lib/supabase/client";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { DottedTrail } from "@/components/MapMotif";
import { PlacesNav } from "@/components/PlacesNav";
import { isMissingTable } from "@/lib/listings";
import {
  type Place,
  placeMainPhoto,
  placeKindLabel,
  formatRentRange,
  DEMO_PLACES,
  getDemoPlaceReactions,
  setDemoPlaceReactions,
} from "@/lib/places";

export default function BrowsePlacesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(supabaseConfigured);
  const [authed, setAuthed] = useState(false);
  const [places, setPlaces] = useState<Place[]>([]);
  const [reactions, setReactions] = useState<Record<string, "like" | "pass">>({});
  const [demo, setDemo] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);

  // filters
  const [query, setQuery] = useState("");
  const [maxRent, setMaxRent] = useState(3000);
  const [curatedOnly, setCuratedOnly] = useState(false);
  const [sort, setSort] = useState<"new" | "price-asc" | "price-desc">("new");

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
        .from("places")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        if (isMissingTable(error)) {
          setPlaces(DEMO_PLACES);
          setDemo(true);
          setReactions(getDemoPlaceReactions());
        }
        setLoading(false);
        return;
      }
      setPlaces((data ?? []) as Place[]);

      const { data: reactionRows } = await supabase
        .from("place_reactions")
        .select("place_id, reaction")
        .eq("user_id", userData.user.id);
      const map: Record<string, "like" | "pass"> = {};
      (reactionRows ?? []).forEach((r: { place_id: string; reaction: "like" | "pass" }) => {
        map[r.place_id] = r.reaction;
      });
      setReactions(map);
      setLoading(false);
    })();
  }, []);

  async function react(placeId: string, reaction: "like" | "pass") {
    const current = reactions[placeId];
    const next = { ...reactions };
    if (current === reaction) delete next[placeId];
    else next[placeId] = reaction;
    setReactions(next);
    if (demo) {
      setDemoPlaceReactions(next); // persist across pages in demo mode
      return;
    }
    if (!myId) return;
    const supabase = createClient();
    if (current === reaction) {
      await supabase.from("place_reactions").delete().eq("user_id", myId).eq("place_id", placeId);
    } else {
      await supabase.from("place_reactions").upsert({ user_id: myId, place_id: placeId, reaction });
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = places.filter((p) => {
      if (q) {
        const hay = `${p.name} ${p.city ?? ""} ${p.neighborhood ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (maxRent < 3000 && (p.rent_min ?? 0) > maxRent) return false;
      if (curatedOnly && !p.curated) return false;
      return true;
    });
    if (sort !== "new") {
      out = [...out].sort((a, b) => {
        const ar = a.rent_min ?? Infinity;
        const br = b.rent_min ?? Infinity;
        return sort === "price-asc" ? ar - br : br - ar;
      });
    }
    return out;
  }, [places, query, maxRent, curatedOnly, sort]);

  const hasActiveFilters = query.trim() !== "" || maxRent < 3000 || curatedOnly;

  function resetFilters() {
    setQuery("");
    setMaxRent(3000);
    setCuratedOnly(false);
    setSort("new");
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

      <DottedTrail height={40} className="opacity-70" />

      <div className="mx-auto w-full max-w-2xl flex-1 px-6 pb-16">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Places</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Verified places posted right here on Roomly — no scraped listings, no fakes.
        </p>
        <PlacesNav />
        {demo && (
          <div className="mt-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-200">
            ✨ Showing demo places. Run <code className="rounded bg-violet-100 px-1 py-0.5 font-mono text-xs dark:bg-violet-900/50">supabase/schema.sql</code> to switch to real, saved data.
          </div>
        )}

        {loading ? (
          <p className="mt-10 text-center text-sm text-zinc-500">Loading places…</p>
        ) : !supabaseConfigured ? (
          <Empty title="Accounts aren't connected yet" body="Finish the Supabase setup in SETUP.md." />
        ) : !authed ? (
          <div className="mt-10 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Log in to browse places.</p>
            <Link href="/login" className="roomly-btn mt-4 h-11 px-6 text-sm">
              Go to log in
            </Link>
          </div>
        ) : places.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">No places listed yet.</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Be the first — post a place for roommates to find.</p>
            <Link href="/places/new" className="roomly-btn mt-6 h-11 px-6 text-sm">
              Post a place
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-6 space-y-4 rounded-3xl border border-zinc-200 bg-white/80 p-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
              <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 dark:border-zinc-700 dark:bg-zinc-950">
                <span aria-hidden="true" className="text-zinc-400">🔍</span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, city, or neighborhood"
                  aria-label="Search places"
                  className="h-10 flex-1 bg-transparent text-sm text-zinc-900 outline-none dark:text-zinc-100"
                />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Max rent</span>
                  <span className="text-sm font-bold text-violet-600 dark:text-violet-400">{maxRent >= 3000 ? "Any" : `$${maxRent.toLocaleString()}/mo`}</span>
                </div>
                <input
                  type="range"
                  min={500}
                  max={3000}
                  step={50}
                  value={maxRent}
                  onChange={(e) => setMaxRent(parseInt(e.target.value, 10))}
                  aria-label="Maximum rent"
                  className="w-full accent-violet-600"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  <input type="checkbox" checked={curatedOnly} onChange={(e) => setCuratedOnly(e.target.checked)} className="h-4 w-4 rounded accent-violet-600" />
                  Curated
                </label>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as "new" | "price-asc" | "price-desc")}
                  aria-label="Sort places"
                  className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                >
                  <option value="new">Newest</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">
                {filtered.length} of {places.length} {places.length === 1 ? "place" : "places"}
              </span>
              {hasActiveFilters && (
                <button type="button" onClick={resetFilters} className="font-medium text-violet-600 hover:underline dark:text-violet-400">
                  Clear filters
                </button>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="mt-8 rounded-3xl border border-zinc-200 bg-white/70 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/70">
                <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">No places match those filters.</p>
                <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Try widening your budget.</p>
                <button type="button" onClick={resetFilters} className="roomly-btn mt-5 h-10 px-5 text-sm">Clear filters</button>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {filtered.map((p, i) => {
                  const mine = reactions[p.id];
                  return (
                    <article
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(`/places/${p.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/places/${p.id}`);
                        }
                      }}
                      style={{ animationDelay: `${i * 50}ms` }}
                      className="roomly-card-in group cursor-pointer overflow-hidden rounded-3xl border border-zinc-200 bg-white/80 text-left shadow-sm backdrop-blur transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-500/10 dark:border-zinc-800 dark:bg-zinc-900/80"
                    >
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-200 dark:bg-zinc-800">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={placeMainPhoto(p)}
                          alt={p.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute left-3 top-3 flex items-center gap-1.5">
                          {p.curated && <VerifiedBadge label="Curated" />}
                          <span className="roomly-badge inline-flex items-center rounded-full bg-black/45 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur">
                            {placeKindLabel(p.kind)}
                          </span>
                        </div>
                        <div className="absolute right-3 top-3 flex gap-2">
                          <button
                            type="button"
                            aria-label={mine === "pass" ? "Passed — tap to clear" : "Pass"}
                            onClick={(e) => {
                              e.stopPropagation();
                              react(p.id, "pass");
                            }}
                            className={`flex h-9 w-9 items-center justify-center rounded-full text-lg backdrop-blur transition-transform hover:scale-110 active:scale-90 ${
                              mine === "pass" ? "bg-zinc-700/70" : "bg-black/45"
                            }`}
                          >
                            👎
                          </button>
                          <button
                            type="button"
                            aria-label={mine === "like" ? "Unlike" : "Like"}
                            onClick={(e) => {
                              e.stopPropagation();
                              react(p.id, "like");
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-lg backdrop-blur transition-transform hover:scale-110 active:scale-90"
                          >
                            {mine === "like" ? "❤️" : "🤍"}
                          </button>
                        </div>
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-10">
                          <p className="text-lg font-bold text-white">{formatRentRange(p.rent_min, p.rent_max)}</p>
                        </div>
                      </div>
                      <div className="p-4">
                        <h2 className="truncate font-semibold text-zinc-900 dark:text-zinc-50">{p.name}</h2>
                        <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">
                          {[p.neighborhood, p.city].filter(Boolean).join(", ") || "—"}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
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
